const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createApp } = require("../src/app");
const { seedData, DEFAULT_SEED_PASSWORD } = require("../src/seed");
const userStore = require("../src/storage/user-store");
const taskStore = require("../src/storage/task-store");

const execFileAsync = promisify(execFile);
const TEST_JWT_SECRET = "test-jwt-secret-seed";

let tempDir;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-api-seed-test-"));
});

after(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("Running src/seed.js via CLI exits 0, writes seed files, and prints a summary without passwords or hashes", async () => {
  const cliDataFile = path.join(tempDir, "cli-users.json");
  const cliTasksFile = path.join(tempDir, "cli-tasks.json");
  const seedScript = path.resolve(__dirname, "../src/seed.js");

  const { stdout, stderr } = await execFileAsync(process.execPath, [seedScript], {
    env: {
      ...process.env,
      DATA_FILE: cliDataFile,
      TASKS_FILE: cliTasksFile,
    },
  });

  assert.equal(stderr, "");
  assert.match(stdout, /Seeded 5 users .* and 15 tasks/);
  assert.ok(!stdout.includes(DEFAULT_SEED_PASSWORD));
  assert.ok(!stdout.includes("$2b$"));
  assert.ok(!stdout.includes("$2a$"));

  const storedUsers = await userStore.readUsers({ dataFile: cliDataFile });
  const storedTasks = await taskStore.listTasks({ tasksFile: cliTasksFile });
  assert.equal(storedUsers.length, 5);
  assert.equal(storedTasks.length, 15);
});

test("Default seedData() targets data/seed-users.json and data/seed-tasks.json without creating data/users.json or data/tasks.json", async () => {
  const cwdDir = path.join(tempDir, "default-cwd");
  await fs.mkdir(cwdDir, { recursive: true });
  const originalCwd = process.cwd();
  const originalDataFile = process.env.DATA_FILE;
  const originalTasksFile = process.env.TASKS_FILE;

  delete process.env.DATA_FILE;
  delete process.env.TASKS_FILE;
  process.chdir(cwdDir);

  try {
    const result = await seedData({ userCount: 1, taskCount: 1 });
    assert.equal(result.dataFile, path.join(cwdDir, "data", "seed-users.json"));
    assert.equal(result.tasksFile, path.join(cwdDir, "data", "seed-tasks.json"));

    const files = await fs.readdir(path.join(cwdDir, "data"));
    assert.deepEqual(files.sort(), ["seed-tasks.json", "seed-users.json"]);
  } finally {
    process.chdir(originalCwd);
    if (originalDataFile !== undefined) process.env.DATA_FILE = originalDataFile;
    if (originalTasksFile !== undefined) process.env.TASKS_FILE = originalTasksFile;
  }
});

test("Running seedData() twice on pre-populated files atomically replaces contents with deterministic 5 users and 15 tasks across statuses", async () => {
  const dataFile = path.join(tempDir, "replace-users.json");
  const tasksFile = path.join(tempDir, "replace-tasks.json");

  await userStore.createUser({ email: "stale@example.com", passwordHash: "$2b$10$stale" }, { dataFile });
  await taskStore.createTask({ title: "Stale task", description: "Old", status: "todo" }, { tasksFile });

  const firstRun = await seedData({ dataFile, tasksFile, seed: 42 });
  const secondRun = await seedData({ dataFile, tasksFile, seed: 42 });

  assert.equal(secondRun.users.length, 5);
  assert.equal(secondRun.tasks.length, 15);

  // Deterministic content across runs (excluding random UUIDs and timestamps)
  assert.deepEqual(
    firstRun.users.map((u) => u.email),
    secondRun.users.map((u) => u.email),
  );
  assert.deepEqual(
    firstRun.tasks.map((t) => ({ title: t.title, description: t.description, status: t.status })),
    secondRun.tasks.map((t) => ({ title: t.title, description: t.description, status: t.status })),
  );

  // Stale records were replaced, not appended
  const storedUsers = await userStore.readUsers({ dataFile });
  const storedTasks = await taskStore.listTasks({ tasksFile });
  assert.equal(storedUsers.length, 5);
  assert.equal(storedTasks.length, 15);
  assert.ok(!storedUsers.some((u) => u.email === "stale@example.com"));
  assert.ok(!storedTasks.some((t) => t.title === "Stale task"));

  // All 3 statuses represented and field constraints satisfied
  const statuses = new Set(secondRun.tasks.map((t) => t.status));
  assert.deepEqual([...statuses].sort(), ["done", "in_progress", "todo"]);
  for (const task of secondRun.tasks) {
    assert.ok(task.title.length > 0 && task.title.length <= 200);
    assert.ok(typeof task.description === "string" && task.description.length <= 1000);
  }
});

test("POST /auth/login with a seeded user's email and DEFAULT_SEED_PASSWORD returns 200 with a JWT, and GET /tasks returns seeded tasks", async () => {
  const dataFile = path.join(tempDir, "http-users.json");
  const tasksFile = path.join(tempDir, "http-tasks.json");

  const { users, tasks } = await seedData({ dataFile, tasksFile, userCount: 2, taskCount: 3 });

  const server = createApp({
    logger: () => {},
    dataFile,
    tasksFile,
    jwtSecret: TEST_JWT_SECRET,
  }).listen(0);

  await once(server, "listening");
  const baseUrl = `http://localhost:${server.address().port}`;

  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: users[0].email,
        password: DEFAULT_SEED_PASSWORD,
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody = await loginRes.json();
    assert.ok(typeof loginBody.token === "string" && loginBody.token.split(".").length === 3);

    const tasksRes = await fetch(`${baseUrl}/tasks`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    assert.equal(tasksRes.status, 200);
    const tasksBody = await tasksRes.json();
    const expectedTasks = tasks.filter((t) => t.userId === users[0].id);
    assert.deepEqual(tasksBody, expectedTasks);
  } finally {
    server.close();
  }
});

test("seedData({ userCount: 2, taskCount: 4, dataFile, tasksFile, seed: 99 }) writes exact counts and returns users without passwordHash", async () => {
  const dataFile = path.join(tempDir, "custom-users.json");
  const tasksFile = path.join(tempDir, "custom-tasks.json");

  const { users, tasks } = await seedData({
    userCount: 2,
    taskCount: 4,
    dataFile,
    tasksFile,
    seed: 99,
  });

  assert.equal(users.length, 2);
  assert.equal(tasks.length, 4);

  for (const user of users) {
    assert.ok(typeof user.id === "string" && user.id.length > 0);
    assert.ok(typeof user.email === "string" && user.email.includes("@"));
    assert.ok(typeof user.createdAt === "string");
    assert.equal(user.passwordHash, undefined);
  }
});
