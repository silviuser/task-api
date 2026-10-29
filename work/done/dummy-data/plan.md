---
task: dummy-data
artifact: plan
version: 1
scope_version: 1
answers_critique_round: 0
---

# Plan: Seed script with realistic fake users and tasks

## Summary

Add a deterministic seed script (`src/seed.js`) exposed as `npm run seed` and a programmatic `seedData(options)` function using `@faker-js/faker` (`devDependencies`). By default, it writes 5 loggable fake users (cost-10 bcrypt password `"Password123!"`) and 15 fake tasks to isolated seed files (`data/seed-users.json` and `data/seed-tasks.json`, configurable via `DATA_FILE` / `TASKS_FILE` or options) (`DATA-7`). Add serialized atomic `resetUsers` and `resetTasks` helpers to `src/storage/user-store.js` and `src/storage/task-store.js` so seeding replaces target files cleanly (`DATA-1`, `DATA-3`, `DATA-5`).

## Context

- `docs/ARCHITECTURE.md`: Persistence lives behind `src/storage/user-store.js` and `src/storage/task-store.js` (`D2`, `D7`, `D13`); business logic uses `src/services/auth-service.js` and `src/services/task-service.js` (`D10`, `D11`).
- `src/storage/user-store.js` & `src/storage/task-store.js`: Both serialize operations on a module-level promise queue and write via `.tmp` file renames (`DATA-3`, `DATA-5`). Adding `resetUsers` / `resetTasks` keeps file clearing inside the storage layer (`DATA-1`).
- `src/services/auth-service.js`: `registerUser` hashes passwords with bcrypt cost 10 (`SEC-1`). Hashing the shared seed password once per `seedData` run and passing `passwordHash` to `userStore.createUser` satisfies `SEC-1` while keeping tests fast.

## Files

| # | File | Action | Purpose |
| --- | --- | --- | --- |
| 1 | `package.json` | modify | Add `"seed": "node src/seed.js"` script and `@faker-js/faker` (`^10.6.0`) in `devDependencies` |
| 2 | `package-lock.json` | modify | Lock `@faker-js/faker` version (`GIT-4`) |
| 3 | `src/storage/user-store.js` | modify | Extract internal `writeUsers(filePath, users)` and export `resetUsers(options)` for atomic replacement (`DATA-1`, `DATA-3`) |
| 4 | `src/storage/task-store.js` | modify | Export `resetTasks(options)` using existing `writeTasks(filePath, [])` inside `serialize` (`DATA-1`, `DATA-3`) |
| 5 | `src/seed.js` | create | Export `seedData(options)`, `DEFAULT_SEED_PASSWORD`, and CLI runner (`require.main === module`) |
| 6 | `test/seed.test.js` | create | Integration and CLI tests for `seedData` and `npm run seed` (`TEST-1`..`TEST-6`) |

## Steps

### Step 1. Install `@faker-js/faker` and add `npm run seed` in `package.json`

Run `npm install --save-dev @faker-js/faker@10.6.0` so `package.json` and `package-lock.json` record `@faker-js/faker` under `devDependencies` (`GIT-4`). Add `"seed": "node src/seed.js"` to `"scripts"` in `package.json`.

### Step 2. Add `resetUsers` to `src/storage/user-store.js` and `resetTasks` to `src/storage/task-store.js`

In `src/storage/user-store.js`, extract the `.tmp` write-and-rename logic into `writeUsers(filePath, users)` (`JS-4`, `DATA-3`) and export `resetUsers(options = {})` which resolves `filePath` and calls `writeUsers(filePath, [])` inside `serialize` (`DATA-1`, `DATA-2`, `DATA-5`). In `src/storage/task-store.js`, export `resetTasks(options = {})` which resolves `filePath` and calls `writeTasks(filePath, [])` inside `serialize`.

```javascript
async function writeUsers(filePath, users) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

async function resetUsers(options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    await writeUsers(filePath, []);
  });
}
```

### Step 3. Create `src/seed.js`

