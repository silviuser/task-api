---
task: firestore-storage
artifact: scope
version: 1
status: confirmed
branch: firestore-storage
roadmap_item: firestore-storage
---

# Scope: Cloud Firestore behind the storage module and tests on the Firestore emulator

## Goal

Persist users and tasks in Cloud Firestore (`firebase-admin` modular SDK) behind `src/storage/user-store.js` and `src/storage/task-store.js` without changing routes, controllers, or services, while keeping JSON file storage as a fallback and running automated tests against the Firestore emulator.

## Requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| R1 | Single Firestore initialization module (`src/storage/firestore.js`) (`DATA-4`, `SEC-6`, `SEC-11`) | Given `FIRESTORE_EMULATOR_HOST` or `GOOGLE_APPLICATION_CREDENTIALS` (or explicit `options.useFirestore` / `options.projectId`), when `getDb(options)` is called multiple times for the same project, then it initializes `firebase-admin/app` once and returns the `firebase-admin/firestore` client. |
| R2 | Automatic backend selection in `user-store` and `task-store` (`DATA-1`, `DATA-2`) | Given no explicit `dataFile` / `tasksFile` option and `FIRESTORE_EMULATOR_HOST` or `GOOGLE_APPLICATION_CREDENTIALS` (or `options.useFirestore` / `options.projectId`) set, when storage functions run, then they persist to Firestore; otherwise they use local JSON files so existing JSON tests pass unchanged (`TEST-7`). |
| R3 | Transactional user creation and email uniqueness in Firestore (`DATA-2`, `DATA-5`) | Given Firestore mode, when `createUser({ email, passwordHash })` is called, then a single `db.runTransaction()` checks case-insensitive email uniqueness, stores a UUIDv4 user document, returns `{ id, email, createdAt }` without `passwordHash`, and throws `err.code = "DUPLICATE_EMAIL"` even under concurrent requests. |
| R4 | User lookup and reset in Firestore (`DATA-2`, `DATA-7`) | Given Firestore mode, when `findUserByEmail(email)`, `readUsers()`, or `resetUsers()` is called, then `findUserByEmail` returns a plain user object (with `passwordHash`) case-insensitively or `null`, `readUsers` returns plain user records, and `resetUsers` deletes all documents in the target users collection. |
| R5 | Task CRUD and per-user filtering in Firestore (`DATA-1`, `DATA-2`, `DATA-6`) | Given Firestore mode, when `createTask`, `listTasks`, `getTaskById`, `updateTask`, `deleteTask`, or `resetTasks` is called, then tasks are stored with UUIDv4 `id` and `userId`, `listTasks({ userId })` queries only matching tasks, `updateTask` atomically updates only given fields and `updatedAt` (returning `null` if missing), and `deleteTask` removes the document (returning `false` if missing). |
| R6 | Unchanged routes, controllers, and services over Firestore (`D2`, `DATA-1`, `SEC-11`) | Given the Express app configured for the Firestore emulator, when HTTP requests hit `/auth/register`, `/auth/login`, and authenticated `/tasks` CRUD endpoints, then all status codes (`200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`), headers, and JSON payloads match the JSON storage behavior without route or service code changes. |
| R7 | Isolated Firestore seeding in `src/seed.js` (`DATA-7`) | Given Firestore mode (or `options.useFirestore` / `options.projectId`), when `seedData(options)` runs, then it resets and populates an isolated seed namespace (`usersCollection: "seed_users"`, `tasksCollection: "seed_tasks"` by default) via the storage modules while keeping `data/seed-*.json` defaults in JSON mode. |
| R8 | Automated Firestore emulator test suite (`test/firestore.test.js`) (`TEST-1`, `TEST-4`, `TEST-5`, `TEST-7`) | Given `npm test` (with `FIRESTORE_EMULATOR_HOST` already set or an emulator automatically started for the test run), when the test suite runs, then `test/firestore.test.js` verifies user registration, duplicate email races, login, task CRUD, ownership, and seeding against isolated emulator collections/projects, and all existing tests and `npm run lint` pass. |

