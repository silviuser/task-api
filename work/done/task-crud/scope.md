---
task: task-crud
artifact: scope
version: 1
status: confirmed
branch: task-crud
roadmap_item: task-crud
---

# Scope: Task CRUD without authentication

## Goal

Enable clients to create, list, read, partially update, and delete tasks via `/tasks` and `/tasks/:id` persisted in a local JSON file (`data/tasks.json`), and resolve tech debt `TD-controllers-services-F1` by keeping HTTP status mapping solely in controllers.

## Requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| R1 | Create a task via `POST /tasks` | Given a JSON body with a valid `title` (1–200 chars after trim) and optional `description` (string, default `""`) and `status` (`"todo" \| "in_progress" \| "done"`, default `"todo"`), when `POST /tasks` is called, then it returns HTTP 201 with `Location: /tasks/<id>` and the created task (`id`, `title`, `description`, `status`, `createdAt`, `updatedAt`). |
| R2 | Validate task input on creation and update | Given a `POST /tasks` or `PATCH /tasks/:id` request with a missing/blank/over-200-char `title`, non-string `description`, invalid `status`, or an empty `PATCH` payload with no updatable fields, when the endpoint is called, then it returns HTTP 400 with `{ "error": "<message>" }`. |
| R3 | List all tasks via `GET /tasks` | Given stored tasks in `data/tasks.json`, when `GET /tasks` is called, then it returns HTTP 200 with a JSON array of all task objects (or `[]` when none exist). |
| R4 | Get a single task by ID via `GET /tasks/:id` | Given a task ID, when `GET /tasks/:id` is called, then it returns HTTP 200 with the matching task object or HTTP 404 with `{ "error": "Task not found" }` if the ID does not exist. |
| R5 | Partially update a task via `PATCH /tasks/:id` | Given an existing task ID and any valid subset of `{ title, description, status }`, when `PATCH /tasks/:id` is called, then it updates only the provided fields, refreshes `updatedAt`, and returns HTTP 200 with the updated task, or HTTP 404 if the ID does not exist. |
| R6 | Delete a task via `DELETE /tasks/:id` | Given a task ID, when `DELETE /tasks/:id` is called, then it removes the task and returns HTTP 204 with an empty body if found, or HTTP 404 with `{ "error": "Task not found" }` if the ID does not exist. |
| R7 | Persist tasks safely in `src/storage/task-store.js` | Given concurrent task reads and writes configured via `options.tasksFile` or `TASKS_FILE` (default `data/tasks.json`), when storage functions run, then writes are serialized and written atomically via a temporary file rename (`DATA-1`, `DATA-2`, `DATA-3`, `DATA-5`, `DATA-6`). |
| R8 | Resolve `TD-controllers-services-F1` error-status duplication | Given domain errors thrown by `auth-service` and `task-service`, when inspected and handled, then services set `err.code` only (`DUPLICATE_EMAIL`, `INVALID_CREDENTIALS`, `TASK_NOT_FOUND`) without `err.status`, and controllers map those codes to HTTP 409, 401, and 404. |
| R9 | Manual verification examples for `/tasks` | Given a running API server, when executing the `/tasks` requests in `README.md` and `postman/task-api.postman_collection.json`, then create, list, get, patch, and delete operations succeed as documented (`TEST-8`). |

## Out of scope

- Authentication or authorization on `/tasks` and task ownership (`userId` filtering), deferred to `task-authorization`.
- Full replacement via `PUT /tasks/:id` (`API-2` and `DATA-6` specify `PATCH` for partial updates).
- Pagination, sorting, or query filtering on `GET /tasks`.
- Additional task fields such as `dueDate` or `priority` (stricter/extended validation deferred to `task-authorization`).

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Separate `src/storage/task-store.js` (`TASKS_FILE`, default `data/tasks.json`) | Isolates task persistence from `user-store.js`; follows atomic `.tmp` rename + promise queue (`DATA-3`); zero impact on existing user tests | Two storage files in `src/storage/` | Chosen |
| Single shared JSON file for users and tasks | Single file on disk | Couples user and task schemas and requires refactoring `user-store.js` | Rejected |
| External local JSON DB (`lowdb`) or `better-sqlite3` | Built-in helpers or SQL queries | Adds runtime/native dependencies; project standard `DATA-3` uses native `node:fs/promises` prior to Firestore | Rejected |
| `PATCH /tasks/:id` partial update only | Matches `API-2` and `DATA-6` directly; avoids duplicate update endpoints | No `PUT /tasks/:id` | Chosen |
| Services set `err.code` only; controllers map to HTTP status | Keeps services transport-agnostic (`D10`, `D11`) and resolves `TD-controllers-services-F1` | Controllers explicitly catch known domain error codes | Chosen |

Sources:

- https://expressjs.com/en/5x/api.html#router
- https://nodejs.org/api/crypto.html#cryptorandomuuidoptions
- https://www.npmjs.com/package/lowdb
- https://mihai-gheorghe.gitbook.io/pwcc-suport-curs/backend-in-javascript/api-rest
- https://mihai-gheorghe.gitbook.io/pwcc-suport-curs/firebase/operatii-crud

## Constraints and assumptions

- Node.js 22+ with Express 5 and CommonJS modules (`require`, `module.exports`).
- Zero new runtime dependencies (uses built-in `node:fs/promises`, `node:path`, `node:crypto`).
- Unknown fields in request bodies are ignored (`API-5`); field names use camelCase and ISO 8601 timestamps (`API-8`).
- `description` max length is bounded (e.g., 1000 chars) to protect storage (`SEC-9`).
- All existing tests in `test/health.test.js`, `test/middleware.test.js`, and `test/auth.test.js` continue passing (`TEST-7`).

## Impact

- Code areas touched: `src/app.js`, `src/routes/tasks.js`, `src/controllers/task-controller.js`, `src/services/task-service.js`, `src/storage/task-store.js`, `src/services/auth-service.js`, `test/tasks.test.js`, `test/auth.test.js`, `postman/task-api.postman_collection.json`.
- Blast radius: Low (adds `/tasks` routes and storage module; removes unused `err.status` assignment in `auth-service.js`).
- Increment budget: Fits (6 production files, ~250 lines of production code, 0 new runtime dependencies).

## Split and placeholders

None needed; `task-crud` fits within a single increment budget.

## Follow-ups

- `dummy-data`: Seed script with realistic fake users and tasks.
- `task-authorization`: Protect `/tasks` with JWT authentication, enforce per-user ownership, and add stricter validation.

## Open questions

- None
