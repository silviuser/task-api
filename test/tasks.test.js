const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const taskService = require("../src/services/task-service");
const {
  createTaskController,
  validateCreateTaskInput,
  validateUpdateTaskInput,
  isValidTaskId,
} = require("../src/controllers/task-controller");

const TEST_JWT_SECRET = "test-jwt-secret";
const USER_A_ID = "11111111-1111-4111-8111-111111111111";
const USER_B_ID = "22222222-2222-4222-8222-222222222222";

function signToken(sub = USER_A_ID, email = "usera@example.com") {
  return jwt.sign({ sub, email }, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

function authHeaders(token = signToken(), extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

let server;
let baseUrl;
let tempDir;
let tasksFile;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-api-tasks-test-"));
  tasksFile = path.join(tempDir, "tasks.json");

  server = createApp({
    logger: () => {},
    tasksFile,
    jwtSecret: TEST_JWT_SECRET,
  }).listen(0);

  await once(server, "listening");
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.close();
  }
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("GET /tasks returns an empty array initially and returns all stored tasks after creation", async () => {
  const initialRes = await fetch(`${baseUrl}/tasks`, {
    headers: authHeaders(),
  });
  assert.equal(initialRes.status, 200);
  const initialBody = await initialRes.json();
  assert.deepEqual(initialBody, []);

  const createRes = await fetch(`${baseUrl}/tasks`, {
    method: "POST",
    headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "First task", description: "Details", status: "in_progress" }),
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();

  const listRes = await fetch(`${baseUrl}/tasks`, {
    headers: authHeaders(),
  });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.length, 1);
  assert.deepEqual(listBody[0], created);
});

test("POST /tasks with valid payload returns 201, Location header, defaults description/status, and persists userId", async () => {
  const res = await fetch(`${baseUrl}/tasks`, {
    method: "POST",
    headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
    body: JSON.stringify({
      title: "  Buy groceries  ",
    }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();

  assert.ok(typeof body.id === "string" && body.id.length > 0);
  assert.equal(body.userId, USER_A_ID);
  assert.equal(body.title, "Buy groceries");
  assert.equal(body.description, "");
  assert.equal(body.status, "todo");
  assert.ok(typeof body.createdAt === "string");
  assert.ok(typeof body.updatedAt === "string");
  assert.equal(body.createdAt, body.updatedAt);
  assert.equal(res.headers.get("Location"), `/tasks/${body.id}`);
});

test("POST /tasks with invalid title, description, or status returns 400", async () => {
  const cases = [
    { payload: {}, expected: "title is required" },
    { payload: { title: "" }, expected: "title is required" },
    { payload: { title: "   " }, expected: "title is required" },
    { payload: { title: 123 }, expected: "title is required" },
    { payload: { title: "a".repeat(201) }, expected: "title must not exceed 200 characters" },
    { payload: { title: "Valid", description: 42 }, expected: "description must be a string" },
    { payload: { title: "Valid", description: "d".repeat(1001) }, expected: "description must not exceed 1000 characters" },
    { payload: { title: "Valid", status: "archived" }, expected: "status must be one of: todo, in_progress, done" },
  ];

  for (const { payload, expected } of cases) {
    const res = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body, { error: expected });
  }
});

test("GET /tasks/:id returns 200 with matching task or 404 when missing", async () => {
  const createRes = await fetch(`${baseUrl}/tasks`, {
    method: "POST",
    headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "Lookup task" }),
  });
  const created = await createRes.json();

  const getRes = await fetch(`${baseUrl}/tasks/${created.id}`, {
    headers: authHeaders(),
  });
  assert.equal(getRes.status, 200);
  const fetched = await getRes.json();
  assert.deepEqual(fetched, created);

  const missingRes = await fetch(`${baseUrl}/tasks/00000000-0000-4000-8000-000000000000`, {
    headers: authHeaders(),
  });
  assert.equal(missingRes.status, 404);
  const missingBody = await missingRes.json();
  assert.deepEqual(missingBody, { error: "Task not found" });
});

test("PATCH /tasks/:id updates only provided fields, refreshes updatedAt, and returns 400 or 404 on errors", async () => {
  const createRes = await fetch(`${baseUrl}/tasks`, {
    method: "POST",
    headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "Original title", description: "Original desc", status: "todo" }),
  });
  const created = await createRes.json();

  const patchRes = await fetch(`${baseUrl}/tasks/${created.id}`, {
    method: "PATCH",
    headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "  Updated title  ", status: "done" }),
  });
  assert.equal(patchRes.status, 200);
  const updated = await patchRes.json();

  assert.equal(updated.id, created.id);
  assert.equal(updated.userId, USER_A_ID);
  assert.equal(updated.title, "Updated title");
  assert.equal(updated.description, "Original desc");
  assert.equal(updated.status, "done");
  assert.equal(updated.createdAt, created.createdAt);
  assert.ok(Date.parse(updated.updatedAt) >= Date.parse(created.updatedAt));

  const invalidCases = [
    { payload: {}, expected: "at least one of title, description, or status is required" },
    { payload: { unknown: "x" }, expected: "unknown field: unknown" },
    { payload: { title: "   " }, expected: "title must be a non-empty string" },
    { payload: { title: "a".repeat(201) }, expected: "title must not exceed 200 characters" },
    { payload: { description: 123 }, expected: "description must be a string" },
    { payload: { description: "d".repeat(1001) }, expected: "description must not exceed 1000 characters" },
    { payload: { status: "invalid" }, expected: "status must be one of: todo, in_progress, done" },
  ];

  for (const { payload, expected } of invalidCases) {
    const badRes = await fetch(`${baseUrl}/tasks/${created.id}`, {
      method: "PATCH",
      headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    assert.equal(badRes.status, 400);
    assert.deepEqual(await badRes.json(), { error: expected });
  }

  const missingRes = await fetch(`${baseUrl}/tasks/00000000-0000-4000-8000-000000000000`, {
    method: "PATCH",
    headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
    body: JSON.stringify({ status: "done" }),
  });
  assert.equal(missingRes.status, 404);
  assert.deepEqual(await missingRes.json(), { error: "Task not found" });
});

