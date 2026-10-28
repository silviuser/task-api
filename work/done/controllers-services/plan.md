---
task: controllers-services
artifact: plan
version: 1
scope_version: 1
answers_critique_round: 0
---

# Plan: Controllers and services restructuring

## Summary

Extract HTTP request validation and response formatting from route definitions into `src/controllers/`, and move authentication business logic (password hashing, timing-safe comparison, JWT signing, and storage calls) into `src/services/auth-service.js`. Route modules in `src/routes/` become thin wiring layers that bind HTTP methods and paths to controller handlers, with zero changes to external HTTP behavior or `createApp(options)`.

## Context

- `docs/ARCHITECTURE.md`: Defines component boundaries, Express 5 request flow (`D1`), storage encapsulation (`D2`), `bcryptjs` cost-10 hashing (`D6`), `jsonwebtoken` `HS256` `1h` tokens (`D8`), and constant-time dummy hash comparison (`D9`).
- `src/app.js`: Mounts `healthRouter` at `/health` and `createAuthRouter({ ...options, jwtSecret })` at `/auth`; remains unchanged (`TEST-7`).
- `src/routes/health.js`: Currently contains an inline handler returning `{ status: "ok" }`.
- `src/routes/auth.js`: Currently combines input validation, `bcryptjs` hashing/comparison, `jsonwebtoken` signing, `user-store` calls, and Express response formatting in a single file.
- `src/storage/user-store.js`: Exports `createUser`, `findUserByEmail`, and `readUsers` (`DATA-1`, `DATA-2`).

## Files

| # | File | Action | Purpose |
| --- | --- | --- | --- |
| 1 | `src/controllers/health-controller.js` | create | Handle `GET /health` and send HTTP 200 `{ status: "ok" }` (`R2`) |
| 2 | `src/routes/health.js` | modify | Bind `GET /` to `getHealth` controller handler without inline logic (`R1`) |
| 3 | `src/services/auth-service.js` | create | Encapsulate `registerUser` and `loginUser` business logic (`R4`, `R5`) |
| 4 | `src/controllers/auth-controller.js` | create | Validate request body inputs, call `auth-service`, and format HTTP responses (`R3`, `R5`) |
| 5 | `src/routes/auth.js` | modify | Bind `POST /register` and `POST /login` to auth controller handlers (`R1`) |
| 6 | `test/auth.test.js` | modify | Add direct unit tests for `auth-service`, `auth-controller`, and `health-controller` layers (`R2`, `R3`, `R4`, `R5`, `R6`) |

## Steps

### Step 1. Create health controller and update health route (`R1`, `R2`)

1. Create `src/controllers/health-controller.js` exporting `getHealth(req, res)` which sends `res.json({ status: "ok" })` (`API-3`, `JS-4`, `JS-6`).
2. Update `src/routes/health.js` to import `{ getHealth }` from `../controllers/health-controller`, bind `router.get("/", getHealth)`, and export `router`.

### Step 2. Create authentication service (`R4`, `R5`)

Create `src/services/auth-service.js` with zero Express dependencies (`JS-4`, `JS-8`, `DATA-1`):

1. Define `DUMMY_PASSWORD_HASH` (cost-10 bcrypt hash) at module scope to prevent timing user enumeration (`SEC-2`, `JS-1`).
2. Implement `registerUser({ email, password }, options = {})`:
   - Hash `password` with `bcrypt.hash(password, 10)` (`SEC-1`).
   - Call `createUser({ email: email.trim(), passwordHash }, options)` (`DATA-1`).
   - If `createUser` throws `err.code === "DUPLICATE_EMAIL"`, attach `err.status = 409` (`API-3`) and rethrow `err`.
   - Return the created user `{ id, email, createdAt }` (`API-9`).
3. Implement `loginUser({ email, password }, options = {})`:
   - Call `findUserByEmail(email, options)` (`DATA-1`).
   - Compare `password` against `user ? user.passwordHash : DUMMY_PASSWORD_HASH` using `bcrypt.compare` (`SEC-1`, `SEC-2`).
   - When `!user || !matches`, throw an `Error("Invalid email or password")` with `err.code = "INVALID_CREDENTIALS"` and `err.status = 401` (`SEC-2`, `API-3`).
   - Sign a JWT with `jwt.sign({ sub: user.id, email: user.email }, options.jwtSecret, { algorithm: "HS256", expiresIn: "1h" })` (`SEC-3`) and return `{ token }`.
4. Export `{ registerUser, loginUser }`.

```javascript
async function loginUser({ email, password }, options = {}) {
  const user = await findUserByEmail(email, options);
  const targetHash = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const matches = await bcrypt.compare(password, targetHash);
  if (!user || !matches) {
    const err = new Error("Invalid email or password");
    err.code = "INVALID_CREDENTIALS";
    err.status = 401;
    throw err;
  }
  const token = jwt.sign({ sub: user.id, email: user.email }, options.jwtSecret, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
  return { token };
}
```

