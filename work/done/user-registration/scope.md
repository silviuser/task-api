---
task: user-registration
artifact: scope
version: 1
status: confirmed
branch: user-registration
roadmap_item: user-registration
---

# Scope: User registration

## Goal

Allow new users to register via `POST /auth/register` with email and password, store user records safely in a local JSON file with bcrypt password hashing, and support manual testing with Postman and curl.

## Requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| R1 | `POST /auth/register` endpoint creates a new user record | Given valid `email` and `password` in the JSON request body, when `POST /auth/register` is received, then it returns HTTP 201 with `{ "id": "<uuid>", "email": "<normalized-email>", "createdAt": "<iso-timestamp>" }` and omits secrets. |
| R2 | Input validation for email format | Given a request with missing, non-string, blank, or improperly formatted email, when `POST /auth/register` is received, then it returns HTTP 400 with `{ "error": "<message>" }`. |
| R3 | Input validation for password length | Given a request with missing password or password shorter than 8 characters or longer than 72 bytes, when `POST /auth/register` is received, then it returns HTTP 400 with `{ "error": "<message>" }`. |
| R4 | Email uniqueness check preventing duplicates | Given an email that already exists in storage, when `POST /auth/register` is received with the same email (case-insensitive), then it returns HTTP 409 with `{ "error": "Email already registered" }`. |
| R5 | Password hashing with bcryptjs cost 10 | Given a valid registration request, when saving the user record, then `passwordHash` is computed with bcryptjs at salt rounds 10 and cleartext password is never persisted or logged. |
| R6 | Safe local JSON file storage module | Given a configurable `DATA_FILE` path, when user persistence functions are called, then file writes are serialized and committed atomically via a temporary file rename. |
| R7 | Postman collection and manual verification examples | Given a running API server, when using the Postman collection or curl examples in `README.md`, then valid registration returns 201 and duplicate/invalid inputs return 400 or 409. |

## Out of scope

- User authentication, login (`POST /auth/login`), and JWT token issuance (deferred to `user-login`).
- User profile retrieval or modification (`/users/:id`, `/auth/me`).
- Password reset, email verification links, or multi-factor authentication.
- Cloud Firestore integration (deferred to `firestore-storage`).
- Task CRUD operations or role-based access control (deferred to `task-crud` and `task-authorization`).

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| `bcryptjs` (`^3.0.3`) | Pure JavaScript, zero native build tools/node-gyp, explicitly required by `SEC-1` | Slower than native C++ bindings | Chosen |
| Native `bcrypt` (`^6.0.0`) | Faster hash generation | Requires node-gyp and native compiler toolchain across OS environments | Rejected |
| Built-in `node:crypto.randomUUID()` | Built into Node 22+, standard RFC 4122 v4 UUID, zero extra dependencies | None for this use case | Chosen |
| Custom atomic JSON storage module (`node:fs/promises`) | Fulfills `DATA-1`, `DATA-2`, `DATA-3`, `DATA-5` with zero dependencies, atomic rename prevents file corruption | Simple local file persistence; not distributed | Chosen |
| Third-party embedded store (`lowdb`, `nedb`) | Pre-built query utilities | Consumes dependency budget, not needed since Firestore replaces it later | Rejected |

Sources:

- https://www.npmjs.com/package/bcryptjs
- https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptorandomuuidoptions
- https://nodejs.org/docs/latest-v22.x/api/fs.html#fspromisesrenametoldpath-newpath
- https://www.postman.com/

## Constraints and assumptions

- Node.js 22+ with Express 5 and CommonJS modules (`require`, `module.exports`).
- Exactly one new runtime dependency added: `bcryptjs`.
- All persistence functions are asynchronous and abstracted behind a storage module per `DATA-1` and `DATA-2`.
- Email matching is case-insensitive (normalized to lowercase before checking and persisting).
- File storage default path is `data/users.json` (ignored in `.gitignore`); test suites run with isolated temporary data files per `TEST-4`.

## Impact

- Code areas touched: `package.json`, `package-lock.json`, `src/app.js`, `src/routes/auth.js`, `src/storage/user-store.js`, `test/auth.test.js`, `postman/task-api.postman_collection.json`, `README.md`.
- Blast radius: Low (adds new isolated `/auth/register` route and storage abstraction; existing `/health` and middleware remain untouched).
- Increment budget: Fits (approx. 130-160 lines of production code, 1 new runtime dependency `bcryptjs`, well below 10 production files).

## Split and placeholders

None needed; the user registration increment fits well within the budget.

## Follow-ups

- `user-login`: `POST /auth/login` with credentials check and JWT generation.
- `controllers-services`: Refactor routes, controllers, and services.

## Open questions

- None
