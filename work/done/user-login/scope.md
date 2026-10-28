---
task: user-login
artifact: scope
version: 1
status: confirmed
branch: user-login
roadmap_item: user-login
---

# Scope: User login

## Goal

Allow registered users to sign in via `POST /auth/login` with email and password, validating input, verifying credentials in constant time without revealing whether an account exists, and returning a signed JSON Web Token (`JWT`).

## Requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| R1 | `POST /auth/login` issues a JWT for valid credentials | Given a registered user's email (case-insensitive) and matching password, when `POST /auth/login` is called, then it returns HTTP 200 with `{ "token": "<jwt>" }` signed with HS256, `expiresIn: "1h"`, and payload `{ sub: user.id, email: user.email }`. |
| R2 | Input validation for login email and password | Given a request with missing, non-string, blank, or invalid-format email, or a missing, non-string, empty, or `>72`-byte password, when `POST /auth/login` is called, then it returns HTTP 400 with `{ "error": "<message>" }`. |
| R3 | Uniform 401 response and timing protection on invalid credentials | Given a valid-format login request with an unregistered email or wrong password, when `POST /auth/login` is called, then it compares against a bcrypt hash (using a fixed dummy hash when the email is unknown) and returns HTTP 401 with `{ "error": "Invalid email or password" }`. |
| R4 | Lookup user by email in the storage module | Given an email string, when `findUserByEmail` is called on `src/storage/user-store.js`, then it asynchronously returns the matching user record (including `passwordHash`) case-insensitively or `null` if not found. |
| R5 | Require `JWT_SECRET` configuration | Given `JWT_SECRET` is not provided in environment variables or app options, when the application starts, then it throws a configuration error and refuses to start. |
| R6 | Manual verification examples for login | Given a running API server, when executing the login requests in `README.md` or `postman/task-api.postman_collection.json`, then valid credentials return 200 with a JWT and invalid credentials return 401. |

## Out of scope

- Authentication middleware (`authenticate`) for protected routes (deferred to `task-authorization`).
- Role claim in JWT and role-based access control (deferred to `task-authorization`).
- Rate limiting (`express-rate-limit`) and security headers (`helmet`) from `SEC-7` (deferred to a follow-up to respect the 1-runtime-dependency budget).
- Token refresh, revocation lists, or logout endpoints.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| `jsonwebtoken` (`^9.0.3`) | Explicitly specified in `SEC-3` (`jwt.sign`, `jwt.verify`), synchronous signing, ubiquitous in Express/CommonJS | Older architecture than Web Crypto libraries | Chosen |
| `jose` (`^6.2.13`) | Modern Web Crypto API, full JOSE suite, zero dependencies | Async-only API differs from `SEC-3` conventions | Rejected |
| `fast-jwt` (`^6.3.5`) | High throughput with signer/verifier caching | Different API surface from `SEC-3`; overkill for course scope | Rejected |

Sources:

- https://www.npmjs.com/package/jsonwebtoken
- https://www.npmjs.com/package/jose
- https://www.npmjs.com/package/fast-jwt

## Constraints and assumptions

- Node.js 22+ with Express 5 and CommonJS modules (`require`, `module.exports`).
- Exactly one new runtime dependency added: `jsonwebtoken`.
- `JWT_SECRET` comes from `process.env.JWT_SECRET` (or `options.jwtSecret` in tests, per `API-7` and `SEC-6`).
- Existing tests in `test/health.test.js` and `test/auth.test.js` continue passing (`TEST-7`).

## Impact

- Code areas touched: `package.json`, `package-lock.json`, `src/server.js`, `src/app.js`, `src/routes/auth.js`, `src/storage/user-store.js`, `test/auth.test.js`, `test/health.test.js`, `postman/task-api.postman_collection.json`, `README.md`.
- Blast radius: Low-medium (`createApp` / server startup requires `JWT_SECRET`, so existing test setups will pass a test `jwtSecret` or set `process.env.JWT_SECRET`).
- Increment budget: Fits (approx. 70-100 changed lines of production code across 4 production files, 1 new runtime dependency `jsonwebtoken`).

## Split and placeholders

None needed; `user-login` fits within a single increment budget.

## Follow-ups

- `controllers-services`: Restructure routes, controllers, and services without changing behavior.
- `task-authorization`: Add `authenticate` middleware (`SEC-4`) and protect `/tasks` routes.
- `security-hardening`: Add `helmet` and `express-rate-limit` on `/auth/login` (`SEC-7`).

## Open questions

- None
