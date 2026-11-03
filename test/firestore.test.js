const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const { once } = require("node:events");
const { createApp } = require("../src/app");
const { getDb, isFirestoreEnabled } = require("../src/storage/firestore");
const userStore = require("../src/storage/user-store");
const taskStore = require("../src/storage/task-store");
const { seedData } = require("../src/seed");

const TEST_JWT_SECRET = "test-firestore-jwt-secret-key-32-chars";
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createFirestoreRestEmulator() {
  const documents = new Map();
  let txCounter = 0;
  let activeTxId = null;
  let releaseActiveTx = null;
  let txQueue = Promise.resolve();

  async function acquireTxLock() {
    let release;
    const prev = txQueue;
    txQueue = new Promise((resolve) => {
      release = resolve;
    });
    await prev;
    txCounter += 1;
    const txId = Buffer.from(`tx-${txCounter}`).toString("base64");
    activeTxId = txId;
    releaseActiveTx = release;
    return txId;
  }

  function finishTxLock(txId) {
    if (txId && activeTxId === txId && releaseActiveTx) {
      const release = releaseActiveTx;
      activeTxId = null;
      releaseActiveTx = null;
      release();
    }
  }

  function matchesFilter(doc, filter) {
    if (!filter) return true;
    if (filter.compositeFilter) {
      const filters = filter.compositeFilter.filters ?? [];
      return filters.every((f) => matchesFilter(doc, f));
    }
    if (filter.fieldFilter) {
      const { field, op, value } = filter.fieldFilter;
      const docVal = doc.fields?.[field?.fieldPath];
      if (op === "EQUAL" || op === 5) {
        return JSON.stringify(docVal) === JSON.stringify(value);
      }
    }
    return true;
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
        const url = new URL(req.url, "http://127.0.0.1");
        const pathname = decodeURIComponent(url.pathname);
        const now = new Date().toISOString();

        if (req.method === "POST" && pathname.endsWith(":beginTransaction")) {
          const isReadWrite = Boolean(body.options?.readWrite || !body.options?.readOnly);
          const txId = isReadWrite
            ? await acquireTxLock()
            : Buffer.from(`ro-${++txCounter}`).toString("base64");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ transaction: txId }));
          return;
        }

        if (req.method === "POST" && pathname.endsWith(":batchGet")) {
          let txId;
          if (body.newTransaction) {
            txId = body.newTransaction.readWrite
              ? await acquireTxLock()
              : Buffer.from(`ro-${++txCounter}`).toString("base64");
          }
          const results = (body.documents ?? []).map((docName, idx) => {
            const stored = documents.get(docName);
            const base = idx === 0 && txId ? { transaction: txId, readTime: now } : { readTime: now };
            return stored ? { ...base, found: stored } : { ...base, missing: docName };
          });
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(results));
          return;
        }

        if (req.method === "POST" && pathname.endsWith(":runQuery")) {
          let txId;
          if (body.newTransaction) {
            txId = body.newTransaction.readWrite
              ? await acquireTxLock()
              : Buffer.from(`ro-${++txCounter}`).toString("base64");
          }
          const parent =
            body.parent ?? pathname.slice("/v1/".length, pathname.lastIndexOf(":runQuery"));
          const sq = body.structuredQuery ?? {};
          const collectionId = sq.from?.[0]?.collectionId;
          const prefix = `${parent}/${collectionId}/`;
          let matched = [];
          for (const [docName, doc] of documents.entries()) {
            if (docName.startsWith(prefix) && !docName.slice(prefix.length).includes("/")) {
              if (matchesFilter(doc, sq.where)) {
                matched.push(doc);
              }
            }
          }
          const limit = typeof sq.limit === "number" ? sq.limit : sq.limit?.value;
          if (typeof limit === "number") {
            matched = matched.slice(0, limit);
          }
          const responseItems =
            matched.length > 0
              ? matched.map((doc, idx) => ({
                  document: doc,
                  readTime: now,
                  ...(idx === 0 && txId ? { transaction: txId } : {}),
                }))
              : [{ readTime: now, ...(txId ? { transaction: txId } : {}) }];
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(responseItems));
          return;
        }

        if (req.method === "POST" && pathname.endsWith(":commit")) {
          try {
            const writes = body.writes ?? [];
            for (const write of writes) {
              if (write.delete) {
                documents.delete(write.delete);
              } else if (write.update) {
                const docName = write.update.name;
                const existing = documents.get(docName);
                if (write.currentDocument?.exists === true && !existing) {
                  res.writeHead(404, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: { code: 404, message: "NOT_FOUND", status: "NOT_FOUND" } }));
                  return;
                }
                let fields;
                if (write.updateMask?.fieldPaths && existing) {
                  fields = { ...existing.fields };
                  for (const fp of write.updateMask.fieldPaths) {
                    if (write.update.fields && Object.prototype.hasOwnProperty.call(write.update.fields, fp)) {
                      fields[fp] = write.update.fields[fp];
                    } else {
                      delete fields[fp];
                    }
                  }
                } else {
                  fields = { ...(write.update.fields ?? {}) };
                }
                documents.set(docName, {
                  name: docName,
                  fields,
                  createTime: existing?.createTime ?? now,
                  updateTime: now,
                });
              }
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                writeResults: writes.map(() => ({ updateTime: now })),
                commitTime: now,
              }),
            );
          } finally {
            finishTxLock(body.transaction);
          }
          return;
        }

        if (req.method === "POST" && pathname.endsWith(":rollback")) {
          finishTxLock(body.transaction);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({}));
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: 404, message: "Not Found" } }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: 500, message: err.message } }));
      }
    });
  });

  return server;
}

