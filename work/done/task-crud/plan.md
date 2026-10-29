---
task: task-crud
artifact: plan
version: 1
scope_version: 1
answers_critique_round: 0
---

# Plan: Task CRUD without authentication

## Summary

Add unauthenticated CRUD endpoints (`POST /tasks`, `GET /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id`, `DELETE /tasks/:id`) backed by a serialized, atomic JSON storage module (`src/storage/task-store.js`) using `TASKS_FILE` (default `data/tasks.json`). Resolve `TD-controllers-services-F1` by removing `err.status` assignments from `src/services/auth-service.js` so that services set `err.code` only and controllers map domain codes (`DUPLICATE_EMAIL`, `INVALID_CREDENTIALS`, `TASK_NOT_FOUND`) to HTTP statuses. Add automated tests in `test/tasks.test.js`, update `test/auth.test.js`, and add manual `/tasks` requests to `postman/task-api.postman_collection.json`.

## Context

- `docs/ARCHITECTURE.md`: Layers (`routes` -> `controllers` -> `services` -> `storage`) follow `D10` and `D11` (plain/factory functions, validation in controllers, services free of `req`/`res`).
- `src/storage/user-store.js`: Reference pattern for promise-serialized atomic `.tmp` file writes (`DATA-1`, `DATA-2`, `DATA-3`, `DATA-5`, `D7`).
- `src/services/auth-service.js` & `docs/TECH_DEBT.md`: `TD-controllers-services-F1` requires removing `err.status` from services (`API-6`).
- `postman/task-api.postman_collection.json`: Holds repeatable manual API requests (`TEST-8`); `README.md` is updated in `task-doc-updates` (`AGENTS.md`).

## Files

| # | File | Action | Purpose |
| --- | --- | --- | --- |
| 1 | `src/storage/task-store.js` | create | Serialized atomic JSON persistence for tasks (`createTask`, `listTasks`, `getTaskById`, `updateTask`, `deleteTask`) |
| 2 | `src/services/task-service.js` | create | Task domain logic and `TASK_NOT_FOUND` error throwing without Express dependencies |
| 3 | `src/controllers/task-controller.js` | create | Input validation (`validateCreateTaskInput`, `validateUpdateTaskInput`) and HTTP formatting/error mapping |
| 4 | `src/routes/tasks.js` | create | `createTasksRouter(options)` binding `/tasks` and `/tasks/:id` routes |
| 5 | `src/app.js` | modify | Mount `app.use("/tasks", createTasksRouter(options))` |
| 6 | `src/services/auth-service.js` | modify | Remove `err.status` assignments to resolve `TD-controllers-services-F1` |
| 7 | `test/auth.test.js` | modify | Update `auth-service` unit tests to assert `err.status === undefined` on domain errors |
| 8 | `test/tasks.test.js` | create | Integration and unit tests for `/tasks` endpoints, service, and storage |
| 9 | `postman/task-api.postman_collection.json` | modify | Add `Tasks` folder with manual CRUD and error requests (`TEST-8`) |

## Steps

### Step 1. Resolve `TD-controllers-services-F1` in `src/services/auth-service.js` and `test/auth.test.js`