test("DELETE /tasks/:id returns 204 with empty body and removes task, or returns 404 when missing", async () => {
  const createRes = await fetch(`${baseUrl}/tasks`, {
    method: "POST",
    headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "Task to delete" }),
  });
  const created = await createRes.json();

  const deleteRes = await fetch(`${baseUrl}/tasks/${created.id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  assert.equal(deleteRes.status, 204);
  assert.equal(await deleteRes.text(), "");

  const getAfterDelete = await fetch(`${baseUrl}/tasks/${created.id}`, {
    headers: authHeaders(),
  });
  assert.equal(getAfterDelete.status, 404);

  const deleteAgainRes = await fetch(`${baseUrl}/tasks/${created.id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  assert.equal(deleteAgainRes.status, 404);
  assert.deepEqual(await deleteAgainRes.json(), { error: "Task not found" });
});

test("Concurrent POST /tasks and PATCH /tasks/:id calls serialize safely without data loss", async () => {
  const concurrentFile = path.join(tempDir, "concurrent-tasks.json");
  const concurrentServer = createApp({
    logger: () => {},
    tasksFile: concurrentFile,
    jwtSecret: TEST_JWT_SECRET,
  }).listen(0);
  await once(concurrentServer, "listening");
  const concurrentUrl = `http://localhost:${concurrentServer.address().port}`;

  try {
    const createRequests = Array.from({ length: 5 }, (_, i) =>
      fetch(`${concurrentUrl}/tasks`, {
        method: "POST",
        headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
        body: JSON.stringify({ title: `Concurrent task ${i}` }),
      }).then(async (r) => {
        assert.equal(r.status, 201);
        return r.json();
      }),
    );

    const createdTasks = await Promise.all(createRequests);
    assert.equal(createdTasks.length, 5);

    const targetId = createdTasks[0].id;
    await Promise.all([
      fetch(`${concurrentUrl}/tasks/${targetId}`, {
        method: "PATCH",
        headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
        body: JSON.stringify({ description: "Updated description" }),
      }),
      fetch(`${concurrentUrl}/tasks/${targetId}`, {
        method: "PATCH",
        headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
        body: JSON.stringify({ status: "done" }),
      }),
    ]);

    const finalRes = await fetch(`${concurrentUrl}/tasks`, {
      headers: authHeaders(),
    });
    const finalTasks = await finalRes.json();
    assert.equal(finalTasks.length, 5);

    const updatedTarget = finalTasks.find((t) => t.id === targetId);
    assert.equal(updatedTarget.description, "Updated description");
    assert.equal(updatedTarget.status, "done");
  } finally {
    concurrentServer.close();
  }
});

