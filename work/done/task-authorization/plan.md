---
task: task-authorization
artifact: plan
version: 1
scope_version: 1
answers_critique_round: 0
---

# Plan: Task authentication, per-user authorization, and stricter validation

## Summary

Protect all `/tasks` endpoints with a Bearer JWT authentication middleware (`src/middleware/authenticate.js`, `HS256`), scope task creation and listing to `req.user.sub` (`userId`), and enforce task ownership on `GET /tasks/:id`, `PATCH /tasks/:id`, and `DELETE /tasks/:id` (returning 403 `Forbidden` when owned by another user and 404 when missing). Enforce strict allow-list validation on task request bodies (rejecting unknown or protected fields with 400) and UUIDv4 format validation on `:id` route parameters before querying storage, assign deterministic `userId` ownership in `src/seed.js`, and update automated tests and Postman requests.

## Context

- `docs/ARCHITECTURE.md`: Layers (`routes` -> `controllers` -> `services` -> `storage`) follow `D10`, `D11`, and `D15` (controllers validate HTTP input and map domain `err.code` values to HTTP status codes; services never see `req`/`res` and never set `err.status`).
- `src/services/auth-service.js`: Issues `HS256` JWTs with `{ sub: user.id, email: user.email }` signed with `options.jwtSecret` (`D8`, `SEC-3`).
- `src/controllers/task-controller.js`, `src/services/task-service.js`, `src/storage/task-store.js`: Current unauthenticated CRUD implementation to extend with `userId`, ownership checks, unknown-field rejection, and UUIDv4 `:id` validation (`API-3`..`API-5`, `DATA-5`, `DATA-6`, `SEC-4`, `SEC-5`, `SEC-9`).
- `src/seed.js`: Seeds 5 users and 15 tasks; tasks currently lack `userId` (`DATA-7`).
- `postman/task-api.postman_collection.json`: Holds repeatable manual API requests (`TEST-8`); `README.md` is updated in `task-doc-updates` (`AGENTS.md`).

## Files

| # | File | Action | Purpose |
| --- | --- | --- | --- |
| 1 | `src/middleware/authenticate.js` | create | `createAuthenticate(options)` middleware verifying `Authorization: Bearer <token>` (`HS256`) and setting `req.user` (`SEC-3`, `SEC-4`) |
| 2 | `src/app.js` | modify | Pass `{ ...options, jwtSecret }` to `createTasksRouter` (`SEC-6`) |
| 3 | `src/routes/tasks.js` | modify | Mount `createAuthenticate(options)` on the `/tasks` router (`SEC-4`) |
| 4 | `src/controllers/task-controller.js` | modify | Reject unknown body fields, validate UUIDv4 `:id`, pass `req.user.sub` to `taskService`, and map `TASK_FORBIDDEN` to 403 (`API-3`, `API-5`, `SEC-5`, `SEC-9`) |
| 5 | `src/services/task-service.js` | modify | Pass `userId` on create/list, enforce task ownership in `getTaskById`, `updateTask`, and `deleteTask`, and throw `TASK_FORBIDDEN` (`D15`, `SEC-5`) |
| 6 | `src/storage/task-store.js` | modify | Persist `userId` in `createTask` and filter by `userId` in `listTasks` when provided (`DATA-1`, `DATA-2`, `DATA-5`) |
| 7 | `src/seed.js` | modify | Assign deterministic `userId: users[i % users.length].id` to each seeded task (`DATA-7`) |
| 8 | `test/tasks.test.js` | modify | Update existing CRUD tests to send Bearer tokens and add auth (401), ownership (403), unknown-field (400), and invalid-UUID (400) tests (`TEST-1`..`TEST-7`) |
| 9 | `test/seed.test.js` | modify | Update seed tests to verify `task.userId` ownership and pass Bearer token on `GET /tasks` (`TEST-7`) |
| 10 | `postman/task-api.postman_collection.json` | modify | Add `Authorization: Bearer {{token}}` to task requests, add 401/403 requests, and define `token` collection variable (`TEST-8`) |