let emulatorServer;
let originalEmulatorHost;
let projectId;

before(async () => {
  originalEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  projectId = `test-firestore-${crypto.randomUUID()}`;
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    emulatorServer = createFirestoreRestEmulator().listen(0, "127.0.0.1");
    await once(emulatorServer, "listening");
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${emulatorServer.address().port}`;
  }
});

after(async () => {
  if (originalEmulatorHost === undefined) {
    delete process.env.FIRESTORE_EMULATOR_HOST;
  } else {
    process.env.FIRESTORE_EMULATOR_HOST = originalEmulatorHost;
  }
  if (emulatorServer) {
    emulatorServer.close();
  }
});

test("T1: getDb returns the same Firestore instance per project and isFirestoreEnabled respects dataFile/tasksFile fallback", () => {
  const db1 = getDb({ projectId });
  const db2 = getDb({ projectId });
  assert.equal(db1, db2);

  assert.equal(isFirestoreEnabled({ useFirestore: true }, "dataFile"), true);
  assert.equal(isFirestoreEnabled({}, "dataFile"), true);
  assert.equal(isFirestoreEnabled({ dataFile: "/tmp/users.json", useFirestore: true }, "dataFile"), false);
  assert.equal(isFirestoreEnabled({ tasksFile: "/tmp/tasks.json", useFirestore: true }, "tasksFile"), false);
  assert.equal(isFirestoreEnabled("/tmp/users.json", "dataFile"), false);
});

test("T2: user-store CRUD and concurrent createUser email uniqueness transaction on Firestore", async () => {
  const opts = { useFirestore: true, projectId };
  await userStore.resetUsers(opts);

  const created = await userStore.createUser(
    { email: "  Alice@Example.com ", passwordHash: "$2b$10$testhash1234567890" },
    opts,
  );
  assert.match(created.id, UUID_V4_REGEX);
  assert.equal(created.email, "alice@example.com");
  assert.equal(typeof created.createdAt, "string");
  assert.equal(created.passwordHash, undefined);

  const found = await userStore.findUserByEmail("ALICE@EXAMPLE.COM", opts);
  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.equal(found.email, "alice@example.com");
  assert.equal(found.passwordHash, "$2b$10$testhash1234567890");

  const unknown = await userStore.findUserByEmail("nobody@example.com", opts);
  assert.equal(unknown, null);

  const results = await Promise.allSettled([
    userStore.createUser({ email: "Race@Example.com", passwordHash: "$2b$10$hash1" }, opts),
    userStore.createUser({ email: "race@example.com", passwordHash: "$2b$10$hash2" }, opts),
  ]);
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "DUPLICATE_EMAIL");

  const allUsers = await userStore.readUsers(opts);
  assert.equal(allUsers.length, 2);

  await userStore.resetUsers(opts);
  const afterReset = await userStore.readUsers(opts);
  assert.deepEqual(afterReset, []);
});

test("T3: task-store createTask, listTasks, getTaskById, updateTask, deleteTask, and resetTasks on Firestore", async () => {
  const opts = { useFirestore: true, projectId };
  await taskStore.resetTasks(opts);

  const t1 = await taskStore.createTask(
    { title: "Firestore task 1", description: "Desc 1", status: "todo", userId: "user-1" },
    opts,
  );
  const t2 = await taskStore.createTask(
    { title: "Firestore task 2", description: "Desc 2", status: "done", userId: "user-2" },
    opts,
  );
  assert.match(t1.id, UUID_V4_REGEX);
  assert.equal(t1.userId, "user-1");

  const user1Tasks = await taskStore.listTasks({ ...opts, userId: "user-1" });
  assert.equal(user1Tasks.length, 1);
  assert.equal(user1Tasks[0].id, t1.id);

  const fetched = await taskStore.getTaskById(t1.id, opts);
  assert.deepEqual(fetched, t1);
  assert.equal(await taskStore.getTaskById("missing-id", opts), null);

  const updated = await taskStore.updateTask(t1.id, { status: "in_progress" }, opts);
  assert.equal(updated.title, "Firestore task 1");
  assert.equal(updated.description, "Desc 1");
  assert.equal(updated.status, "in_progress");
  assert.equal(updated.userId, "user-1");
  assert.equal(await taskStore.updateTask("missing-id", { status: "done" }, opts), null);

  assert.equal(await taskStore.deleteTask(t2.id, opts), true);
  assert.equal(await taskStore.deleteTask(t2.id, opts), false);

  await taskStore.resetTasks(opts);
  assert.deepEqual(await taskStore.listTasks(opts), []);
});

test("T4: Full HTTP flow (/auth/register, /auth/login, /tasks CRUD and ownership) with Firestore storage", async () => {
  const opts = { useFirestore: true, projectId };
  await Promise.all([userStore.resetUsers(opts), taskStore.resetTasks(opts)]);

  const server = createApp({
    logger: () => {},
    useFirestore: true,
    projectId,
    jwtSecret: TEST_JWT_SECRET,
  }).listen(0);
  await once(server, "listening");
  const baseUrl = `http://localhost:${server.address().port}`;

  try {
    const reg1 = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "Owner@Example.com", password: "Password123!" }),
    });
    assert.equal(reg1.status, 201);
    const owner = await reg1.json();
    assert.equal(owner.email, "owner@example.com");
    assert.equal(owner.passwordHash, undefined);

    const regDup = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "Password123!" }),
    });
    assert.equal(regDup.status, 409);

    const reg2 = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "other@example.com", password: "Password123!" }),
    });
    assert.equal(reg2.status, 201);

    const loginOwner = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "Password123!" }),
    });
    assert.equal(loginOwner.status, 200);
    const { token: ownerToken } = await loginOwner.json();

    const loginWrong = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: "WrongPassword!" }),
    });
    assert.equal(loginWrong.status, 401);

    const loginOther = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "other@example.com", password: "Password123!" }),
    });
    const { token: otherToken } = await loginOther.json();

    const createRes = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ title: "Cloud task", description: "Stored in Firestore" }),
    });
    assert.equal(createRes.status, 201);
    const createdTask = await createRes.json();
    assert.equal(createdTask.userId, owner.id);
    assert.equal(createdTask.status, "todo");

    const listOwner = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(listOwner.status, 200);
    assert.equal((await listOwner.json()).length, 1);

    const listOther = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(listOther.status, 200);
    assert.deepEqual(await listOther.json(), []);

    const forbiddenPatch = await fetch(`${baseUrl}/tasks/${createdTask.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${otherToken}`,
      },
      body: JSON.stringify({ status: "done" }),
    });
    assert.equal(forbiddenPatch.status, 403);

    const patchRes = await fetch(`${baseUrl}/tasks/${createdTask.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: "done" }),
    });
    assert.equal(patchRes.status, 200);
    const patchedTask = await patchRes.json();
    assert.equal(patchedTask.status, "done");
    assert.equal(patchedTask.title, "Cloud task");

    const delRes = await fetch(`${baseUrl}/tasks/${createdTask.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(delRes.status, 204);

    const getDeleted = await fetch(`${baseUrl}/tasks/${createdTask.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(getDeleted.status, 404);
  } finally {
    server.close();
  }
});

test("T5: seedData in Firestore mode populates seed_users and seed_tasks without touching users or tasks", async () => {
  const appOpts = { useFirestore: true, projectId };
  await Promise.all([userStore.resetUsers(appOpts), taskStore.resetTasks(appOpts)]);

  const existingUser = await userStore.createUser(
    { email: "realuser@example.com", passwordHash: "$2b$10$realhash" },
    appOpts,
  );
  const existingTask = await taskStore.createTask(
    { title: "Real task", description: "Keep me", status: "todo", userId: existingUser.id },
    appOpts,
  );

  const seeded = await seedData({
    useFirestore: true,
    projectId,
    userCount: 2,
    taskCount: 4,
    seed: 77,
  });

  assert.equal(seeded.usersCollection, "seed_users");
  assert.equal(seeded.tasksCollection, "seed_tasks");
  assert.equal(seeded.users.length, 2);
  assert.equal(seeded.tasks.length, 4);

  const realUsers = await userStore.readUsers(appOpts);
  const realTasks = await taskStore.listTasks(appOpts);
  assert.equal(realUsers.length, 1);
  assert.equal(realUsers[0].id, existingUser.id);
  assert.equal(realTasks.length, 1);
  assert.equal(realTasks[0].id, existingTask.id);

  const seededUsers = await userStore.readUsers({ ...appOpts, usersCollection: "seed_users" });
  const seededTasks = await taskStore.listTasks({ ...appOpts, tasksCollection: "seed_tasks" });
  assert.equal(seededUsers.length, 2);
  assert.equal(seededTasks.length, 4);
});
