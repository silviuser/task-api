---
task: controllers-services
artifact: pr
branch: controllers-services
base: main
updated_commit: none
pr: https://github.com/silviuser/task-api/pull/4
---

# refactor(auth): split routes into controllers and services

## Summary

Restructure the Express application into distinct route, controller and service layers (`src/routes/`, `src/controllers/`, `src/services/`) with zero change in external HTTP behavior. Routes only bind paths to handlers, controllers validate input and format HTTP responses, and the auth service holds the registration and login business logic without any Express dependency.

## Changes

- `src/controllers/health-controller.js` (new), `src/routes/health.js`: `GET /health` handler moved into `getHealth`; the route only binds it
- `src/services/auth-service.js` (new): `registerUser` (bcrypt cost 10, `createUser`, `DUPLICATE_EMAIL` with status 409) and `loginUser` (constant-time comparison against the user hash or `DUMMY_PASSWORD_HASH`, `INVALID_CREDENTIALS` with status 401, HS256 JWT valid for 1 hour); no Express, `req` or `res`
- `src/controllers/auth-controller.js` (new): `validateRegisterInput` and `validateLoginInput` moved unchanged; `createAuthController(options)` returns `register` and `login` handlers that validate (400), call the service, format 201 with `Location: /users/<id>` or 200 `{ token }`, map `DUPLICATE_EMAIL` to 409 and `INVALID_CREDENTIALS` to 401, and forward any other error to `next`
- `src/routes/auth.js`: only creates the router and binds `POST /register` and `POST /login`; now exports `createAuthRouter` only (the validators are exported from the controller)
- `test/auth.test.js`: 8 new unit tests for the auth service, the auth controller and the health controller; existing tests unchanged
- No new runtime dependencies; public endpoints and the `createApp(options)` signature are unchanged

## How to test

```bash
npm ci
npm test
npm run lint
```

Expected: 29 tests pass, lint reports nothing.

Manual checks (`JWT_SECRET=<secret> npm start`):

1. `GET /health` returns 200 `{"status":"ok"}`; `GET /unknown` returns 404 with the standard error.
2. `POST /auth/register` with `{"email":"  user@example.com ","password":"Password123!"}` returns 201, `Location: /users/<id>` and the user without secrets; the same e-mail in another case returns 409 `Email already registered`.
3. Register with an invalid e-mail, a short or non-string password, a password over 72 bytes, or malformed JSON returns 400 with the same messages as before.
4. `POST /auth/login` with a mixed-case e-mail returns 200 `{"token":"<jwt>"}` (HS256, `sub`, `email`, `exp - iat = 3600`).
5. Login with a wrong password or an unknown e-mail both return 401 `Invalid email or password`, in similar time.

## Quality gates

| Gate | Task file | Result |
| --- | --- | --- |
| Plan critique | `critique.md`, round 1 | approved |
| Code review | `review.md`, round 1 | approved |
| Tests | `test-report.md`, round 1 | pass |

## Tech debt

- None. Review note F1 (nit, accepted): HTTP status for domain errors is defined both in the service (`err.status`) and in the controller (by `err.code`); pick one mapping when `task-crud` adds more domain errors.

## Follow-ups

- `task-crud`: CRUD on `/tasks` using the routes, controllers, services and storage layers.
