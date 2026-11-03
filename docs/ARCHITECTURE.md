# Architecture

## Overview

A stateless REST API: Node.js 22 or newer, Express 5, CommonJS modules. Clients exchange JSON over HTTP; authenticated requests carry a JSON Web Token in the `Authorization` header. Components are added incrementally according to `docs/ROADMAP.md`.

## Components

| Component | Location | Responsibility |
| --- | --- | --- |
| Server entry point | `src/server.js` | Starts HTTP server listening on configured `PORT` |
| Application factory | `src/app.js` | Enforces required `JWT_SECRET` configuration and assembles middleware, routes, and error handling into Express app |
| Request logger | `src/middleware/request-logger.js` | Logs HTTP method, URL, status code, and response time |
| Error handlers | `src/middleware/error-handler.js` | Centralized 404 route handling and error response sanitization |
| Authenticate middleware | `src/middleware/authenticate.js` | `createAuthenticate(options)` verifies `Authorization: Bearer <token>` (`HS256`), validates `payload.sub`, sets `req.user`, or responds 401 (`task-authorization`) |
| Health router | `src/routes/health.js` | Binds `GET /health` to the health controller |
| Health controller | `src/controllers/health-controller.js` | `getHealth` responds 200 `{ status: "ok" }` |
| Auth router | `src/routes/auth.js` | `createAuthRouter(options)` binds `POST /auth/register` and `POST /auth/login` to the auth controller |
| Auth controller | `src/controllers/auth-controller.js` | Validates register and login input (400), calls the auth service, formats 201 with `Location` or 200 `{ token }`, maps `DUPLICATE_EMAIL` to 409 and `INVALID_CREDENTIALS` to 401, forwards other errors to `next` |
| Auth service | `src/services/auth-service.js` | `registerUser` (bcrypt hashing, user creation) and `loginUser` (timing-protected bcrypt verification, JWT signing); throws domain errors with `err.code` only (`DUPLICATE_EMAIL`, `INVALID_CREDENTIALS`), no Express dependency |
| Firestore initializer | `src/storage/firestore.js` | `getDb(options)` initializes `firebase-admin/app` and `firebase-admin/firestore` once per `projectId` and caches the client; `isFirestoreEnabled(options, fileKey)` selects Firestore when `FIRESTORE_EMULATOR_HOST`, `GOOGLE_APPLICATION_CREDENTIALS`, or `options.useFirestore` / `options.projectId` is present and no explicit file path is passed (`firestore-storage`) |
| User storage | `src/storage/user-store.js` | Cloud Firestore (`users` collection, transactional `createUser` with `db.runTransaction()`) and promise-serialized local JSON fallback (`createUser`, `findUserByEmail`, `readUsers`, `resetUsers`) with duplicate email check and case-insensitive email lookup (`user-registration`, `firestore-storage`) |
| Tasks router | `src/routes/tasks.js` | `createTasksRouter(options)` mounts `createAuthenticate(options)` and binds `POST /`, `GET /`, `GET /:id`, `PATCH /:id`, and `DELETE /:id` at `/tasks` to the task controller (`task-crud`, `task-authorization`) |
| Task controller | `src/controllers/task-controller.js` | Validates allow-list create and partial-update payloads and UUIDv4 `:id` route parameters (400), passes `req.user.sub` to the task service, formats 201 (`Location: /tasks/:id`), 200, or 204 responses, and maps `TASK_FORBIDDEN` to 403 and `TASK_NOT_FOUND` to 404 (`task-crud`, `task-authorization`) |
| Task service | `src/services/task-service.js` | `createTask`, `listTasks`, `getTaskById`, `updateTask`, and `deleteTask` domain logic; scopes tasks by `userId`, enforces task ownership, trims titles, applies defaults, and throws `TASK_NOT_FOUND` or `TASK_FORBIDDEN` without `err.status` (`task-crud`, `task-authorization`) |
| Task storage | `src/storage/task-store.js` | Cloud Firestore (`tasks` collection, transactional `updateTask` / `deleteTask` and `userId` query filtering) and promise-serialized local JSON fallback (`createTask`, `listTasks`, `getTaskById`, `updateTask`, `deleteTask`, `resetTasks`) (`task-crud`, `dummy-data`, `task-authorization`, `firestore-storage`) |
| Seed script | `src/seed.js` | Deterministic CLI (`npm run seed`) and programmatic `seedData(options)` helper that populates `seed_users` / `seed_tasks` in Firestore mode or `data/seed-users.json` / `data/seed-tasks.json` in JSON mode via `user-store`, `task-store`, and `task-service` (`dummy-data`, `task-authorization`, `firestore-storage`) |

