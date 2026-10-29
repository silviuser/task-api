---
task: task-crud
artifact: dev-log
plan_version: 1
round: 1
status: done
---

# Development log: task-crud

One entry per increment, in commit order: a plan step, or a fix in a fix round. The code review reads the increments one by one, so each entry says what the reviewer needs to know about its commit.

## Increment 1: 1. Resolve `TD-controllers-services-F1` in `src/services/auth-service.js` and `test/auth.test.js`

- Commit: `7540c3e` refactor(auth): remove HTTP status from service domain errors
- Changes:
  - `src/services/auth-service.js`: removed `try`/`catch` setting `err.status = 409` in `registerUser` and removed `err.status = 401` in `loginUser`
  - `test/auth.test.js`: updated `auth-service` unit tests to assert `err.code`, `err.message`, and `err.status === undefined`
- Decisions: used predicate functions in `assert.rejects` (per critique suggestion) to explicitly verify `err.status === undefined`
- Tests: T9 (`test/auth.test.js` — `auth-service` unit tests check that `DUPLICATE_EMAIL` and `INVALID_CREDENTIALS` are thrown without `status`, while HTTP endpoints still return 409 and 401 via controller mapping)
- Review focus: ensure `auth-controller` still maps `DUPLICATE_EMAIL` -> 409 and `INVALID_CREDENTIALS` -> 401 while unexpected errors fall through to `errorHandler` as 500
- Deviation from the plan: none

## Increment 2: 2. Create `src/storage/task-store.js`

- Commit: `331ac76` feat(tasks): add serialized atomic JSON task store
- Changes:
  - `src/storage/task-store.js`: implemented `createTask`, `listTasks`, `getTaskById`, `updateTask`, and `deleteTask` with promise-queue serialization and atomic `.tmp` rename writes
- Decisions: cloned returned task objects with `{ ...task }` so callers cannot mutate in-memory state (`JS-8`, `DATA-2`)
- Tests: covered in Step 6 (`test/tasks.test.js` T1, T3, T4, T5, T6, T7); existing test suite (29 tests) and ESLint pass
- Review focus: promise queue serialization across read-modify-write operations (`DATA-3`, `DATA-5`) and `ENOENT` handling when `tasks.json` does not exist yet
- Deviation from the plan: none

## Increment 3: 3. Create `src/services/task-service.js`

- Commit: `6645cbf` feat(tasks): add task service domain logic
- Changes:
  - `src/services/task-service.js`: implemented `createTask`, `listTasks`, `getTaskById`, `updateTask`, and `deleteTask` with title trimming, defaults (`description: ""`, `status: "todo"`), clean patch building, and `TASK_NOT_FOUND` domain error throwing without `err.status`
- Decisions: factored `createTaskNotFoundError()` helper to build `{ code: "TASK_NOT_FOUND", message: "Task not found" }` consistently across `getTaskById`, `updateTask`, and `deleteTask`
- Tests: covered in Step 6 (`test/tasks.test.js` T1, T3, T4, T5, T6, T8); existing test suite (29 tests) and ESLint pass
- Review focus: `updateTask` only includes defined allowed fields (`title`, `description`, `status`) and `TASK_NOT_FOUND` carries no `status` property (`D10`, `D11`)
- Deviation from the plan: none

## Increment 4: 4. Create `src/controllers/task-controller.js`

- Commit: `e80674e` feat(tasks): add task controller and input validation
- Changes:
  - `src/controllers/task-controller.js`: implemented pure validators `validateCreateTaskInput` and `validateUpdateTaskInput` plus `createTaskController(options)` with `create`, `list`, `getById`, `update`, and `remove` handlers
- Decisions: exported `ALLOWED_STATUSES`, `MAX_TITLE_LENGTH`, and `MAX_DESCRIPTION_LENGTH` alongside validators and controller factory
- Tests: covered in Step 6 (`test/tasks.test.js` T1–T6, T8); existing test suite (29 tests) and ESLint pass
- Review focus: input validation checks presence, type, length bounds (`MAX_TITLE_LENGTH = 200`, `MAX_DESCRIPTION_LENGTH = 1000`), and allow-listed `status` (`SEC-9`, `API-5`), and controller maps `TASK_NOT_FOUND` to 404 while forwarding unexpected errors to `next(err)`
- Deviation from the plan: none

## Increment 5: 5. Create `src/routes/tasks.js` and mount in `src/app.js`

- Commit: `e3b0e4e` feat(tasks): add tasks router and mount at /tasks
- Changes:
  - `src/routes/tasks.js`: created `createTasksRouter(options)` binding `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, and `DELETE /:id`
  - `src/app.js`: imported `createTasksRouter` and mounted `app.use("/tasks", createTasksRouter(options))` before `notFoundHandler`
- Decisions: none
- Tests: covered in Step 6 (`test/tasks.test.js` T1–T7); existing test suite (29 tests) and ESLint pass
- Review focus: `/tasks` routes are mounted before `notFoundHandler` and pass `options` (including `tasksFile`) down to the controller
- Deviation from the plan: none

## Increment 6: 6. Add tests in `test/tasks.test.js` and manual requests in `postman/task-api.postman_collection.json`

- Commit: `bdeed1c` test(tasks): add task CRUD tests and Postman requests
- Changes:
  - `test/tasks.test.js`: created HTTP integration and unit tests covering `POST /tasks`, `GET /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id`, `DELETE /tasks/:id`, concurrent write serialization, and `task-service` / `task-controller` error handling (T1–T8)
  - `postman/task-api.postman_collection.json`: added `Tasks` folder with manual requests for create (201/400), list (200), get by ID (200/404), patch by ID (200/400/404), and delete by ID (204/404) plus `taskId` collection variable
- Decisions: used a dedicated temporary file and server instance for the concurrency test so its task count assertions stay isolated from earlier tests
- Tests: T1–T10 (all 37 tests pass across `test/tasks.test.js`, `test/auth.test.js`, `test/health.test.js`, and `test/middleware.test.js`)
- Review focus: coverage of all R1–R9 acceptance criteria, concurrency safety under `Promise.all`, and domain error separation (`err.status === undefined`)
- Deviation from the plan: none

## Commands

| Command | Result |
| --- | --- |
| test: `npm test` | 37 passed, 0 failed |
| lint: `npm run lint` | no problems |
| json: `node -e "JSON.parse(require('node:fs').readFileSync('postman/task-api.postman_collection.json', 'utf8'))"` | valid JSON |

## Notes for testing

- Start the server with `JWT_SECRET=dev-secret npm start` (or `npm run dev` with `.env`).
- Task data is persisted in `data/tasks.json` by default, or in the path given by `TASKS_FILE` / `options.tasksFile`.
- All `/tasks` endpoints are currently unauthenticated per `scope.md`; authentication and ownership checks are deferred to roadmap item 6 (`jwt-middleware-protected-tasks`).
- Manual requests are available in `postman/task-api.postman_collection.json` under the `Tasks` folder (`README.md` curl examples will be added in `task-doc-updates`).
