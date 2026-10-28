---
task: user-login
artifact: dev-log
plan_version: 1
round: 1
status: done
---

# Development log: user-login

One entry per increment, in commit order: a plan step, or a fix in a fix round. The code review reads the increments one by one, so each entry says what the reviewer needs to know about its commit.

## Increment 1: 1. Install `jsonwebtoken`

- Commit: `fb64b48` chore(auth): add jsonwebtoken dependency
- Changes: `package.json`: added `jsonwebtoken@^9.0.3` runtime dependency; `package-lock.json`: locked `jsonwebtoken` and its transitive dependencies
- Decisions: none
- Tests: existing test suite (14 tests) passes
- Review focus: dependency version matches plan (`^9.0.3`) and zero audit vulnerabilities (`SEC-3`, `SEC-10`)
- Deviation from the plan: none

## Increment 2: 2. Add `findUserByEmail` to `src/storage/user-store.js`

- Commit: `87e6a93` feat(auth): add findUserByEmail to user storage
- Changes: `src/storage/user-store.js`: added and exported `findUserByEmail(email, options)` running inside `serialize()`, normalizing email with `.trim().toLowerCase()`, and returning a shallow clone `{ ...user }` or `null`
- Decisions: none
- Tests: existing test suite (14 tests) passes
- Review focus: read serialization via `serialize()` and shallow copy return (`DATA-1`, `DATA-2`, `JS-8`, `R4`)
- Deviation from the plan: none

## Increment 3: 3. Enforce `JWT_SECRET` in `src/app.js`

- Commit: `078268a` feat(auth): require JWT_SECRET on application startup
- Changes: `src/app.js`: resolved `jwtSecret` from `options.jwtSecret ?? process.env.JWT_SECRET`, threw `new Error("JWT_SECRET is required")` if missing or blank, and passed `{ ...options, jwtSecret }` to `createAuthRouter`; `test/health.test.js`: passed `jwtSecret: "test-jwt-secret"` to `createApp`; `test/middleware.test.js`: passed `jwtSecret: "test-jwt-secret"` to `createApp`; `test/auth.test.js`: passed `jwtSecret: "test-jwt-secret"` to `createApp`
- Decisions: included existing test setup updates (`E1`–`E3`) in this commit so all existing tests pass after every commit (`GIT-3`, `TEST-7`)
- Tests: E1 (`test/auth.test.js`), E2 (`test/health.test.js`), and E3 (`test/middleware.test.js`) updated to supply `jwtSecret` in test options; all 14 existing tests pass
- Review focus: startup validation of missing and whitespace-only `JWT_SECRET` (`SEC-6`, `R5`)
- Deviation from the plan: applied the existing test setup updates (`test/health.test.js`, `test/middleware.test.js`, `test/auth.test.js`) from Step 5 in Step 3 so that `npm test` continues to pass on this commit (`GIT-3`)

## Increment 4: 4. Implement `validateLoginInput` and `POST /auth/login` in `src/routes/auth.js`

- Commit: `63e01df` feat(auth): add login endpoint with JWT signing and timing protection
- Changes: `src/routes/auth.js`: added `DUMMY_PASSWORD_HASH`, `validateLoginInput(body)`, and `POST /login` route handler with constant-time bcrypt fallback comparison and HS256 1h JWT generation
- Decisions: followed critique suggestion to exclude registration-only minimum length check (`< 8`) in `validateLoginInput` so login does not leak password policy rules, validating only presence, string type, non-empty, and `<= 72` UTF-8 bytes
- Tests: existing test suite (14 tests) passes
- Review focus: constant-time comparison against `DUMMY_PASSWORD_HASH` when user is missing (`SEC-2`), identical 401 message (`R3`), and `jwt.sign` claims (`sub`, `email`), algorithm (`HS256`), and `1h` expiry (`SEC-3`, `R1`)
- Deviation from the plan: none

## Increment 5: 5. Update existing test setups and add login tests

- Commit: `d26cc05` test(auth): add automated tests for login, user lookup, and JWT_SECRET check
- Changes: `test/auth.test.js`: added automated tests T1–T7 for `POST /auth/login` (valid login & case-insensitive email with HS256 JWT verification, email validation 400s, password validation 400s, wrong password 401, unregistered email 401), `findUserByEmail` storage lookup & immutability, and `createApp` missing/blank `JWT_SECRET` error
- Decisions: verified JWT header algorithm (`HS256`), `sub` and `email` claims, exact 3600s `exp - iat` window, and absence of secrets in the token payload using `jwt.verify(..., { algorithms: ["HS256"], complete: true })`
- Tests: T1–T7 added in `test/auth.test.js`; all 21 tests pass (including existing E1–E3)
- Review focus: JWT verification with pinned `algorithms: ["HS256"]` (`SEC-3`), identical 401 responses for wrong password and unknown email (`SEC-2`), and environment isolation in T7 (`TEST-4`)
- Deviation from the plan: existing test setup updates (`E1`–`E3`) were committed in Increment 3 so the suite remained green at every commit

## Increment 6: 6. Update Postman collection and `README.md`

- Commit: `01c8097` docs(auth): add login requests to postman collection and readme
- Changes: `postman/task-api.postman_collection.json`: added `Login - Success (200)`, `Login - Invalid Input (400)`, and `Login - Invalid Credentials (401)` under the `Auth` folder; `README.md`: added `POST /auth/login` to features, `JWT_SECRET` to configuration, `JWT_SECRET=dev-secret-key npm start` to run instructions, and manual curl examples for login (200 and 401)
- Decisions: none
- Tests: all 21 automated tests pass
- Review focus: repeatable curl examples and Postman requests matching `POST /auth/login` contract (`TEST-8`, `R6`)
- Deviation from the plan: none

## Commands

| Command | Result |
| --- | --- |
| test: `npm test` | 21 passed, 0 failed |
| lint: `npm run lint` | no problems |

## Notes for testing

- `JWT_SECRET` is required when starting the server (`JWT_SECRET=dev-secret-key npm start` or configured in `.env` for `npm run dev`).
- Register a user first with `POST /auth/register`, then authenticate with `POST /auth/login` using the same email (case-insensitive) and password to receive `{ "token": "<jwt>" }`.
- Incorrect passwords and unregistered emails both return `401 Unauthorized` with `{ "error": "Invalid email or password" }`.
- Repeatable requests are available in `README.md` and `postman/task-api.postman_collection.json`.