test("task-service throws TASK_NOT_FOUND and TASK_FORBIDDEN without status, and task-controller forwards unexpected errors to next", async () => {
  const checkNotFound = (err) => {
    assert.equal(err.code, "TASK_NOT_FOUND");
    assert.equal(err.message, "Task not found");
    assert.equal(err.status, undefined);
    return true;
  };
  const checkForbidden = (err) => {
    assert.equal(err.code, "TASK_FORBIDDEN");
    assert.equal(err.message, "Forbidden");
    assert.equal(err.status, undefined);
    return true;
  };

  await assert.rejects(taskService.getTaskById("missing", USER_A_ID, { tasksFile }), checkNotFound);
  await assert.rejects(taskService.updateTask("missing", { status: "done" }, USER_A_ID, { tasksFile }), checkNotFound);
  await assert.rejects(taskService.deleteTask("missing", USER_A_ID, { tasksFile }), checkNotFound);

  const ownedTask = await taskService.createTask({ title: "Service owned", userId: USER_A_ID }, { tasksFile });
  await assert.rejects(taskService.getTaskById(ownedTask.id, USER_B_ID, { tasksFile }), checkForbidden);
  await assert.rejects(taskService.updateTask(ownedTask.id, { status: "done" }, USER_B_ID, { tasksFile }), checkForbidden);
  await assert.rejects(taskService.deleteTask(ownedTask.id, USER_B_ID, { tasksFile }), checkForbidden);

  assert.equal(validateCreateTaskInput(null), "title is required");
  assert.equal(validateUpdateTaskInput(null), "at least one of title, description, or status is required");
  assert.equal(isValidTaskId(USER_A_ID), true);
  assert.equal(isValidTaskId("non-existent-id"), false);

  // Point tasksFile at a directory to force an unexpected filesystem error (EISDIR)
  const controller = createTaskController({ tasksFile: tempDir });
  let forwarded;
  await controller.list(
    { user: { sub: USER_A_ID } },
    {
      status() {
        return this;
      },
      json() {
        return this;
      },
    },
    (err) => {
      forwarded = err;
    },
  );
  assert.ok(forwarded instanceof Error);
  assert.notEqual(forwarded.code, "TASK_NOT_FOUND");
});