In `src/services/auth-service.js`, remove the `try`/`catch` wrapper that sets `err.status = 409` in `registerUser` (let `createUser`'s error with `err.code = "DUPLICATE_EMAIL"` propagate directly) and remove `err.status = 401` in `loginUser` (`D10`, `D11`). Update the two `auth-service` unit tests in `test/auth.test.js` (lines 378–409) to expect `{ code: "DUPLICATE_EMAIL", message: "Email already registered" }` and `{ code: "INVALID_CREDENTIALS", message: "Invalid email or password" }` without `status`.

### Step 2. Create `src/storage/task-store.js`

Implement promise-serialized persistence (`DATA-1`, `DATA-2`, `DATA-3`, `DATA-5`, `DATA-6`, `JS-6`, `JS-8`) using `node:fs/promises`, `node:path`, and `node:crypto`. Resolve the file path from a string argument, `options.tasksFile`, `process.env.TASKS_FILE`, or `path.resolve("data/tasks.json")`. Provide an internal `readTasks(filePath)` (returning `[]` on `ENOENT`) and `writeTasks(filePath, tasks)` (writing to `${filePath}.${crypto.randomUUID()}.tmp` and renaming). Export `createTask({ title, description, status }, options)`, `listTasks(options)`, `getTaskById(id, options)`, `updateTask(id, updates, options)`, and `deleteTask(id, options)`, all running through `serialize` and returning cloned plain objects.

```javascript
async function updateTask(id, updates, options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    const tasks = await readTasks(filePath);
    const index = tasks.findIndex((t) => t.id === String(id));
    if (index === -1) return null;
    const updated = { ...tasks[index], ...updates, updatedAt: new Date().toISOString() };
    tasks[index] = updated;
    await writeTasks(filePath, tasks);
    return { ...updated };
  });
}
```

### Step 3. Create `src/services/task-service.js`

Export `createTask(data, options)`, `listTasks(options)`, `getTaskById(id, options)`, `updateTask(id, updates, options)`, and `deleteTask(id, options)` (`D10`, `D11`, `JS-4`). `createTask` trims `title` and sets defaults (`description: data.description ?? ""`, `status: data.status ?? "todo"`). `updateTask` builds a clean patch object from defined fields (trimming `title` when present). When `getTaskById`, `updateTask`, or `deleteTask` receives `null`/`false` from the store, throw an `Error("Task not found")` with `err.code = "TASK_NOT_FOUND"` (and no `err.status`).

### Step 4. Create `src/controllers/task-controller.js`

Define `ALLOWED_STATUSES = ["todo", "in_progress", "done"]`, `MAX_TITLE_LENGTH = 200`, and `MAX_DESCRIPTION_LENGTH = 1000` (`JS-1`, `SEC-9`, `API-5`). Export pure validators `validateCreateTaskInput(body)` and `validateUpdateTaskInput(body)` (`JS-8`) plus `createTaskController(options)` returning `{ create, list, getById, update, remove }`:
- `create`: validates body (400), calls `taskService.createTask`, responds `res.location(\`/tasks/\${task.id}\`).status(201).json(task)` (`API-3`).
- `list`: calls `taskService.listTasks`, responds `200` with array.
- `getById`: calls `taskService.getTaskById(req.params.id, options)`, responds `200` or maps `err.code === "TASK_NOT_FOUND"` to `404 { error: err.message }`.
- `update`: validates body (400), calls `taskService.updateTask(req.params.id, req.body, options)`, responds `200` or maps `TASK_NOT_FOUND` to `404`.
- `remove`: calls `taskService.deleteTask(req.params.id, options)`, responds `res.status(204).end()` or maps `TASK_NOT_FOUND` to `404`.

```javascript
function validateUpdateTaskInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "at least one of title, description, or status is required";
  }
  const { title, description, status } = body;
  if (title === undefined && description === undefined && status === undefined) {
    return "at least one of title, description, or status is required";
  }
  if (title !== undefined && (typeof title !== "string" || title.trim() === "")) return "title must be a non-empty string";
  if (title !== undefined && title.trim().length > MAX_TITLE_LENGTH) return "title must not exceed 200 characters";
  if (description !== undefined && (typeof description !== "string" || description.length > MAX_DESCRIPTION_LENGTH)) {
    return typeof description !== "string" ? "description must be a string" : "description must not exceed 1000 characters";
  }
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) return "status must be one of: todo, in_progress, done";
  return null;
}
```

### Step 5. Create `src/routes/tasks.js` and mount in `src/app.js`

Create `src/routes/tasks.js` exporting `createTasksRouter(options)` (`API-1`, `API-2`) that binds `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, and `DELETE /:id` to `createTaskController(options)`. In `src/app.js`, import `createTasksRouter` and mount `app.use("/tasks", createTasksRouter(options))` before `notFoundHandler`.

### Step 6. Add tests in `test/tasks.test.js` and manual requests in `postman/task-api.postman_collection.json`

Create `test/tasks.test.js` using a temporary directory and `tasksFile` (`TEST-1`..`TEST-6`). Add a `Tasks` folder in `postman/task-api.postman_collection.json` covering create (201), invalid create (400), list (200), get by ID (200/404), patch by ID (200/400/404), and delete by ID (204/404) (`TEST-8`).

## Interfaces and data

| Method | Path | Request body | Success | Errors |
| --- | --- | --- | --- | --- |
| `POST` | `/tasks` | `{ title, description?, status? }` | `201` + `Location: /tasks/:id` + Task JSON | `400 { error }` |
| `GET` | `/tasks` | none | `200` `[Task, ...]` | - |
| `GET` | `/tasks/:id` | none | `200` Task JSON | `404 { error: "Task not found" }` |
| `PATCH` | `/tasks/:id` | subset of `{ title, description, status }` | `200` Task JSON | `400 { error }`, `404 { error: "Task not found" }` |
| `DELETE` | `/tasks/:id` | none | `204` (empty body) | `404 { error: "Task not found" }` |

Task entity in `data/tasks.json` (configurable via `TASKS_FILE` or `options.tasksFile`):
`{ id: string (UUIDv4), title: string (1..200 chars), description: string (0..1000 chars, default ""), status: "todo" | "in_progress" | "done" (default "todo"), createdAt: string (ISO 8601), updatedAt: string (ISO 8601) }`.
New runtime dependencies: none.

## Tests

| ID | File | Checks | Requirement | New / existing |
| --- | --- | --- | --- | --- |
| T1 | `test/tasks.test.js` | `POST /tasks` with valid payload returns 201, `Location: /tasks/:id`, defaults `description`/`status`, and ignores unknown fields | R1 | new |
| T2 | `test/tasks.test.js` | `POST /tasks` with missing/blank/over-200-char `title`, non-string or >1000-char `description`, or invalid `status` returns 400 | R2 | new |
| T3 | `test/tasks.test.js` | `GET /tasks` returns `[]` initially and returns all stored tasks after creation | R3 | new |
| T4 | `test/tasks.test.js` | `GET /tasks/:id` returns 200 with matching task or 404 `{ error: "Task not found" }` when missing | R4 | new |
| T5 | `test/tasks.test.js` | `PATCH /tasks/:id` updates only provided fields, refreshes `updatedAt`, returns 200, or returns 400 on invalid/empty body and 404 when missing | R2, R5 | new |
| T6 | `test/tasks.test.js` | `DELETE /tasks/:id` returns 204 with empty body and removes task, or returns 404 when missing | R6 | new |
| T7 | `test/tasks.test.js` | Concurrent `POST /tasks` and `PATCH /tasks/:id` calls serialize safely without data loss in `tasks.json` | R7 | new |
| T8 | `test/tasks.test.js` | `task-service` throws `TASK_NOT_FOUND` without `err.status`, and `task-controller` forwards unexpected errors to `next` | R8 | new |
| T9 | `test/auth.test.js` | Existing auth suite passes with `auth-service` throwing `DUPLICATE_EMAIL` and `INVALID_CREDENTIALS` without `err.status` | R8 | existing (modified) |
| T10 | `test/health.test.js`, `test/middleware.test.js` | Existing health and middleware suites pass unchanged | R1–R8 | existing |

Commands:
- `npm test` (all unit and HTTP tests pass)
- `npm run lint` (exits 0 with no ESLint errors)
- `node -e "JSON.parse(require('node:fs').readFileSync('postman/task-api.postman_collection.json', 'utf8'))"` (validates Postman collection JSON for R9; `README.md` curl examples are added in `task-doc-updates`)

## Placeholders and tech debt

| Placeholder | Why | Removed by |
| --- | --- | --- |
| None | No placeholders needed; resolves `TD-controllers-services-F1` | - |

## Size

- Production code: about 220 changed lines in 6 files (`src/storage/task-store.js`, `src/services/task-service.js`, `src/controllers/task-controller.js`, `src/routes/tasks.js`, `src/app.js`, `src/services/auth-service.js`); new runtime dependencies: none.
- Increment budget: fits (<= 300 lines, <= 10 files, 0 new runtime dependencies).

## Risks

- Concurrent writes corrupting `data/tasks.json` or losing updates: mitigated by chaining all task-store operations through the module-level promise queue and writing via a unique `.tmp` file rename (`DATA-3`, `DATA-5`).
- `README.md` manual verification examples mentioned in R9 cannot be edited during `task-development` because `AGENTS.md` reserves `README.md` for `task-doc-updates`: mitigated by updating `postman/task-api.postman_collection.json` in `task-development` (`TEST-8`) and updating `README.md` in `task-doc-updates`.
