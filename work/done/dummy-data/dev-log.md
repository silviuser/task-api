---
task: dummy-data
artifact: dev-log
plan_version: 1
round: 1
status: done
---

# Development log: dummy-data

One entry per increment, in commit order: a plan step, or a fix in a fix round. The code review reads the increments one by one, so each entry says what the reviewer needs to know about its commit.

## Increment 1: 1. Install `@faker-js/faker` and add `npm run seed` in `package.json`

- Commit: `3a3e695` chore(seed): add @faker-js/faker dev dependency and seed script
- Changes:
  - `package.json`: added `"seed": "node src/seed.js"` to `scripts` and `"@faker-js/faker": "^10.6.0"` to `devDependencies`
  - `package-lock.json`: locked `@faker-js/faker@10.6.0` (`GIT-4`)
- Decisions: none
- Tests: T6 (existing 37 tests across `test/*.test.js` continue passing)
- Review focus: `@faker-js/faker` placed in `devDependencies` so 0 new production runtime dependencies are added
- Deviation from the plan: none

## Increment 2: 2. Add `resetUsers` to `src/storage/user-store.js` and `resetTasks` to `src/storage/task-store.js`

- Commit: `ad4c3f4` feat(storage): add resetUsers and resetTasks helpers
- Changes:
  - `src/storage/user-store.js`: extracted `writeUsers(filePath, users)` for atomic `.tmp` write-and-rename and exported `resetUsers(options)` inside `serialize` (`DATA-1`, `DATA-3`, `DATA-5`)
  - `src/storage/task-store.js`: exported `resetTasks(options)` calling `writeTasks(filePath, [])` inside `serialize` (`DATA-1`, `DATA-3`, `DATA-5`)
- Decisions: none
- Tests: T6 (existing 37 tests pass; `resetUsers` and `resetTasks` are covered directly by `test/seed.test.js` in Increment 4)
- Review focus: both reset helpers run inside each store's `serialize` queue and use atomic `.tmp` renames
- Deviation from the plan: none

## Increment 3: 3. Create `src/seed.js`

- Commit: `a8b7ee2` feat(seed): add deterministic seedData helper and CLI runner
- Changes:
  - `src/seed.js`: created `seedData(options)`, `DEFAULT_SEED_PASSWORD`, `generateUniqueEmail(usedEmails)`, and CLI runner (`require.main === module`)
- Decisions: imported `taskStore = require("./storage/task-store")` alongside `userStore` and `taskService` (as noted in `critique.md` suggestions) so `seedData` can invoke `taskStore.resetTasks({ tasksFile })` directly
- Tests: T6 (existing 37 tests pass; `src/seed.js` unit, HTTP, and CLI tests are added in Increment 4)
- Review focus: bcrypt cost 10 hash computed once per run (`SEC-1`), `passwordHash` omitted from returned user objects (`API-9`), no passwords or hashes in CLI stdout (`SEC-10`), default target paths isolated in `data/seed-users.json` and `data/seed-tasks.json` (`DATA-7`)
- Deviation from the plan: none

## Increment 4: 4. Create `test/seed.test.js`

- Commit: `5a25c8b` test(seed): add CLI, storage replacement, and HTTP integration tests
- Changes:
  - `test/seed.test.js`: created 5 integration and CLI tests using temporary directories (`TEST-1`..`TEST-6`)
- Decisions: tested default path resolution (`data/seed-users.json` and `data/seed-tasks.json`) inside an isolated temporary working directory (`process.chdir`) with `try`/`finally` restoration so workspace `data/` is untouched during `npm test` (`TEST-4`, `DATA-7`)
- Tests:
  - T1: running `src/seed.js` via CLI (`execFile`) exits 0, writes seed files, and prints a summary without passwords or hashes (`R1`, `SEC-10`)
  - T2: default `seedData()` targets `data/seed-users.json` and `data/seed-tasks.json` without creating `data/users.json` or `data/tasks.json` (`R2`, `DATA-7`)
  - T3: running `seedData()` twice on pre-populated files atomically replaces contents with deterministic 5 users and 15 tasks across `"todo"`, `"in_progress"`, `"done"` (`R3`, `R4`, `DATA-1`, `DATA-3`)
  - T4: `POST /auth/login` with a seeded user's email and `DEFAULT_SEED_PASSWORD` returns 200 with a JWT, and `GET /tasks` returns the seeded tasks (`R5`, `SEC-1`, `TEST-2`)
  - T5: `seedData({ userCount: 2, taskCount: 4, dataFile, tasksFile, seed: 99 })` writes exact counts and returns users without `passwordHash` (`R6`, `API-9`)
  - T6: all 37 existing tests in `test/health.test.js`, `test/middleware.test.js`, `test/auth.test.js`, and `test/tasks.test.js` continue passing (42 total)
- Review focus: test isolation (`TEST-4`) and verification of `POST /auth/login` + `GET /tasks` against seeded files
- Deviation from the plan: none

## Commands

| Command | Result |
| --- | --- |
| test: `npm test` | 42 passed, 0 failed |
| lint: `npm run lint` | no problems |

## Notes for testing

- Run `npm run seed` to generate 5 fake users in `data/seed-users.json` and 15 fake tasks in `data/seed-tasks.json` (or override paths via `DATA_FILE` and `TASKS_FILE`).
- Start the API against the seeded data with `DATA_FILE=data/seed-users.json TASKS_FILE=data/seed-tasks.json JWT_SECRET=dev-secret npm start`.
- Every seeded user can log in via `POST /auth/login` using their email from `data/seed-users.json` and password `"Password123!"` (`DEFAULT_SEED_PASSWORD`).
- Tasks do not carry a `userId` field yet; per-user ownership is deferred to `task-authorization`.
