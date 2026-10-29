---
task: task-authorization
artifact: dev-log
plan_version: 1
round: 1
status: done
---

# Development log: task-authorization

One entry per increment, in commit order: a plan step, or a fix in a fix round. The code review reads the increments one by one, so each entry says what the reviewer needs to know about its commit.

## Increment 1: 1. Create `src/middleware/authenticate.js` and wire `jwtSecret` in `src/app.js` and `src/routes/tasks.js`

- Commit: `8cd30e0` feat(auth): add Bearer JWT authentication middleware and protect /tasks
- Changes:
  - `src/middleware/authenticate.js`: created `createAuthenticate(options)` verifying `Authorization: Bearer <token>` with `jwt.verify(..., { algorithms: ["HS256"] })`, validating non-empty string `payload.sub`, setting `req.user = { sub, email }`, and returning `401` `{ error }` on missing/malformed headers or invalid/expired tokens
  - `src/app.js`: passed `{ ...options, jwtSecret }` to `createTasksRouter`
  - `src/routes/tasks.js`: mounted `router.use(createAuthenticate(options))` before `/tasks` route handlers
  - `test/tasks.test.js`: added `signToken` / `authHeaders` helpers and attached Bearer tokens to existing `/tasks` requests
  - `test/seed.test.js`: passed `Authorization: Bearer ${loginBody.token}` on the existing `GET /tasks` request
- Decisions: checked `payload.sub.trim() === ""` in addition to `typeof payload.sub !== "string"` so tokens with blank `sub` claims are rejected with 401
- Tests: existing test suite (42 tests) updated to send Bearer tokens on `/tasks` requests and passes; full 401 test cases (T1) added in Step 5
- Review focus: `algorithms: ["HS256"]` pinning in `jwt.verify` (`SEC-3`), `Authorization: Bearer <token>` parsing (`SEC-4`), and standard `{ error }` 401 responses (`API-3`, `API-4`)
- Deviation from the plan: included the Bearer header updates on existing `/tasks` calls in `test/tasks.test.js` and `test/seed.test.js` from Step 5 in Step 1 so `npm test` continues to pass after this commit (`GIT-3`)

## Increment 2: 2. Update `src/storage/task-store.js` and `src/services/task-service.js` for `userId` and ownership

- Commit: `8847d9c` feat(tasks): add userId persistence, user filtering, and ownership checks
- Changes:
  - `src/storage/task-store.js`: stored `userId` (when defined) on created task records in `createTask` and filtered by `options.userId` in `listTasks` before shallow cloning
  - `src/services/task-service.js`: added `createTaskForbiddenError()` (`code: "TASK_FORBIDDEN"`, no `status`), passed `userId` in `createTask` and `listTasks`, and verified existence (404 `TASK_NOT_FOUND`) then ownership (403 `TASK_FORBIDDEN`) in `getTaskById`, `updateTask`, and `deleteTask`
- Decisions: omitted `userId` property when `userId === undefined` (`...(userId !== undefined ? { userId } : {})`) so in-memory task objects match JSON-serialized objects when callers omit `userId`; normalized optional `(userId, options)` arguments when `typeof userId === "object"` for backwards-compatible direct calls
- Tests: existing test suite (42 tests) and ESLint pass; ownership and `TASK_FORBIDDEN` tests added in Step 5
- Review focus: `getTaskById` checks `!task` (`TASK_NOT_FOUND`) before `task.userId !== userId` (`TASK_FORBIDDEN`) so missing tasks always report 404 while another user's tasks report 403 without modifying storage (`SEC-5`, `D15`)
- Deviation from the plan: none

## Increment 3: 3. Add allow-list body validation, UUIDv4 `:id` validation, and 403 mapping in `src/controllers/task-controller.js`

- Commit: `b495765` feat(tasks): enforce allow-list body fields, UUIDv4 id check, and 403 mapping
- Changes:
  - `src/controllers/task-controller.js`: added `ALLOWED_TASK_FIELDS`, `UUID_V4_REGEX`, and exported `isValidTaskId(id)`; rejected unknown body keys with `"unknown field: <key>"` in `validateCreateTaskInput` and `validateUpdateTaskInput`; validated `req.params.id` with `isValidTaskId` (400 `"Invalid task id"`) in `getById`, `update`, and `remove`; passed `req.user.sub` to `taskService`; mapped `TASK_FORBIDDEN` to 403 `{ error: err.message }`
  - `test/tasks.test.js`: updated existing CRUD tests whose assertions changed (persisted `userId`, UUIDv4 404 lookups, unknown field rejection message, and `req.user` in direct `controller.list` unit test)
  - `test/seed.test.js`: updated `GET /tasks` assertion to compare against tasks matching `users[0].id`
