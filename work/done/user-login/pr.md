---
task: user-login
artifact: pr
branch: user-login
base: main
updated_commit: none
pr: https://github.com/silviuser/task-api/pull/3
---

# feat(auth): add user login endpoint with JWT authentication

## Summary

Allow registered users to sign in via `POST /auth/login` with email and password, validating input, verifying credentials in constant time against a bcrypt hash without revealing whether an account exists, and returning a signed HS256 JSON Web Token (`JWT`) valid for 1 hour. Enforces `JWT_SECRET` configuration on application startup.

## Changes

- `package.json`, `package-lock.json`: added `jsonwebtoken@^9.0.3` runtime dependency
- `src/storage/user-store.js`: added and exported `findUserByEmail(email, options)` for serialized, case-insensitive user lookup returning a shallow copy of the user record
- `src/app.js`: enforced required `JWT_SECRET` configuration (`options.jwtSecret ?? process.env.JWT_SECRET`) on startup and passed `jwtSecret` to the auth router
- `src/routes/auth.js`: added `DUMMY_PASSWORD_HASH`, `validateLoginInput(body)`, and `POST /auth/login` handler with timing-protected bcrypt verification and 1h HS256 JWT signing
- `test/auth.test.js`, `test/health.test.js`, `test/middleware.test.js`: updated existing test setups to pass `jwtSecret` and added automated tests `T1`–`T7` covering login, validation, 401 timing protection, storage lookup, and missing `JWT_SECRET` startup failure
- `postman/task-api.postman_collection.json`, `README.md`: added repeatable login requests (`200`, `400`, `401`), `JWT_SECRET` configuration docs, and curl examples

## How to test

```bash
npm ci
npm test
npm run lint
```

Manual checks:
1. Verify startup refuses missing `JWT_SECRET`: `env -u JWT_SECRET npm start` exits non-zero with `Error: JWT_SECRET is required`.
2. Start the server with `JWT_SECRET=dev-secret-key npm start`.
3. Register a user with `POST /auth/register` (`{"email":"user@example.com","password":"Password123!"}`) and sign in via `POST /auth/login` (exact and uppercase/padded email) -> returns `200 OK` with `{"token":"<jwt>"}` (HS256, `sub`, `email`, `exp - iat === 3600`).
4. Call `POST /auth/login` with a wrong password or an unregistered email -> both return `401 Unauthorized` with `{"error":"Invalid email or password"}`.
5. Call `POST /auth/login` with invalid email format, empty password, or `>72`-byte UTF-8 password -> returns `400 Bad Request` with `{"error":"<message>"}`.

## Quality gates

| Gate | Task file | Result |
| --- | --- | --- |
| Plan critique | `critique.md`, round 1 | approved |
| Code review | `review.md`, round 1 | approved |
| Tests | `test-report.md`, round 1 | pass |

## Tech debt

- None

## Follow-ups

- `controllers-services`: Restructure routes, controllers, and services without changing behavior.
- `task-authorization`: Add `authenticate` middleware (`SEC-4`) and protect `/tasks` routes.
- `security-hardening`: Add `helmet` and `express-rate-limit` on `/auth/login` (`SEC-7`).