test("Requests to /tasks without header, with non-Bearer header, malformed token, wrong secret, wrong algorithm, expired token, or missing sub return 401", async () => {
  const validTaskId = "00000000-0000-4000-8000-000000000000";
  const endpoints = [
    { method: "POST", path: "/tasks", body: JSON.stringify({ title: "Test" }) },
    { method: "GET", path: "/tasks" },
    { method: "GET", path: `/tasks/${validTaskId}` },
    { method: "PATCH", path: `/tasks/${validTaskId}`, body: JSON.stringify({ status: "done" }) },
    { method: "DELETE", path: `/tasks/${validTaskId}` },
  ];

  for (const { method, path: routePath, body } of endpoints) {
    const res = await fetch(`${baseUrl}${routePath}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body,
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Authentication required" });
  }

  const wrongSecretToken = jwt.sign({ sub: USER_A_ID, email: "a@example.com" }, "wrong-secret", {
    algorithm: "HS256",
    expiresIn: "1h",
  });
  const expiredToken = jwt.sign({ sub: USER_A_ID, email: "a@example.com" }, TEST_JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: -10,
  });
  const hs384Token = jwt.sign({ sub: USER_A_ID, email: "a@example.com" }, TEST_JWT_SECRET, {
    algorithm: "HS384",
    expiresIn: "1h",
  });
  const unsignedNoneToken = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: USER_A_ID })).toString("base64url")}.`;
  const missingSubToken = jwt.sign({ email: "a@example.com" }, TEST_JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

  const authFailureCases = [
    { header: "Basic dXNlcjpwYXNz", expected: "Authentication required" },
    { header: "Bearer", expected: "Authentication required" },
    { header: "Bearer token with spaces", expected: "Authentication required" },
    { header: "Bearer not-a-jwt", expected: "Invalid or expired token" },
    { header: `Bearer ${wrongSecretToken}`, expected: "Invalid or expired token" },
    { header: `Bearer ${expiredToken}`, expected: "Invalid or expired token" },
    { header: `Bearer ${hs384Token}`, expected: "Invalid or expired token" },
    { header: `Bearer ${unsignedNoneToken}`, expected: "Invalid or expired token" },
    { header: `Bearer ${missingSubToken}`, expected: "Invalid or expired token" },
  ];

  for (const { header, expected } of authFailureCases) {
    const res = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: header },
    });
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: expected });
  }
});

test("GET /tasks returns only tasks belonging to the authenticated user", async () => {
  const isolatedFile = path.join(tempDir, "isolated-tasks.json");
  const isolatedServer = createApp({
    logger: () => {},
    tasksFile: isolatedFile,
    jwtSecret: TEST_JWT_SECRET,
  }).listen(0);
  await once(isolatedServer, "listening");
  const isolatedUrl = `http://localhost:${isolatedServer.address().port}`;

  const tokenA = signToken(USER_A_ID, "usera@example.com");
  const tokenB = signToken(USER_B_ID, "userb@example.com");

  try {
    const createARes = await fetch(`${isolatedUrl}/tasks`, {
      method: "POST",
      headers: authHeaders(tokenA, { "Content-Type": "application/json" }),
      body: JSON.stringify({ title: "User A task" }),
    });
    assert.equal(createARes.status, 201);
    const taskA = await createARes.json();

    const createBRes = await fetch(`${isolatedUrl}/tasks`, {
      method: "POST",
      headers: authHeaders(tokenB, { "Content-Type": "application/json" }),
      body: JSON.stringify({ title: "User B task" }),
    });
    assert.equal(createBRes.status, 201);
    const taskB = await createBRes.json();

    const listARes = await fetch(`${isolatedUrl}/tasks`, {
      headers: authHeaders(tokenA),
    });
    assert.equal(listARes.status, 200);
    assert.deepEqual(await listARes.json(), [taskA]);

    const listBRes = await fetch(`${isolatedUrl}/tasks`, {
      headers: authHeaders(tokenB),
    });
    assert.equal(listBRes.status, 200);
    assert.deepEqual(await listBRes.json(), [taskB]);
  } finally {
    isolatedServer.close();
  }
});