- Decisions: checked `isValidTaskId(req.params.id)` at the start of `getById`, `update`, and `remove` so malformed `:id` parameters return 400 before body validation or storage queries
- Tests: existing test suite (42 tests) and ESLint pass; dedicated 401/403/400 tests added in Step 5
- Review focus: allow-list validation rejecting unknown or protected fields (`userId`, `id`, `createdAt`) (`SEC-9`, `API-5`), UUIDv4 format check before storage (`SEC-9`), and `TASK_FORBIDDEN` -> 403 vs `TASK_NOT_FOUND` -> 404 controller mapping (`API-3`, `SEC-5`)
- Deviation from the plan: included the existing test updates in `test/tasks.test.js` and `test/seed.test.js` from Step 5 in Step 3 so `npm test` continues to pass after this commit (`GIT-3`)

## Increment 4: 4. Assign deterministic `userId` in `src/seed.js`

- Commit: `c377940` feat(seed): assign deterministic userId ownership to seeded tasks
- Changes:
  - `src/seed.js`: assigned `userId = users.length > 0 ? users[i % users.length].id : undefined` and passed `{ title, description, status, userId }` to `taskService.createTask`
- Decisions: guarded `users.length > 0` before indexing `users[i % users.length].id` so `seedData({ userCount: 0, taskCount: ... })` does not throw
- Tests: existing test suite (42 tests) and ESLint pass; explicit seed ownership assertions (`T8`) added in Step 5
- Review focus: deterministic round-robin `userId` assignment across seeded users (`DATA-7`)
- Deviation from the plan: none

## Increment 5: 5. Update `test/tasks.test.js`, `test/seed.test.js`, and `postman/task-api.postman_collection.json`

- Commit: `10f106c` test(tasks): add auth, ownership, validation tests and update Postman collection
- Changes:
  - `test/tasks.test.js`: added automated tests for 401 authentication failures across all `/tasks` endpoints and token failure modes (T1), user-isolated `GET /tasks` (T3), 403 vs 404 ownership on `GET`/`PATCH`/`DELETE /tasks/:id` without modifying data (T4), 400 on unknown/protected fields (T5), 400 on non-UUIDv4 `:id` values (T6), and `TASK_FORBIDDEN` + `isValidTaskId` unit checks (T7)
  - `test/seed.test.js`: asserted `task.userId === users[i % users.length].id` for every seeded task and verified `GET /tasks` returns only the logged-in user's 2 seeded tasks (T8)
  - `postman/task-api.postman_collection.json`: added `token` collection variable, updated `taskId` default and `Not Found (404)` URLs to UUIDv4 `00000000-0000-4000-8000-000000000000`, added `Authorization: Bearer {{token}}` headers to all `/tasks` requests, and added `List Tasks - Unauthorized (401)` and `Get Task by ID - Forbidden (403)` requests
- Decisions: updated the Postman `taskId` variable and `Not Found (404)` request URLs from the nil UUID to a valid UUIDv4 (`00000000-0000-4000-8000-000000000000`) per the critique suggestion so 404 requests pass `isValidTaskId`
- Tests: T1–T9 (all 47 tests pass across `test/tasks.test.js`, `test/seed.test.js`, `test/auth.test.js`, `test/health.test.js`, and `test/middleware.test.js`)
- Review focus: coverage of all R1–R8 acceptance criteria, algorithm-confusion (`alg: "none"`, `HS384`) and missing-`sub` token rejection, and preservation of owner data after 403 attempts
- Deviation from the plan: existing test updates needed to keep `npm test` passing after Steps 1 and 3 were committed in Increments 1 and 3 (`GIT-3`)

## Commands

| Command | Result |
| --- | --- |
| test: `npm test` | 47 passed, 0 failed |
| lint: `npm run lint` | no problems |
| json: `node -e "JSON.parse(require('node:fs').readFileSync('postman/task-api.postman_collection.json', 'utf8'))"` | valid JSON |

## Notes for testing

- Start the server with `JWT_SECRET=dev-secret-key npm start` (or `npm run dev` with `.env`).
- All `/tasks` endpoints now require `Authorization: Bearer <jwt>` obtained from `POST /auth/login`.
- `POST /tasks` and `PATCH /tasks/:id` accept only `title`, `description`, and `status` and return `400 { "error": "unknown field: <key>" }` for any other key (such as `userId`, `id`, or `createdAt`).
- `:id` route parameters on `/tasks/:id` must be valid UUIDv4 strings; non-UUIDv4 values return `400 { "error": "Invalid task id" }`.
- Accessing, updating, or deleting another user's task returns `403 { "error": "Forbidden" }`; a non-existent UUIDv4 returns `404 { "error": "Task not found" }`.
- `npm run seed` populates 5 users (`data/seed-users.json`, password `Password123!`) and 15 tasks (`data/seed-tasks.json`) distributed deterministically across those 5 users (3 tasks per user).
- Repeatable manual requests are in `postman/task-api.postman_collection.json` (`README.md` curl examples will be updated in `task-doc-updates`).





