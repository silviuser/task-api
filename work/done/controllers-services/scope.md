---
task: controllers-services
artifact: scope
version: 1
status: confirmed
branch: controllers-services
roadmap_item: controllers-services
---

# Scope: Controllers and services restructuring

## Goal

Restructure the Express application into distinct route, controller, and service layers (`src/routes/`, `src/controllers/`, `src/services/`) with zero change in external HTTP behavior.

## Requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| R1 | Separate route definitions from request handling | Given `src/routes/health.js` and `src/routes/auth.js`, when inspected and mounted in `createApp`, then they only bind HTTP paths and methods to controller handlers without inline business or validation logic. |
| R2 | Health controller handles `GET /health` HTTP response | Given `src/controllers/health-controller.js`, when `GET /health` is requested, then the controller responds with HTTP 200 and `{ "status": "ok" }`. |
| R3 | Auth controller validates HTTP input and formats HTTP responses | Given `src/controllers/auth-controller.js`, when `POST /auth/register` or `POST /auth/login` is called, then the controller validates request body fields (returning HTTP 400 on invalid input), delegates to the auth service, and formats the HTTP 201 (with `Location: /users/<id>`) or HTTP 200 (`{ "token": "<jwt>" }`) response. |
| R4 | Auth service encapsulates registration and login business logic | Given `src/services/auth-service.js`, when `registerUser` or `loginUser` is called, then it performs bcrypt password hashing (cost 10), timing-safe credential verification against `DUMMY_PASSWORD_HASH`, JWT signing (`HS256`, `1h`), and `user-store` calls without referencing Express `req` or `res` objects. |
| R5 | Domain and status errors map cleanly to HTTP responses | Given a duplicate email during registration or invalid credentials during login, when the auth service throws a domain/status error, then the HTTP response returns 409 `{ "error": "Email already registered" }` or 401 `{ "error": "Invalid email or password" }` respectively. |
| R6 | Zero regression in existing API behavior and test suite | Given the existing test suites (`test/health.test.js`, `test/middleware.test.js`, `test/auth.test.js`) and new service/controller unit tests, when `npm test` and `npm run lint` run, then all tests pass and ESLint reports zero issues. |

## Out of scope

- Any change to HTTP endpoints, status codes, headers, or JSON response payloads.
- Task CRUD endpoints, controllers, or services (deferred to `task-crud`).
- Authentication or authorization middleware (deferred to `task-authorization`).
- Changes to the persistence implementation in `src/storage/user-store.js`.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Plain / factory functions for controllers and services | Matches existing `createApp`, `createRequestLogger`, and `user-store` conventions; simple dependency passing (`options`) and pure functions (`JS-4`, `JS-8`) | None in this codebase | Chosen |
| ES6 classes (`AuthController`, `AuthService`) | Familiar OOP structure | Adds `this`-binding boilerplate when passing methods as Express route callbacks | Rejected |
| Controller validates HTTP input; Service handles business logic | Keeps HTTP input shape validation at the transport boundary while keeping service Express-agnostic | Validation errors are checked before calling the service | Chosen |
| Service handles both HTTP input validation and business logic | Single layer for all checks | Couples service layer to raw untyped request body shapes | Rejected |
| Health route + controller only (no health service) | Avoids a pass-through layer for a static `{ status: "ok" }` response | No `health-service.js` file | Chosen |

Sources:

- https://expressjs.com/en/5x/api.html#router
- https://mihai-gheorghe.gitbook.io/pwcc-suport-curs/backend-in-javascript/express
- https://mihai-gheorghe.gitbook.io/pwcc-suport-curs/backend-in-javascript/api-rest

## Constraints and assumptions

- Node.js 22+ with Express 5 and CommonJS modules (`require`, `module.exports`).
- Zero new runtime dependencies.
- `createApp(options)` signature and behavior remain unchanged so all existing tests run unmodified (`TEST-7`).
- Services do not import Express or access `req`/`res` (`JS-4`, `JS-8`).

## Impact

- Code areas touched: `src/routes/health.js`, `src/routes/auth.js`, `src/controllers/health-controller.js`, `src/controllers/auth-controller.js`, `src/services/auth-service.js`, `test/auth.test.js`.
- Blast radius: Low-medium (internal restructuring of `health` and `auth` layers; public HTTP interface and `createApp` contract are unchanged).
- Increment budget: Fits (5 production files, ~140 lines of production code, 0 new runtime dependencies).

## Split and placeholders

None needed; the refactoring fits within a single increment budget.

## Follow-ups

- `task-crud`: CRUD on `/tasks` using the routes, controllers, services, and storage layers.

## Open questions

- None