test("GET /tasks/:id, PATCH /tasks/:id, and DELETE /tasks/:id return 403 Forbidden for another user's task without modifying data", async () => {
  const tokenA = signToken(USER_A_ID, "usera@example.com");
  const tokenB = signToken(USER_B_ID, "userb@example.com");

  const createRes = await fetch(`${baseUrl}/tasks`, {
    method: "POST",
    headers: authHeaders(tokenA, { "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "User A private task", description: "Keep safe", status: "todo" }),
  });
  assert.equal(createRes.status, 201);
  const taskA = await createRes.json();

  const getForbiddenRes = await fetch(`${baseUrl}/tasks/${taskA.id}`, {
    headers: authHeaders(tokenB),
  });
  assert.equal(getForbiddenRes.status, 403);
  assert.deepEqual(await getForbiddenRes.json(), { error: "Forbidden" });

  const patchForbiddenRes = await fetch(`${baseUrl}/tasks/${taskA.id}`, {
    method: "PATCH",
    headers: authHeaders(tokenB, { "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "Hijacked", status: "done" }),
  });
  assert.equal(patchForbiddenRes.status, 403);
  assert.deepEqual(await patchForbiddenRes.json(), { error: "Forbidden" });

  const deleteForbiddenRes = await fetch(`${baseUrl}/tasks/${taskA.id}`, {
    method: "DELETE",
    headers: authHeaders(tokenB),
  });
  assert.equal(deleteForbiddenRes.status, 403);
  assert.deepEqual(await deleteForbiddenRes.json(), { error: "Forbidden" });

  // Verify User A's task was neither modified nor deleted
  const ownerGetRes = await fetch(`${baseUrl}/tasks/${taskA.id}`, {
    headers: authHeaders(tokenA),
  });
  assert.equal(ownerGetRes.status, 200);
  assert.deepEqual(await ownerGetRes.json(), taskA);
});

test("POST /tasks and PATCH /tasks/:id reject unknown or protected fields with 400", async () => {
  const createRes = await fetch(`${baseUrl}/tasks`, {
    method: "POST",
    headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
    body: JSON.stringify({ title: "Valid task" }),
  });
  const created = await createRes.json();

  const forbiddenFields = ["userId", "id", "createdAt", "updatedAt", "extraField"];
  for (const field of forbiddenFields) {
    const postRes = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
      body: JSON.stringify({ title: "Task", [field]: "injected" }),
    });
    assert.equal(postRes.status, 400);
    assert.deepEqual(await postRes.json(), { error: `unknown field: ${field}` });

    const patchRes = await fetch(`${baseUrl}/tasks/${created.id}`, {
      method: "PATCH",
      headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
      body: JSON.stringify({ status: "done", [field]: "injected" }),
    });
    assert.equal(patchRes.status, 400);
    assert.deepEqual(await patchRes.json(), { error: `unknown field: ${field}` });
  }
});

test("GET /tasks/:id, PATCH /tasks/:id, and DELETE /tasks/:id with non-UUIDv4 :id return 400 Invalid task id", async () => {
  const invalidIds = [
    "non-existent-id",
    "123",
    "00000000-0000-0000-0000-000000000000", // nil UUID (version 0)
    "00000000-0000-1000-8000-000000000000", // UUIDv1
  ];

  for (const invalidId of invalidIds) {
    const getRes = await fetch(`${baseUrl}/tasks/${invalidId}`, {
      headers: authHeaders(),
    });
    assert.equal(getRes.status, 400);
    assert.deepEqual(await getRes.json(), { error: "Invalid task id" });

    const patchRes = await fetch(`${baseUrl}/tasks/${invalidId}`, {
      method: "PATCH",
      headers: authHeaders(signToken(), { "Content-Type": "application/json" }),
      body: JSON.stringify({ status: "done" }),
    });
    assert.equal(patchRes.status, 400);
    assert.deepEqual(await patchRes.json(), { error: "Invalid task id" });

    const deleteRes = await fetch(`${baseUrl}/tasks/${invalidId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    assert.equal(deleteRes.status, 400);
    assert.deepEqual(await deleteRes.json(), { error: "Invalid task id" });
  }
});