### Step 3. Create authentication controller and update auth route (`R1`, `R3`, `R5`)

1. Create `src/controllers/auth-controller.js` (`JS-4`, `JS-8`, `API-4`, `API-5`, `SEC-9`):
   - Move pure validation functions `validateRegisterInput(body)` and `validateLoginInput(body)` from `src/routes/auth.js`.
   - Implement `createAuthController(options = {})` returning `{ register, login }` handlers:
     - `register(req, res, next)`: validate `req.body` with `validateRegisterInput(req.body)` and return `res.status(400).json({ error })` on error; call `await registerUser(req.body, options)` and return `res.location(\`/users/${user.id}\`).status(201).json(user)`; catch `err` and return `res.status(409).json({ error: err.message })` when `err.code === "DUPLICATE_EMAIL"`, otherwise `next(err)`.
     - `login(req, res, next)`: validate `req.body` with `validateLoginInput(req.body)` and return `res.status(400).json({ error })` on error; call `await loginUser(req.body, options)` and return `res.status(200).json(result)`; catch `err` and return `res.status(401).json({ error: err.message })` when `err.code === "INVALID_CREDENTIALS"`, otherwise `next(err)`.
   - Export `{ createAuthController, validateRegisterInput, validateLoginInput }`.
2. Update `src/routes/auth.js` to import `{ createAuthController }` from `../controllers/auth-controller`, instantiate `const { register, login } = createAuthController(options)` inside `createAuthRouter(options = {})`, bind `router.post("/register", register)` and `router.post("/login", login)`, and export `{ createAuthRouter }`.

```javascript
function createAuthRouter(options = {}) {
  const router = express.Router();
  const { register, login } = createAuthController(options);

  router.post("/register", register);
  router.post("/login", login);

  return router;
}
```

### Step 4. Add unit tests for service and controller layers (`R2`, `R3`, `R4`, `R5`, `R6`)

In `test/auth.test.js`, keep all existing HTTP integration tests intact (`TEST-7`) and add direct layer tests (`TEST-1`, `TEST-3`, `TEST-6`):
1. Test `registerUser` and `loginUser` in `src/services/auth-service.js` directly against the test `dataFile` and `TEST_JWT_SECRET`, verifying user creation without secrets, `DUPLICATE_EMAIL` (status 409) error on duplicate registration, token issuance on valid login, and `INVALID_CREDENTIALS` (status 401) error on invalid login.
2. Test `validateRegisterInput`, `validateLoginInput`, `createAuthController`, and `getHealth` directly to verify input validation and controller response formatting.

## Interfaces and data

- Public HTTP endpoints (`GET /health`, `POST /auth/register`, `POST /auth/login`) and `createApp(options)` signature are unchanged.
- Internal module signatures:
  - `src/controllers/health-controller.js`: `getHealth(req, res)`
  - `src/controllers/auth-controller.js`: `createAuthController(options) -> { register, login }`, `validateRegisterInput(body) -> string | null`, `validateLoginInput(body) -> string | null`
  - `src/services/auth-service.js`: `registerUser({ email, password }, options) -> Promise<{ id, email, createdAt }>`, `loginUser({ email, password }, options) -> Promise<{ token }>`
- Data model, configuration, and runtime dependencies: unchanged (0 new dependencies).

## Tests

| ID | File | Checks | Requirement | New / existing |
| --- | --- | --- | --- | --- |
| T1 | `test/health.test.js` | `GET /health` routed through `src/routes/health.js` and `getHealth` returns 200 `{ status: "ok" }` | R1, R2, R6 | existing |
| T2 | `test/middleware.test.js` | Request logger, 404 handler, malformed JSON 400, and 500 error sanitization | R6 | existing |
| T3 | `test/auth.test.js` | All existing `POST /auth/register`, `POST /auth/login`, `findUserByEmail`, and `createApp` tests pass without modification | R1, R3, R4, R5, R6 | existing |
| T4 | `test/auth.test.js` | `auth-service` (`registerUser`, `loginUser`) creates user, signs JWT, and throws 409 `DUPLICATE_EMAIL` and 401 `INVALID_CREDENTIALS` errors without Express objects | R4, R5 | new |
| T5 | `test/auth.test.js` | `auth-controller` and `health-controller` validate inputs and format responses via route wiring | R1, R2, R3 | new |

Commands: `npm test` and `npm run lint`.

## Placeholders and tech debt

| Placeholder | Why | Removed by |
| --- | --- | --- |
| None | | |

## Size

- Production code: about 145 changed lines in 5 files; new runtime dependencies: none
- Increment budget: fits

## Risks

- Error propagation mismatch between service and controller: mitigated by attaching both `err.code` (`DUPLICATE_EMAIL`, `INVALID_CREDENTIALS`) and `err.status` (`409`, `401`) in `auth-service.js` and handling them in `auth-controller.js` (`API-3`, `API-4`, `API-6`).
