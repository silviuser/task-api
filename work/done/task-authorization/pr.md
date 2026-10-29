---
task: task-authorization
artifact: pr
branch: task-authorization
base: main
updated_commit: none
pr: https://github.com/silviuser/task-api/pull/7
---

# feat(tasks): enforce Bearer JWT authentication, per-user ownership, and strict validation

## Summary

Require valid `HS256` JWT Bearer authentication on all `/tasks` endpoints so each user creates, lists, reads, updates, and deletes only their own tasks (`userId`). Enforce strict allow-list validation on task request bodies, validate `:id` route parameters as UUIDv4 before querying storage, and assign deterministic `userId` ownership to seeded tasks.

## Changes

- Add Bearer JWT authentication middleware (`src/middleware/authenticate.js`) verifying `Authorization: Bearer <token>` with `HS256` and wire `jwtSecret` into `/tasks` routes (`src/app.js`, `src/routes/tasks.js`).
- Persist `userId` on created tasks, filter `listTasks` by `userId`, and enforce task ownership (`TASK_FORBIDDEN` -> 403 vs `TASK_NOT_FOUND` -> 404) in `src/storage/task-store.js` and `src/services/task-service.js`.
- Enforce strict allow-list validation on `POST /tasks` and `PATCH /tasks/:id` bodies (`title`, `description`, `status`), validate `:id` route parameters as UUIDv4 before storage lookups, and map `TASK_FORBIDDEN` to HTTP 403 in `src/controllers/task-controller.js`.
- Assign deterministic round-robin `userId` ownership across seeded users in `src/seed.js`.
- Update automated test suites (`test/tasks.test.js`, `test/seed.test.js`) and Postman collection (`postman/task-api.postman_collection.json`) for Bearer authentication, 401/403 responses, allow-list validation, and UUIDv4 checks.

## How to test

```bash
npm ci
npm test
npm run lint
```

Manual checks (with `JWT_SECRET=dev-secret-key npm start`):
- Seed sample users and user-owned tasks: `npm run seed`.
- Register or log in via `POST /auth/login` (`{"email":"user1@example.com","password":"Password123!"}`) to obtain a Bearer token.
- Call `GET /tasks`, `POST /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id`, and `DELETE /tasks/:id` with `Authorization: Bearer <token>`.
- Verify `401` without a valid Bearer token, `403` when accessing another user's task, `404` on a non-existent UUIDv4, and `400` on unknown body fields (`userId`, `extraField`) or non-UUIDv4 `:id` parameters.

## Quality gates

| Gate | Task file | Result |
| --- | --- | --- |
| Plan critique | `critique.md`, round 1 | approved |
| Code review | `review.md`, round 1 | approved |
| Tests | `test-report.md`, round 1 | pass |

## Tech debt

- None

## Follow-ups

- `firestore-storage`: Cloud Firestore behind the storage module; tests on the Firestore emulator.
- `security-hardening`: Add `helmet` security headers and `express-rate-limit` on `/auth/login` (`SEC-7`).