## Steps

### Step 1. Create `src/middleware/authenticate.js` and wire `jwtSecret` in `src/app.js` and `src/routes/tasks.js`

Create `src/middleware/authenticate.js` exporting `createAuthenticate(options = {})` (`SEC-3`, `SEC-4`, `API-3`, `API-4`, `JS-4`, `JS-6`). Extract `req.headers.authorization`; if missing, not a string, or not matching `/^Bearer (\S+)$/`, respond `401 { error: "Authentication required" }`. Verify the token synchronously or inside `try`/`catch` with `jwt.verify(token, options.jwtSecret, { algorithms: ["HS256"] })`; if verification throws or `!payload || typeof payload !== "object" || typeof payload.sub !== "string"`, respond `401 { error: "Invalid or expired token" }`. Set `req.user = { sub: payload.sub, email: payload.email }` and call `next()`.
In `src/app.js`, change `createTasksRouter(options)` to `createTasksRouter({ ...options, jwtSecret })`. In `src/routes/tasks.js`, mount `router.use(createAuthenticate(options))` before the route handlers.

```javascript
function createAuthenticate(options = {}) {
  return function authenticate(req, res, next) {
    const header = req.headers.authorization;
    const match = typeof header === "string" ? /^Bearer (\S+)$/.exec(header) : null;
    if (!match) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const payload = jwt.verify(match[1], options.jwtSecret, { algorithms: ["HS256"] });
      if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      req.user = { sub: payload.sub, email: payload.email };
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}
```

### Step 2. Update `src/storage/task-store.js` and `src/services/task-service.js` for `userId` and ownership

In `src/storage/task-store.js` (`DATA-1`, `DATA-2`, `DATA-5`, `JS-8`):
- Update `createTask({ title, description, status, userId }, options = {})` to store `userId` on the created task object (`{ id: crypto.randomUUID(), userId, title, description, status, createdAt: now, updatedAt: now }`).
- Update `listTasks(options = {})`: when `options.userId !== undefined`, filter stored tasks with `tasks.filter((t) => t.userId === String(options.userId))` before cloning.

In `src/services/task-service.js` (`D10`, `D11`, `D15`, `SEC-5`):
- Add `createTaskForbiddenError()` returning `new Error("Forbidden")` with `err.code = "TASK_FORBIDDEN"` (and no `err.status`).
- In `createTask(data, options = {})`, pass `userId: data.userId` to `taskStore.createTask`.
- In `listTasks(userId, options = {})` (supporting `(options)` when `typeof userId === "object"` for backwards-compatible option passing or explicit `userId`), pass `{ ...options, userId }` to `taskStore.listTasks`.
- In `getTaskById(id, userId, options = {})`, fetch the task via `taskStore.getTaskById(id, options)`; if `!task`, throw `createTaskNotFoundError()`; if `task.userId !== userId`, throw `createTaskForbiddenError()`; return `task`.
- In `updateTask(id, updates, userId, options = {})` and `deleteTask(id, userId, options = {})`, first call `await getTaskById(id, userId, options)` to verify existence (404) and ownership (403) before modifying or deleting the task in `taskStore`.

```javascript
async function getTaskById(id, userId, options = {}) {
  const task = await taskStore.getTaskById(id, options);
  if (!task) {
    throw createTaskNotFoundError();
  }
  if (task.userId !== userId) {
    throw createTaskForbiddenError();
  }
  return task;
}
```

### Step 3. Add allow-list body validation, UUIDv4 `:id` validation, and 403 mapping in `src/controllers/task-controller.js`

