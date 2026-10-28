---
task: controllers-services
artifact: dev-log
plan_version: 1
round: 1
status: done
---

# Development log: controllers-services

One entry per increment, in commit order: a plan step, or a fix in a fix round. The code review reads the increments one by one, so each entry says what the reviewer needs to know about its commit.

## Increment 1: plan step "1. Create health controller and update health route"

- Commit: `0263aaa` refactor(health): move health handler into controller
- Changes: `src/controllers/health-controller.js`: new, exports `getHealth` sending `{ status: "ok" }`; `src/routes/health.js`: binds `GET /` to `getHealth`, no inline handler
- Decisions: none
- Tests: none new in this step (T1 existing, passes unchanged)
- Review focus: none; behavior identical
- Deviation from the plan: none

## Increment 2: plan step "2. Create authentication service"

- Commit: `3267c0f` refactor(auth): add auth service for registration and login
- Changes: `src/services/auth-service.js`: new, `registerUser` (bcrypt cost 10, `createUser`, adds `status = 409` to `DUPLICATE_EMAIL`) and `loginUser` (`findUserByEmail`, compare against user hash or `DUMMY_PASSWORD_HASH`, throws `INVALID_CREDENTIALS`/401, signs `HS256` `1h` JWT); no Express imports
- Decisions: `try`/`catch` wraps only `createUser`, so bcrypt errors propagate untouched; original `SEC-1`/`SEC-2` comments moved with the code
- Tests: none in this step (service not wired yet; T4 in step 4)
- Review focus: `loginUser` always runs `bcrypt.compare`, also for unknown e-mails (`SEC-2` timing); same error message for both failure cases
- Deviation from the plan: none

## Increment 3: plan step "3. Create authentication controller and update auth route"

- Commit: `55a3a67` refactor(auth): move auth handlers into controller
- Changes: `src/controllers/auth-controller.js`: new, moved `validateRegisterInput`/`validateLoginInput` unchanged, `createAuthController(options)` returns `register`/`login` handlers that validate, call the service and format 201/200, map `DUPLICATE_EMAIL` → 409 and `INVALID_CREDENTIALS` → 401, otherwise `next(err)`; `src/routes/auth.js`: only creates the router and binds the two handlers; exports `createAuthRouter` only
- Decisions: controller maps the known codes explicitly (as the plan says) instead of relying on `err.status` in `errorHandler`; both paths give the same response, per the critique suggestion
- Tests: T1–T3 existing, all pass unchanged
- Review focus: `src/routes/auth.js` no longer exports the validators (nothing else imported them; they are now exported from the controller)
- Deviation from the plan: none

## Increment 4: plan step "4. Add unit tests for service and controller layers"

- Commit: `f0a35dc` test(auth): add unit tests for auth service and controllers
- Changes: `test/auth.test.js`: imports the service and controllers, adds a `createFakeResponse()` helper and 8 tests; existing tests untouched
- Decisions: controller tests call handlers directly with a fake `res` (no HTTP), passing `assert.fail` as `next` where no error is expected; unique e-mails (`service*`, `controller*`) keep tests independent of the shared temp file
- Tests:
  - T4 `registerUser` stores a cost-10 hash and returns the user without secrets
  - T4 `registerUser` duplicate (case-insensitive) throws `DUPLICATE_EMAIL`, status 409
  - T4 `loginUser` valid credentials returns an `HS256` JWT with `sub`, `email`, 1h expiry
  - T4 `loginUser` wrong password and unknown e-mail both throw `INVALID_CREDENTIALS`, status 401
  - T5 validators return `null` for valid input and a message for invalid input
  - T5 controller `register`: 400 on invalid input, 201 with `Location` on success
  - T5 controller `login`: 401 on bad credentials; unexpected error (missing JWT secret) is forwarded to `next`
  - T5 `getHealth` responds `{ status: "ok" }`
- Review focus: the `next`-forwarding test relies on `jwt.sign` throwing without a secret
- Deviation from the plan: none

## Commands

| Command | Result |
| --- | --- |
| test: `npm test` | 29 passed, 0 failed |
| lint: `npm run lint` | no problems |

## Notes for testing

- Pure refactoring: HTTP behavior of `GET /health`, `POST /auth/register` and `POST /auth/login` is unchanged; the Postman collection and README curl commands apply as before.
- Start with `JWT_SECRET=<secret> npm start` (or `npm run dev` with `.env`).