Import `path` (`node:path`), `bcrypt` (`bcryptjs`), `{ faker }` (`@faker-js/faker`), `userStore` (`./storage/user-store`), and `taskService` (`./services/task-service`) (`JS-6`). Define constants (`JS-1`, `JS-2`):
- `DEFAULT_USER_COUNT = 5`, `DEFAULT_TASK_COUNT = 15`, `DEFAULT_FAKER_SEED = 42`
- `DEFAULT_SEED_PASSWORD = "Password123!"`
- `TASK_STATUSES = ["todo", "in_progress", "done"]`
- `MAX_TITLE_LENGTH = 200`, `MAX_DESCRIPTION_LENGTH = 1000`

Implement `seedData(options = {})` (`JS-7`, `JS-8`, `JS-9`):
1. Resolve target paths: `dataFile = options.dataFile ?? process.env.DATA_FILE ?? path.resolve("data/seed-users.json")` and `tasksFile = options.tasksFile ?? process.env.TASKS_FILE ?? path.resolve("data/seed-tasks.json")` (`DATA-7`).
2. Seed Faker deterministically with `faker.seed(options.seed ?? DEFAULT_FAKER_SEED)`.
3. Reset both target files via `await Promise.all([userStore.resetUsers({ dataFile }), taskStore.resetTasks({ tasksFile })])` (`DATA-1`, `DATA-3`, `JS-7`).
4. Hash `options.password ?? DEFAULT_SEED_PASSWORD` once with `await bcrypt.hash(password, 10)` (`SEC-1`). Generate `userCount` (`options.userCount ?? DEFAULT_USER_COUNT`) unique lowercase emails (`faker.internet.email({ firstName, lastName }).toLowerCase()`, tracking a `Set` to guarantee uniqueness) and persist each via `await userStore.createUser({ email, passwordHash }, { dataFile })` (which strips `passwordHash` from the returned user object, `API-9`).
5. Generate `taskCount` (`options.taskCount ?? DEFAULT_TASK_COUNT`) tasks with `title` (`faker.hacker.phrase().slice(0, MAX_TITLE_LENGTH)`), `description` (`faker.lorem.sentence().slice(0, MAX_DESCRIPTION_LENGTH)`), and `status` (`TASK_STATUSES[i % TASK_STATUSES.length]` so all three statuses appear deterministically), persisting each via `await taskService.createTask(taskInput, { tasksFile })`.
6. Return `{ users, tasks, dataFile, tasksFile }`.

When `require.main === module`, invoke `seedData()` and log `Seeded ${users.length} users (${dataFile}) and ${tasks.length} tasks (${tasksFile})` without logging passwords or hashes (`SEC-10`); on error, log to `console.error` and set `process.exitCode = 1`.

```javascript
async function seedData(options = {}) {
  const dataFile = options.dataFile ?? process.env.DATA_FILE ?? path.resolve("data/seed-users.json");
  const tasksFile = options.tasksFile ?? process.env.TASKS_FILE ?? path.resolve("data/seed-tasks.json");
  const userCount = options.userCount ?? DEFAULT_USER_COUNT;
  const taskCount = options.taskCount ?? DEFAULT_TASK_COUNT;
  const password = options.password ?? DEFAULT_SEED_PASSWORD;

  faker.seed(options.seed ?? DEFAULT_FAKER_SEED);
  await Promise.all([userStore.resetUsers({ dataFile }), taskStore.resetTasks({ tasksFile })]);

  const passwordHash = await bcrypt.hash(password, 10);
  const users = [];
  for (let i = 0; i < userCount; i += 1) {
    const email = generateUniqueEmail(usedEmails);
    users.push(await userStore.createUser({ email, passwordHash }, { dataFile }));
  }
  // ... generate and create tasks via taskService.createTask(..., { tasksFile })
  return { users, tasks, dataFile, tasksFile };
}
```

### Step 4. Create `test/seed.test.js`

Write isolated tests using a temporary directory (`fs.mkdtemp`) (`TEST-1`..`TEST-6`):
- Verify `seedData` with custom `userCount`, `taskCount`, `dataFile`, `tasksFile`, and `seed` generates valid, repeatable users and tasks without `passwordHash` in returned objects (`R4`, `R6`, `API-9`).
- Verify running `seedData` again on populated files replaces existing records rather than appending (`R3`).
- Verify default path resolution writes to `data/seed-users.json` and `data/seed-tasks.json` (executed in a temporary working directory or inspected after cleanup) without touching `data/users.json` or `data/tasks.json` (`R2`, `DATA-7`).
- Start the Express app with the seeded `dataFile` and `tasksFile`, verify `POST /auth/login` with a seeded user's email and `DEFAULT_SEED_PASSWORD` returns 200 `{ token }`, and `GET /tasks` returns the seeded tasks (`R5`, `TEST-2`).
- Run `node src/seed.js` as a child process (`node:child_process.execFile`) with `DATA_FILE` and `TASKS_FILE` in the temp dir, asserting exit code 0 and summary output free of `Password123!` or `$2b$` (`R1`, `SEC-10`).