In `src/controllers/task-controller.js` (`API-3`, `API-4`, `API-5`, `SEC-5`, `SEC-9`, `JS-1`, `JS-8`):
- Define `ALLOWED_TASK_FIELDS = ["title", "description", "status"]` and `UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
- Export `isValidTaskId(id)` returning `typeof id === "string" && UUID_V4_REGEX.test(id)`.
- In both `validateCreateTaskInput(body)` and `validateUpdateTaskInput(body)`, after verifying `body` is a plain object, check `Object.keys(body).find((key) => !ALLOWED_TASK_FIELDS.includes(key))`; if an unknown key is found, return `"unknown field: ${unknownKey}"`.
- In `create`, call `taskService.createTask({ ...req.body, userId: req.user.sub }, options)`.
- In `list`, call `taskService.listTasks(req.user.sub, options)`.
- In `getById`, `update`, and `remove`, check `if (!isValidTaskId(req.params.id)) return res.status(400).json({ error: "Invalid task id" })` before calling `taskService` (and before body validation or right at the start of the handler so invalid `:id` always returns 400 before storage). Pass `req.user.sub` to `taskService.getTaskById`, `taskService.updateTask`, and `taskService.deleteTask`. Map `err.code === "TASK_FORBIDDEN"` to `res.status(403).json({ error: err.message })` alongside `TASK_NOT_FOUND` -> `404`.

```javascript
const unknownKey = Object.keys(body).find((key) => !ALLOWED_TASK_FIELDS.includes(key));
if (unknownKey !== undefined) {
  return `unknown field: ${unknownKey}`;
}
```

### Step 4. Assign deterministic `userId` in `src/seed.js`

In `src/seed.js` (`DATA-7`), when creating tasks in `seedData(options)`, assign each task `userId: users[i % users.length].id` and pass `{ title, description, status, userId }` to `taskService.createTask`. Guard with `const userId = users.length > 0 ? users[i % users.length].id : undefined` in case `userCount: 0` is ever passed.

### Step 5. Update `test/tasks.test.js`, `test/seed.test.js`, and `postman/task-api.postman_collection.json`

- In `test/tasks.test.js` (`TEST-1`..`TEST-7`), sign test Bearer tokens using `jwt.sign({ sub: userId, email }, TEST_JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" })` for two users (`userA`, `userB`). Update existing CRUD tests (whose requirements changed to require auth, include `userId`, reject unknown fields, and require UUIDv4 `:id`) and add tests for 401 (missing/malformed/wrong-secret/wrong-alg/expired token), 403 vs 404 ownership on `GET`/`PATCH`/`DELETE /tasks/:id`, user-isolated `GET /tasks`, 400 on unknown/protected fields (`userId`, `id`, `extraField`), and 400 on non-UUID `:id`.
- In `test/seed.test.js` (`TEST-7`), assert every seeded task has `userId: users[i % users.length].id`, and pass `Authorization: Bearer ${loginBody.token}` on `GET /tasks`, asserting it returns only the tasks belonging to `users[0].id`.
- In `postman/task-api.postman_collection.json` (`TEST-8`), add a `token` collection variable, add `Authorization: Bearer {{token}}` header to all `Tasks` requests, and add `List Tasks - Unauthorized (401)` and `Get Task by ID - Forbidden (403)` requests.

## Interfaces and data

| Method | Path | Headers | Request body | Success | Errors |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/tasks` | `Authorization: Bearer <jwt>` | `{ title, description?, status? }` (strict allow-list) | `201` + `Location: /tasks/:id` + Task JSON | `400 { error }`, `401 { error }` |
| `GET` | `/tasks` | `Authorization: Bearer <jwt>` | none | `200` `[Task, ...]` (only `task.userId === req.user.sub`) | `401 { error }` |
| `GET` | `/tasks/:id` | `Authorization: Bearer <jwt>` | none | `200` Task JSON | `400`, `401`, `403`, `404` |
| `PATCH` | `/tasks/:id` | `Authorization: Bearer <jwt>` | subset of `{ title, description, status }` (strict allow-list) | `200` Task JSON | `400`, `401`, `403`, `404` |
| `DELETE` | `/tasks/:id` | `Authorization: Bearer <jwt>` | none | `204` (empty body) | `400`, `401`, `403`, `404` |

Task entity in `data/tasks.json`:
`{ id: string (UUIDv4), userId: string (UUIDv4), title: string (1..200 chars), description: string (0..1000 chars, default ""), status: "todo" | "in_progress" | "done" (default "todo"), createdAt: string (ISO 8601), updatedAt: string (ISO 8601) }`.
New runtime dependencies: none.

## Tests

| ID | File | Checks | Requirement | New / existing |
| --- | --- | --- | --- | --- |
| T1 | `test/tasks.test.js` | Requests to `/tasks` without header, with non-Bearer header, malformed token, wrong secret, `none`/wrong algorithm, or expired token return 401 `{ error }` | R1 | new |
| T2 | `test/tasks.test.js` | `POST /tasks` with valid Bearer token returns 201 and persists `userId: req.user.sub` | R1, R2 | existing (modified) |
| T3 | `test/tasks.test.js` | `GET /tasks` returns only tasks where `task.userId === req.user.sub` when multiple users have tasks | R3 | existing (modified) |
| T4 | `test/tasks.test.js` | `GET /tasks/:id`, `PATCH /tasks/:id`, and `DELETE /tasks/:id` return 200/204 for owner, 403 `{ error: "Forbidden" }` for another user (without modifying data), and 404 for a non-existent UUIDv4 | R4 | new & modified |
| T5 | `test/tasks.test.js` | `POST /tasks` and `PATCH /tasks/:id` reject bodies with unknown or protected fields (`userId`, `id`, `createdAt`, `extraField`) with 400 `{ error: "unknown field: <key>" }` | R5 | existing (modified) |
| T6 | `test/tasks.test.js` | `GET /tasks/:id`, `PATCH /tasks/:id`, and `DELETE /tasks/:id` with non-UUIDv4 `:id` return 400 `{ error: "Invalid task id" }` | R6 | new |
| T7 | `test/tasks.test.js` | Unit checks: `task-service` throws `TASK_NOT_FOUND` and `TASK_FORBIDDEN` without `err.status`; concurrent `POST`/`PATCH` calls serialize safely | R4 | existing (modified) |
| T8 | `test/seed.test.js` | `seedData()` assigns deterministic `userId` from seeded users to every task, and authenticated `GET /tasks` returns only the logged-in seeded user's tasks | R7, R8 | existing (modified) |
| T9 | `test/auth.test.js`, `test/health.test.js`, `test/middleware.test.js` | Existing auth, health, and middleware suites pass unchanged | R8 | existing |

Commands:
- `npm test` (runs all `node:test` suites and exits 0)
- `npm run lint` (runs ESLint with 0 warnings/errors)
- `node -e "JSON.parse(require('node:fs').readFileSync('postman/task-api.postman_collection.json', 'utf8'))"` (validates Postman collection JSON for R8; `README.md` curl examples are updated in `task-doc-updates`)

## Placeholders and tech debt

| Placeholder | Why | Removed by |
| --- | --- | --- |
| None | No placeholders or shortcuts needed | - |

## Size

- Production code: about 140 changed lines in 7 files (`src/middleware/authenticate.js`, `src/app.js`, `src/routes/tasks.js`, `src/controllers/task-controller.js`, `src/services/task-service.js`, `src/storage/task-store.js`, `src/seed.js`); new runtime dependencies: none.
- Increment budget: fits (<= 300 lines, <= 10 files, 0 new runtime dependencies).

## Risks

- Existing tests in `test/tasks.test.js` and `test/seed.test.js` send unauthenticated requests, pass `"non-existent-id"` instead of a UUIDv4, or assert that unknown fields are ignored: mitigated by updating those assertions in Step 5 to match the new requirements (`R1`..`R7`, `TEST-7`).
- `README.md` manual curl examples mentioned in R8 belong to `task-doc-updates` per `AGENTS.md`: mitigated by updating `postman/task-api.postman_collection.json` during `task-development` and updating `README.md` in `task-doc-updates`.
