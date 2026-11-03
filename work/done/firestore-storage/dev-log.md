---
task: firestore-storage
artifact: dev-log
plan_version: 1
round: 1
status: done
---

# Development log: firestore-storage

One entry per increment, in commit order: a plan step, or a fix in a fix round. The code review reads the increments one by one, so each entry says what the reviewer needs to know about its commit.

## Increment 1: 1. Install `firebase-admin` and update `.gitignore`

- Commit: `fb9b792` `chore(storage): install firebase-admin and ignore firebase logs`
- Changes:
  - `package.json`: added `firebase-admin@^14.5.0` runtime dependency.
  - `package-lock.json`: locked `firebase-admin` dependency tree.
  - `.gitignore`: added `.firebase/`, `firebase-debug.log*`, and `firestore-debug.log*`.
- Decisions: none
- Tests: T6 (existing 47 tests continue passing)
- Review focus: `.gitignore` rules (`GIT-4`, `SEC-6`) and single runtime dependency budget.
- Deviation from the plan: none

## Increment 2: 2. Create `src/storage/firestore.js`

- Commit: `3d40299` `feat(storage): add single Firestore initialization module`
- Changes:
  - `src/storage/firestore.js`: created single Firebase Admin initialization module exporting `getDb(options)` and `isFirestoreEnabled(options, fileKey)`.
- Decisions: followed critique suggestion to call `getFirestore(existing)` when an app instance already exists for `projectId`, and `initializeFirestore(app, { preferRest: true })` when creating a new app instance (`DATA-4`).
- Tests: covered by T1 in Increment 6 (`getDb` caching and `isFirestoreEnabled` selection logic).
- Review focus: `isFirestoreEnabled` precedence (`dataFile` / `tasksFile` options always keep JSON storage active) and credential resolution (`SEC-6`, `SEC-11`).
- Deviation from the plan: none

## Increment 3: 3. Add Firestore persistence in `src/storage/user-store.js`

- Commit: `c60ca1d` `feat(storage): add Firestore persistence in user-store`
- Changes:
  - `src/storage/user-store.js`: added Firestore support for `createUser` (using `db.runTransaction()`), `findUserByEmail`, `readUsers`, and `resetUsers` while keeping the JSON fallback unchanged.
- Decisions: extracted `readUsersFromFile(filePath)` for internal JSON queue operations so `readUsers(options)` cleanly dispatches between Firestore and JSON (`DATA-1`, `DATA-2`, `DATA-5`).
- Tests: covered by T2 and T4 in Increment 6, plus existing `test/auth.test.js` (T6).
- Review focus: transactional case-insensitive e-mail uniqueness check (`DATA-5`) and omission of `passwordHash` from the returned user object (`API-9`).
- Deviation from the plan: none

## Increment 4: 4. Add Firestore persistence in `src/storage/task-store.js`

- Commit: `5147cad` `feat(storage): add Firestore persistence in task-store`
- Changes:
  - `src/storage/task-store.js`: added Firestore support for `createTask`, `listTasks`, `getTaskById`, `updateTask` (transactional partial update), `deleteTask` (transactional existence check and delete), and `resetTasks`.
- Decisions: used `db.runTransaction()` in both `updateTask` and `deleteTask` so missing documents reliably return `null` / `false` (`DATA-5`, `DATA-6`).
- Tests: covered by T3 and T4 in Increment 6, plus existing `test/tasks.test.js` (T6).
- Review focus: partial field updates preserving untouched properties (`DATA-6`) and `userId` query filtering in `listTasks`.
- Deviation from the plan: none

## Increment 5: 5. Support Firestore mode in `src/seed.js`

- Commit: `8f4c168` `feat(seed): support isolated Firestore seed collections`
- Changes:
  - `src/seed.js`: added Firestore mode targeting isolated `seed_users` and `seed_tasks` collections by default (`DATA-7`) and updated CLI summary output to print collection names or file paths without secrets (`SEC-10`).
- Decisions: ensured explicit `DATA_FILE` / `TASKS_FILE` environment variables continue to select JSON file seeding unless `options.useFirestore` is set, preserving CLI backward compatibility.
- Tests: covered by T5 in Increment 6 and existing `test/seed.test.js` (T6).
- Review focus: isolation between `seed_users` / `seed_tasks` and application `users` / `tasks` collections (`DATA-7`).
- Deviation from the plan: none

## Increment 6: 6. Create `test/firestore.test.js`

- Commit: `b1bbca7` `test(storage): add Firestore emulator integration tests`
- Changes:
  - `src/storage/firestore.js`: configured an emulator `authClient` (`Bearer owner` + Node `fetch`) when `FIRESTORE_EMULATOR_HOST` is set so `google-gax` REST fallback does not attempt GCE metadata credential lookup offline.
  - `test/firestore.test.js`: added T1–T5 integration, concurrency, HTTP, and seed isolation tests against `FIRESTORE_EMULATOR_HOST` (starting an in-process Firestore v1 REST emulator when `FIRESTORE_EMULATOR_HOST` is unset).
- Decisions: configured `db.settings({ authClient })` in `src/storage/firestore.js` when `FIRESTORE_EMULATOR_HOST` is set because `google-gax` REST fallback otherwise calls `GoogleAuth.getApplicationDefaultAsync()` even with `ssl: false`.
- Tests:
  - T1: `getDb` instance caching per `projectId` and `isFirestoreEnabled` fallback when `dataFile` / `tasksFile` are provided.
  - T2: `user-store` CRUD, case-insensitive `findUserByEmail`, and concurrent `createUser` transaction rejecting duplicate e-mail with `DUPLICATE_EMAIL`.
  - T3: `task-store` CRUD, `userId` filtering, partial `updateTask`, `deleteTask`, and `resetTasks` on Firestore.
  - T4: end-to-end HTTP flow (`/auth/register`, `/auth/login`, `/tasks` CRUD and 403/404 ownership checks) backed by Firestore.
  - T5: `seedData` populating `seed_users` and `seed_tasks` without modifying `users` or `tasks`.
- Review focus: transaction locking and isolation in `test/firestore.test.js` and `FIRESTORE_EMULATOR_HOST` cleanup in `after()`.
- Deviation from the plan: added `db.settings({ authClient })` in `src/storage/firestore.js` when `FIRESTORE_EMULATOR_HOST` is set so `preferRest: true` works offline against the emulator without querying Google metadata servers.

## Commands

| Command | Result |
| --- | --- |
| test: `npm test` | 52 passed, 0 failed |
| lint: `npm run lint` | no problems |

## Notes for testing

- Run `npm test` to execute all 52 automated tests (including `test/firestore.test.js` and all existing JSON suites).
- If an external Firestore emulator is running (`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`), `test/firestore.test.js` connects to it directly; otherwise `test/firestore.test.js` starts a local in-process Firestore v1 REST emulator on an ephemeral port automatically.
- To run the API or seed script against a Firestore emulator manually, set `FIRESTORE_EMULATOR_HOST=127.0.0.1:<port>` (and `JWT_SECRET` for the server) without setting `DATA_FILE` or `TASKS_FILE`.