## Data model

| Entity | Fields | Stored in |
| --- | --- | --- |
| User | `id` (UUIDv4), `email` (string, lowercase), `passwordHash` (string, bcrypt cost 10), `createdAt` (ISO 8601 string) | Cloud Firestore collection `users` (`seed_users` for seed data) or `data/users.json` (`DATA_FILE`) (`user-registration`, `firestore-storage`) |
| Task | `id` (UUIDv4), `userId` (UUIDv4), `title` (string, 1..200 chars), `description` (string, 0..1000 chars, default `""`), `status` (`"todo" \| "in_progress" \| "done"`, default `"todo"`), `createdAt` (ISO 8601 string), `updatedAt` (ISO 8601 string) | Cloud Firestore collection `tasks` (`seed_tasks` for seed data) or `data/tasks.json` (`TASKS_FILE`) (`task-crud`, `task-authorization`, `firestore-storage`) |

## Request flow

Incoming HTTP request -> `express.json()` -> `requestLogger` (records start time) -> matching route -> controller (validates input, formats the response) -> service (business logic) -> storage module (e.g. `POST /auth/login` -> `auth-controller` -> `auth-service` -> `user-store`) -> if unmatched, `notFoundHandler` (404 JSON) -> if error thrown, `errorHandler` (JSON error response) -> `requestLogger` logs method, URL, status code, and duration on response `finish`.

## Decisions

