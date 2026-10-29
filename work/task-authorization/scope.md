---
task: task-authorization
artifact: scope
version: 1
status: confirmed
branch: task-authorization
roadmap_item: task-authorization
---

# Scope: Task authentication, per-user authorization, and stricter validation

## Goal

Require valid JWT Bearer authentication on all `/tasks` endpoints so each user creates, lists, reads, updates, and deletes only their own tasks (`userId`), and enforce strict allow-list validation on task payloads and route IDs.

## Requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| R1 | Authenticate `/tasks` requests via Bearer JWT middleware (`SEC-3`, `SEC-4`) | Given a request to any `/tasks` endpoint without a valid `Authorization: Bearer <token>` header (missing, malformed, wrong algorithm/secret, or expired), when called, then it returns HTTP 401 with `{ "error": "<message>" }`, and when valid, sets `req.user` (`sub`, `email`) and proceeds. |
| R2 | Associate created tasks with the authenticated user (`SEC-5`) | Given an authenticated user (`req.user.sub`), when `POST /tasks` succeeds, then the created and persisted task includes `userId: req.user.sub` and returns HTTP 201. |
| R3 | Scope `GET /tasks` to the authenticated user's tasks (`SEC-5`) | Given stored tasks belonging to multiple users, when an authenticated user calls `GET /tasks`, then it returns HTTP 200 with only the tasks where `task.userId === req.user.sub`. |
| R4 | Enforce task ownership on `GET /tasks/:id`, `PATCH /tasks/:id`, and `DELETE /tasks/:id` (`API-3`, `SEC-5`) | Given an authenticated user and an existing task owned by another user, when `GET /tasks/:id`, `PATCH /tasks/:id`, or `DELETE /tasks/:id` is called, then it returns HTTP 403 with `{ "error": "Forbidden" }` without modifying data, or HTTP 404 when the task does not exist. |
| R5 | Reject unknown or protected fields on `POST /tasks` and `PATCH /tasks/:id` (`API-5`, `SEC-9`) | Given a `POST /tasks` or `PATCH /tasks/:id` body containing any field outside `{ title, description, status }` (such as `id`, `userId`, `createdAt`, `updatedAt`, or arbitrary keys), when called, then it returns HTTP 400 with `{ "error": "<message>" }`. |
| R6 | Validate `:id` route parameter format on `/tasks/:id` (`API-5`, `SEC-9`) | Given a `GET /tasks/:id`, `PATCH /tasks/:id`, or `DELETE /tasks/:id` request whose `:id` is not a valid UUIDv4 string, when called, then it returns HTTP 400 with `{ "error": "Invalid task id" }` before querying storage. |
| R7 | Seed tasks with valid `userId` ownership in `src/seed.js` (`DATA-7`) | Given `seedData()` creating fake users and tasks, when executed, then each seeded task is assigned a `userId` belonging to one of the seeded users (distributed deterministically across users). |
| R8 | Update tests and manual verification examples (`TEST-7`, `TEST-8`) | Given the updated `/tasks` authentication, ownership, and validation rules, when `npm test`, `npm run lint`, and the documented curl / Postman requests run with a Bearer token, then all checks succeed. |

## Out of scope

- Role-based access control (`admin` role or `requireRole` middleware).
- Additional task fields such as `priority` or `dueDate`.
- Cloud Firestore persistence (deferred to `firestore-storage`).
- Rate limiting and security headers (tracked in follow-up `security-hardening`).

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Custom `authenticate` middleware using existing `jsonwebtoken` (`HS256`) | Zero new runtime dependencies; matches `SEC-3`, `SEC-4`, and `D8`; full control over `{ "error": "<message>" }` 401 format (`API-4`) | Small custom middleware (~25 lines) | Chosen |
| `express-jwt` middleware package | Ready-made Bearer parsing | Adds a runtime dependency and custom error-format adapter | Rejected |
| `jose` library | Modern Web Crypto API | Redundant with `jsonwebtoken` already installed (`D8`) | Rejected |
| Plain JavaScript allow-list & UUIDv4 validation in `task-controller.js` | Zero new dependencies; explicit 400 messages matching `API-4` and `SEC-9` | Manual check functions | Chosen |
| External schema validator (`zod`, `joi`, `ajv`, `express-validator`) | Declarative schema DSL | Adds runtime dependency for 3 fields | Rejected |
| HTTP 403 `Forbidden` when task belongs to another user, 404 when missing | Matches `API-3` (403 = known user not allowed) and `SEC-5` directly | Reveals that the task UUID exists | Chosen |

Sources:

- https://www.npmjs.com/package/jsonwebtoken
- https://www.npmjs.com/package/express-jwt
- https://www.npmjs.com/package/jose
- https://www.npmjs.com/package/zod
- https://www.npmjs.com/package/joi
- https://mihai-gheorghe.gitbook.io/pwcc-suport-curs/backend-in-javascript/autentificare

## Constraints and assumptions

- Node.js 22+, Express 5, CommonJS modules, and zero new runtime dependencies.
- `jsonwebtoken` verifies tokens with `{ algorithms: ["HS256"] }` (`SEC-3`) using `jwtSecret` passed via app options or `process.env.JWT_SECRET` (`SEC-6`).
- Services remain transport-agnostic (`D10`, `D11`, `D15`): `task-service` throws domain errors with `err.code` (`TASK_NOT_FOUND`, `TASK_FORBIDDEN`) without `err.status`, and `task-controller` maps them to 404 and 403.
- Existing tests in `test/tasks.test.js` and `test/seed.test.js` will be updated only where their requirements changed (authenticating `/tasks` requests, `userId` on tasks, and rejecting unknown fields / non-UUID `:id` per `TEST-7`).

## Impact

- Code areas touched: `src/middleware/authenticate.js` (new), `src/app.js`, `src/routes/tasks.js`, `src/controllers/task-controller.js`, `src/services/task-service.js`, `src/storage/task-store.js`, `src/seed.js`, `test/tasks.test.js`, `test/seed.test.js`, `README.md`, `postman/task-api.postman_collection.json`.
- Blast radius: Medium (all `/tasks` routes now require a Bearer token and include `userId`; existing unauthenticated `/tasks` tests and seed tasks are updated accordingly).
- Increment budget: Fits (7 production files, ~150 changed lines of production code, 0 new runtime dependencies).

## Split and placeholders

None needed; `task-authorization` fits within a single increment budget.

## Follow-ups

- `firestore-storage`: Cloud Firestore behind the storage module; tests on the Firestore emulator.
- `security-hardening`: Add `helmet` security headers and `express-rate-limit` on `/auth/login` (`SEC-7`).

## Open questions

- None
