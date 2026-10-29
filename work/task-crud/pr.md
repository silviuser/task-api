---
task: task-crud
artifact: pr
branch: task-crud
base: main
updated_commit: none
pr: not created
---

# feat(tasks): add task CRUD endpoints and JSON storage

## Summary

Enable clients to create, list, read, partially update, and delete tasks via `/tasks` and `/tasks/:id` persisted in a local JSON file (`data/tasks.json`). Resolve `TD-controllers-services-F1` by keeping HTTP status mapping solely in controllers so domain services only set `err.code`.

## Changes

- `src/storage/task-store.js` (new): implement `createTask`, `listTasks`, `getTaskById`, `updateTask`, and `deleteTask` with module-level promise-queue serialization and atomic `.tmp` rename writes (`TASKS_FILE` or `options.tasksFile`, default `data/tasks.json`)
- `src/services/task-service.js` (new): implement task domain logic (trimming `title`, setting defaults `description: ""` and `status: "todo"`, building clean patch updates, and throwing `TASK_NOT_FOUND` without `err.status`)
- `src/controllers/task-controller.js` (new): implement `validateCreateTaskInput`, `validateUpdateTaskInput` (enforcing `MAX_TITLE_LENGTH = 200`, `MAX_DESCRIPTION_LENGTH = 1000`, and allow-listed `status`), and `createTaskController(options)` mapping `TASK_NOT_FOUND` to HTTP 404
- `src/routes/tasks.js` (new), `src/app.js`: export `createTasksRouter(options)` for `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, and `DELETE /:id` and mount at `/tasks`
- `src/services/auth-service.js`, `test/auth.test.js`: remove `err.status` assignments on `DUPLICATE_EMAIL` and `INVALID_CREDENTIALS` to resolve `TD-controllers-services-F1` and assert `err.status === undefined` in unit tests
- `test/tasks.test.js` (new), `postman/task-api.postman_collection.json`: add HTTP integration, concurrency, and unit tests for `/tasks` plus manual `Tasks` collection requests

## How to test

```bash
npm ci
npm test
npm run lint
```

Expected: 37 tests pass, lint reports nothing.

Manual checks (`JWT_SECRET=<secret> npm start`):

1. `GET /tasks` against a fresh `TASKS_FILE` returns 200 `[]`.
2. `POST /tasks` with `{"title":"Write API documentation","description":"Document all /tasks endpoints","status":"todo"}` returns 201 with `Location: /tasks/<id>` and the created task object (`id`, `title`, `description`, `status`, `createdAt`, `updatedAt`).
3. `POST /tasks` with `{"title":"  Review PR  ","priority":"high"}` returns 201 with trimmed `title: "Review PR"`, default `description: ""`, default `status: "todo"`, and unknown fields omitted.
4. `POST /tasks` with a missing/blank/over-200-char `title`, >1000-char `description`, or invalid `status` returns 400 `{"error":"<message>"}`.
5. `GET /tasks` returns 200 with a JSON array of all created tasks; `GET /tasks/<id>` returns 200 with the matching task or 404 `{"error":"Task not found"}` for an unknown ID.
6. `PATCH /tasks/<id>` with `{"status":"in_progress"}` returns 200 with the updated status and refreshed `updatedAt`; `{}` returns 400 and an unknown ID returns 404.
7. `DELETE /tasks/<id>` returns 204 with an empty body on the first call and 404 `{"error":"Task not found"}` on the second call.

## Quality gates

| Gate | Task file | Result |
| --- | --- | --- |
| Plan critique | `critique.md`, round 1 | approved |
| Code review | `review.md`, round 1 | approved |
| Tests | `test-report.md`, round 1 | pass |

## Tech debt

- None (resolves `TD-controllers-services-F1`).

## Follow-ups

- `dummy-data`: Seed script with realistic fake users and tasks.
- `task-authorization`: Protect `/tasks` with JWT authentication, enforce per-user ownership, and add stricter validation.