| ID | Decision | Reason | Task |
| --- | --- | --- | --- |
| D1 | Node.js 22 or newer, Express 5, CommonJS modules | the stack of the PWCC course; Express 5 sends rejected promises from async routes to the error handler | before the first task |
| D2 | All persistence behind one storage module: a local JSON file first, Cloud Firestore later | the switch to Firestore must not change routes or business logic (`DATA-1`) | before the first task |
| D3 | Stateless authentication with JSON Web Tokens in the `Authorization` header | REST statelessness (`SEC-3`, `SEC-4`) | before the first task |
| D4 | Tests with `node:test` and `fetch` against the app started on a free port | no extra test framework (`TEST-1`, `TEST-2`) | before the first task |
| D5 | Custom request logger middleware instead of external package | Zero extra runtime dependencies, staying within single runtime dependency budget | `app-foundation` |
| D6 | `bcryptjs` for password hashing | Pure JavaScript, zero native toolchain dependencies (`SEC-1`), within dependency budget | `user-registration` |
| D7 | Promise-serialized atomic writes with `.tmp` file rename for JSON storage | Prevents file corruption and race conditions without third-party database dependencies (`DATA-3`, `DATA-5`) | `user-registration` |
| D8 | `jsonwebtoken` (`HS256`, `1h` expiry) for token signing and verification | Synchronous signing, algorithm pinning, and standard JWT claims (`sub`, `email`) within the single runtime dependency budget (`SEC-3`) | `user-login` |
| D9 | Constant-time bcrypt comparison against a precomputed cost-10 dummy hash when login email is not found | Prevents user enumeration via response timing differences and returns a uniform 401 message (`SEC-2`) | `user-login` |
| D10 | Layers `src/routes/` (bind paths), `src/controllers/` (HTTP input and responses), `src/services/` (business logic), built from plain and factory functions | Separates transport from business logic and matches the existing `createApp` factory style, without `this`-binding boilerplate (`JS-4`, `JS-8`) | `controllers-services` |
| D11 | Request body validation in the controller; services take plain values and never see `req` or `res` | Keeps services reusable and independent of Express request shapes | `controllers-services` |
| D12 | No service for static endpoints such as `GET /health` | Avoids a pass-through layer | `controllers-services` |
| D13 | Separate `src/storage/task-store.js` (`TASKS_FILE`, default `data/tasks.json`) with promise-serialized atomic `.tmp` rename writes | Isolates task persistence from `user-store.js` and prevents concurrent write races (`DATA-3`, `DATA-5`) | `task-crud` |
| D14 | Partial task updates via `PATCH /tasks/:id` only (no `PUT /tasks/:id`) | Matches `API-2` and `DATA-6` directly while avoiding duplicate update endpoints | `task-crud` |
| D15 | Services set domain `err.code` only (`DUPLICATE_EMAIL`, `INVALID_CREDENTIALS`, `TASK_NOT_FOUND`, `TASK_FORBIDDEN`); controllers map codes to HTTP status | Keeps services transport-agnostic (`API-6`, `D10`, `D11`) and resolves `TD-controllers-services-F1` | `task-crud`, `task-authorization` |
| D16 | Deterministic seed generation with `@faker-js/faker` (`devDependencies`) writing to isolated default files `data/seed-users.json` and `data/seed-tasks.json` via `resetUsers` and `resetTasks` | Keeps seed data separate from real application files (`DATA-7`), avoids new runtime dependencies, and preserves serialized atomic writes (`DATA-1`, `DATA-3`) | `dummy-data` |
| D17 | Custom `authenticate` middleware using existing `jsonwebtoken` (`HS256`) and setting `req.user` (`sub`, `email`) | Zero new runtime dependencies; matches `SEC-3`, `SEC-4`, `D8`, and `{ error }` 401 format (`API-4`) | `task-authorization` |
| D18 | Plain JavaScript allow-list body validation (`title`, `description`, `status`) and UUIDv4 `:id` check in `task-controller.js` | Rejects unknown or protected fields (`userId`, `id`, `createdAt`) and malformed route IDs before storage without external schema libraries (`API-5`, `SEC-9`) | `task-authorization` |
| D19 | HTTP 403 `Forbidden` (`TASK_FORBIDDEN`) when a task belongs to another user, 404 (`TASK_NOT_FOUND`) when missing | Distinguishes authenticated authorization failures from missing resources (`API-3`, `SEC-5`) | `task-authorization` |
| D20 | `firebase-admin` (`firebase-admin/app`, `firebase-admin/firestore`) initialized once per `projectId` in `src/storage/firestore.js` with `preferRest: true` and an offline emulator `authClient` when `FIRESTORE_EMULATOR_HOST` is set | Satisfies `DATA-4`, `SEC-6`, and `SEC-11` within the single runtime dependency budget while avoiding GCE metadata credential lookups during offline emulator tests | `firestore-storage` |
| D21 | Automatic backend selection via `isFirestoreEnabled(options, fileKey)` (`FIRESTORE_EMULATOR_HOST`, `GOOGLE_APPLICATION_CREDENTIALS`, or `options.useFirestore` / `options.projectId`, overridden by explicit `dataFile` / `tasksFile`) | Switches `user-store` and `task-store` to Cloud Firestore with zero changes to routes, controllers, services, or existing JSON test suites (`D2`, `DATA-1`, `TEST-7`) | `firestore-storage` |
| D22 | Firestore transactions (`db.runTransaction()`) for `createUser` email uniqueness and `updateTask` / `deleteTask` existence checks | Prevents check-then-write races under concurrent requests and preserves partial update semantics (`DATA-5`, `DATA-6`) | `firestore-storage` |