## Out of scope

- Replacing or removing local JSON file persistence (`data/users.json`, `data/tasks.json`).
- Client-side Firebase SDKs or Firestore security rules files (`firestore.rules`), since all access goes through the Node.js server using the Admin SDK (`SEC-11`).
- Pagination, sorting, or composite index definitions beyond single-field queries (`email`, `userId`).
- Rate limiting and security headers (tracked in follow-up `security-hardening`).

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| `firebase-admin` (`^14.5.0`, modular `firebase-admin/app` and `firebase-admin/firestore`) | Official Firebase Admin SDK required by `DATA-4` and `SEC-11`; native `FIRESTORE_EMULATOR_HOST` and `GOOGLE_APPLICATION_CREDENTIALS` support | One new runtime dependency (within the 1-dependency increment budget) | Chosen |
| `@google-cloud/firestore` (`^9.4.0`) directly | Lower-level Google Cloud client | `DATA-4` explicitly requires initializing the Firebase Admin SDK once in one module | Rejected |
| `firebase` client SDK | Web/mobile client library | Subject to client security rules; unsuitable for trusted backend servers (`SEC-11`) | Rejected |
| Automatic backend selection (`FIRESTORE_EMULATOR_HOST` / `GOOGLE_APPLICATION_CREDENTIALS` / `options.useFirestore`, overridden by explicit `options.dataFile` / `options.tasksFile`) | Zero changes to `src/routes/`, `src/controllers/`, `src/services/`, or existing `test/*.test.js` (`DATA-1`, `TEST-7`) | Small branching helper in `user-store.js` and `task-store.js` | Chosen |
| Enforcing unique email in Firestore via a deterministic email-index document (`userEmails/<email>` or `users` query) inside `db.runTransaction()` | Guarantees atomic check-then-write under concurrent requests (`DATA-5`) while keeping `user.id` as a UUIDv4 | Writes/deletes the email-lock document or queries inside the transaction | Chosen |

Sources:

- https://www.npmjs.com/package/firebase-admin
- https://firebase.google.com/docs/admin/setup
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/emulator-suite/connect_firestore
- https://www.npmjs.com/package/@google-cloud/firestore
- https://mihai-gheorghe.gitbook.io/pwcc-suport-curs/firebase/cloud-firestore
- https://mihai-gheorghe.gitbook.io/pwcc-suport-curs/firebase/operatii-crud

## Constraints and assumptions

- Node.js 22+, Express 5, CommonJS modules (`require("firebase-admin/app")`, `require("firebase-admin/firestore")`), and at most 1 new runtime dependency (`firebase-admin`).
- `GOOGLE_APPLICATION_CREDENTIALS`, key files (`*.json`), and `.firebase/` / emulator artifacts must never be committed (`GIT-4`, `SEC-6`, `SEC-11`).
- All Firestore records are returned as plain JavaScript objects with string `id` (`UUIDv4`) and ISO 8601 string timestamps (`createdAt`, `updatedAt`) matching the JSON storage shapes (`DATA-2`, `API-8`).
- Automated tests never connect to production Cloud Firestore (`TEST-5`); `test/firestore.test.js` connects to `FIRESTORE_EMULATOR_HOST` (or starts a local emulator instance for the test run).

## Impact

- Code areas touched: `package.json`, `package-lock.json`, `.gitignore`, `src/storage/firestore.js` (new), `src/storage/user-store.js`, `src/storage/task-store.js`, `src/seed.js`, `test/firestore.test.js` (new), `README.md`.
- Blast radius: Medium (touches both storage modules and `src/seed.js`, while leaving `src/app.js`, routes, controllers, services, and existing JSON tests untouched).
- Increment budget: Fits (4 production code files, ~220 lines of production code, 1 new runtime dependency `firebase-admin`).

## Split and placeholders

None needed; `firestore-storage` fits within a single increment budget.

## Follow-ups

- `security-hardening`: Add `helmet` security headers and `express-rate-limit` on `/auth/login` (`SEC-7`).

## Open questions

- None