## Interfaces and data

- CLI command: `npm run seed` (`node src/seed.js`)
  - Environment overrides: `DATA_FILE` (default `data/seed-users.json`), `TASKS_FILE` (default `data/seed-tasks.json`).
  - Stdout: `Seeded <userCount> users (<dataFile>) and <taskCount> tasks (<tasksFile>)`.
- Programmatic API (`src/seed.js`):
  - `seedData(options?: { userCount?: number, taskCount?: number, seed?: number, password?: string, dataFile?: string, tasksFile?: string }) => Promise<{ users: Array<{ id, email, createdAt }>, tasks: Array<Task>, dataFile: string, tasksFile: string }>`
  - `DEFAULT_SEED_PASSWORD = "Password123!"`
- Storage additions:
  - `userStore.resetUsers(options?: string | { dataFile?: string }) => Promise<void>`
  - `taskStore.resetTasks(options?: string | { tasksFile?: string }) => Promise<void>`
- New dependencies: `@faker-js/faker` (`^10.6.0`) in `devDependencies` (0 new production runtime dependencies).

## Tests

| ID | File | Checks | Requirement | New / existing |
| --- | --- | --- | --- | --- |
| T1 | `test/seed.test.js` | Running `src/seed.js` via CLI exits 0, writes seed files, and prints a summary without passwords or hashes (`SEC-10`) | R1 | new |
| T2 | `test/seed.test.js` | Default `seedData()` targets `data/seed-users.json` and `data/seed-tasks.json` without creating or modifying `data/users.json` or `data/tasks.json` (`DATA-7`) | R2 | new |
| T3 | `test/seed.test.js` | Running `seedData()` twice on pre-populated files atomically replaces contents with deterministic 5 users and 15 tasks across `"todo"`, `"in_progress"`, `"done"` (`DATA-1`, `DATA-3`) | R3, R4 | new |
| T4 | `test/seed.test.js` | `POST /auth/login` with a seeded user's email and `"Password123!"` returns 200 with a JWT, and `GET /tasks` returns the seeded tasks (`SEC-1`) | R5 | new |
| T5 | `test/seed.test.js` | `seedData({ userCount: 2, taskCount: 4, dataFile, tasksFile, seed: 99 })` writes exact counts and returns `{ users, tasks }` without `passwordHash` (`API-9`) | R6 | new |
| T6 | `test/health.test.js`, `test/middleware.test.js`, `test/auth.test.js`, `test/tasks.test.js` | All existing test suites continue passing (`TEST-7`) | R1–R6 | existing |

Commands:
- `npm test` (runs all unit and HTTP tests in `test/*.test.js` and exits 0)
- `npm run lint` (ESLint reports 0 problems)
- `npm run seed` (creates `data/seed-users.json` and `data/seed-tasks.json` and exits 0)

## Placeholders and tech debt

| Placeholder | Why | Removed by |
| --- | --- | --- |
| None | No placeholders needed; `userId` on tasks is out of scope until `task-authorization` | - |

## Size

- Production code: about 95 changed lines in 3 files (`src/storage/user-store.js`, `src/storage/task-store.js`, `src/seed.js`) plus `package.json`; new runtime dependencies: none (`@faker-js/faker` is in `devDependencies`).
- Increment budget: fits (<= 300 lines, <= 10 files, 0 new runtime dependencies).

## Risks

- `@faker-js/faker` is published as ESM: Node.js 22+ natively supports `require("@faker-js/faker")` via `require(esm)`; verified compatible with CommonJS and ESLint in this environment.
- Default `seedData()` writing to workspace `data/seed-*.json` during tests: mitigated by passing temporary `dataFile`/`tasksFile` paths in tests (`TEST-4`) and running the default-path test with `process.chdir(tempDir)`.
