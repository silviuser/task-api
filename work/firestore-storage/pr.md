---
task: firestore-storage
artifact: pr
branch: firestore-storage
base: main
updated_commit: b25999e
pr: https://github.com/silviuser/task-api/pull/9
---

# feat(storage): add Cloud Firestore persistence and emulator test suite

## Summary

Persists users and tasks in Cloud Firestore (`firebase-admin` modular SDK) behind `src/storage/user-store.js` and `src/storage/task-store.js` without changing routes, controllers, or services, while keeping local JSON file storage as a fallback (`D2`, `DATA-1`, `TEST-7`). Adds isolated Firestore seeding (`seed_users`, `seed_tasks`) in `src/seed.js` and an automated integration and concurrency test suite (`test/firestore.test.js`) running against the Firestore emulator.

## Changes

- `package.json`, `package-lock.json`, `.gitignore`: add `firebase-admin@^14.5.0` runtime dependency and ignore `.firebase/`, `firebase-debug.log*`, and `firestore-debug.log*` (`GIT-4`, `SEC-6`).
- `src/storage/firestore.js`: add single Firebase Admin initialization module exporting `getDb(options)` and `isFirestoreEnabled(options, fileKey)` (`DATA-4`, `SEC-6`, `SEC-11`).
- `src/storage/user-store.js`: add Firestore `createUser` (transactional case-insensitive email uniqueness check via `db.runTransaction()`), `findUserByEmail`, `readUsers`, and `resetUsers` while preserving JSON file fallback (`DATA-1`, `DATA-2`, `DATA-5`, `API-9`).
- `src/storage/task-store.js`: add Firestore `createTask`, `listTasks` (with `userId` query filter), `getTaskById`, transactional `updateTask` and `deleteTask`, and `resetTasks` while preserving JSON file fallback (`DATA-1`, `DATA-2`, `DATA-5`, `DATA-6`).
- `src/seed.js`: support Firestore mode targeting isolated `seed_users` and `seed_tasks` collections by default while preserving `data/seed-*.json` defaults in JSON mode (`DATA-7`, `SEC-10`).
- `test/firestore.test.js`: add automated tests (T1–T5) covering `getDb` caching, transactional email uniqueness under concurrency, task CRUD, end-to-end HTTP flows over `/auth/*` and `/tasks/*`, and isolated Firestore seeding against `FIRESTORE_EMULATOR_HOST` (`TEST-1`..`TEST-7`).

## How to test

```bash
npm ci
npm test
npm run lint
```

- Start `src/server.js` with `FIRESTORE_EMULATOR_HOST` and `JWT_SECRET` set (and without `DATA_FILE`/`TASKS_FILE`): verify `GET /health` returns `200 {"status":"ok"}` and `GET /unknown` returns `404`.
- Register a user via `POST /auth/register` (`201` without `passwordHash`) and verify duplicate registration with uppercase email returns `409 {"error":"Email already registered"}`.
- Log in via `POST /auth/login` (`200` with JWT `token`, `401` on wrong password) and run `/tasks` CRUD (`POST /tasks` -> `201`, `GET /tasks` -> `200`, `PATCH /tasks/:id` -> `200`, `DELETE /tasks/:id` -> `204`, `GET /tasks/:id` -> `404`), plus verify `401` without token and `400` on protected fields.
- Run `FIRESTORE_EMULATOR_HOST=127.0.0.1:<port> node src/seed.js` and verify it populates `seed_users` and `seed_tasks` without modifying application `users` or `tasks` collections.
- Rebased onto `origin/main` (`b25999e`): `npm test` passed (`52 passed, 0 failed`).

## Quality gates

| Gate | Task file | Result |
| --- | --- | --- |
| Plan critique | `critique.md`, round 1 | approved |
| Code review | `review.md`, round 1 | approved |
| Tests | `test-report.md`, round 1 | pass |

## Tech debt

- None

## Follow-ups

- `security-hardening`: Add `helmet` security headers and `express-rate-limit` on `/auth/login` (`SEC-7`).
