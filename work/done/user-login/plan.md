---
task: user-login
artifact: plan
version: 1
scope_version: 1
answers_critique_round: 0
---

# Plan: User login

## Summary

Implement `POST /auth/login` to authenticate registered users with email and password and issue a signed JSON Web Token (`JWT`) valid for 1 hour. Input validation enforces email format and password length (`1..72` bytes), unknown emails compare against a fixed dummy bcrypt hash for constant-time timing protection, and application startup enforces `JWT_SECRET` configuration.

## Context

- `work/user-login/scope.md`: Confirmed requirements R1-R6 and `jsonwebtoken@^9.0.3` selection.
- `docs/ARCHITECTURE.md`: Decisions D1 (Express 5/CJS), D2 (storage abstraction), D3 (stateless JWT auth), D6 (`bcryptjs` cost 10).
- `docs/standards/`: `API-1`, `API-3`, `API-4`, `API-5`, `API-7`, `API-9` (REST conventions), `DATA-1`, `DATA-2` (storage module), `JS-1`..`JS-10` (clean JS), `SEC-1`, `SEC-2`, `SEC-3`, `SEC-6`, `SEC-9`, `SEC-10` (auth & secrets), `TEST-1`..`TEST-4`, `TEST-6`..`TEST-8` (testing).
- `src/routes/auth.js`, `src/storage/user-store.js`, `src/app.js`: Existing registration flow and storage serialization queue to extend.

## Files

| # | File | Action | Purpose |
| --- | --- | --- | --- |
| 1 | `package.json` | modify | Add `jsonwebtoken@^9.0.3` runtime dependency (`SEC-3`) |
| 2 | `src/storage/user-store.js` | modify | Add `findUserByEmail(email, options)` serialized lookup (`DATA-1`, `DATA-2`, `R4`) |
| 3 | `src/app.js` | modify | Require `jwtSecret` (`options.jwtSecret ?? process.env.JWT_SECRET`) on startup (`SEC-6`, `R5`) |
| 4 | `src/routes/auth.js` | modify | Add `validateLoginInput(body)` and `POST /auth/login` handler with timing protection and JWT signing (`SEC-1`..`SEC-3`, `R1`..`R3`) |
| 5 | `test/health.test.js` | modify | Pass test `jwtSecret` to `createApp` so existing health tests pass with `R5` (`TEST-7`) |
| 6 | `test/middleware.test.js` | modify | Pass test `jwtSecret` to `createApp` so existing middleware tests pass with `R5` (`TEST-7`) |
| 7 | `test/auth.test.js` | modify | Pass test `jwtSecret` and add login, timing-protection, storage lookup, and missing-secret tests (`TEST-1`..`TEST-4`, `TEST-6`) |
| 8 | `postman/task-api.postman_collection.json` | modify | Add manual login requests (200, 400, 401) (`TEST-8`, `R6`) |
| 9 | `README.md` | modify | Document `JWT_SECRET` setting and `POST /auth/login` curl example (`TEST-8`, `R6`) |

## Steps

### Step 1. Install `jsonwebtoken`

Run `npm install jsonwebtoken@^9.0.3` to add the runtime dependency and update `package.json` and `package-lock.json` (`SEC-3`, `GIT-4`).

### Step 2. Add `findUserByEmail` to `src/storage/user-store.js`

Add an asynchronous `findUserByEmail(email, options = {})` function that runs inside `serialize()` so reads wait for any pending writes (`DATA-1`, `DATA-2`). Normalize `email` with `.trim().toLowerCase()` and return a shallow copy (`{ ...user }`, `JS-8`) of the matching user record (including `passwordHash`) or `null` if not found (`R4`). Export `findUserByEmail`.

```javascript
async function findUserByEmail(email, options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    const users = await readUsers(filePath);
    const normalized = String(email).trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === normalized);
    return user ? { ...user } : null;
  });
}
```

### Step 3. Enforce `JWT_SECRET` in `src/app.js`

Resolve `const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET` at the start of `createApp(options = {})` (`JS-9`, `SEC-6`). If `typeof jwtSecret !== "string" || jwtSecret.trim() === ""`, throw `new Error("JWT_SECRET is required")` (`R5`). Pass `{ ...options, jwtSecret }` to `createAuthRouter`.

```javascript
function createApp(options = {}) {
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET;
  if (typeof jwtSecret !== "string" || jwtSecret.trim() === "") {
    throw new Error("JWT_SECRET is required");
  }
  const app = express();
  // ...
  app.use("/auth", createAuthRouter({ ...options, jwtSecret }));
```

### Step 4. Implement `validateLoginInput` and `POST /auth/login` in `src/routes/auth.js`

Define `DUMMY_PASSWORD_HASH` (a cost-10 bcrypt hash constant, `JS-1`, `SEC-2`) and pure helper `validateLoginInput(body)` (`JS-4`, `JS-8`, `API-5`, `SEC-1`, `SEC-9`) checking email presence/format and password presence/non-empty/`<= 72` UTF-8 bytes. In `router.post("/login", ...)`, validate input (400 on error), look up the user with `findUserByEmail`, compare `req.body.password` against `user ? user.passwordHash : DUMMY_PASSWORD_HASH` (`SEC-2`), return `401 { error: "Invalid email or password" }` when `!user || !matches` (`API-3`, `API-4`, `R3`), and sign the token with `jwt.sign({ sub: user.id, email: user.email }, options.jwtSecret, { algorithm: "HS256", expiresIn: "1h" })` (`SEC-3`, `R1`).

```javascript
// Precomputed cost-10 bcrypt hash used when email is not found to prevent timing enumeration (SEC-2).
const DUMMY_PASSWORD_HASH = "$2b$10$H59/MKXi10CBrp8brax7duDggewgxngBn52fc7imdDRuVx1J4myBK";

router.post("/login", async (req, res, next) => {
  try {
    const error = validateLoginInput(req.body);
    if (error) return res.status(400).json({ error });
    const user = await findUserByEmail(req.body.email, options);
    const targetHash = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
    const matches = await bcrypt.compare(req.body.password, targetHash);
    if (!user || !matches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ sub: user.id, email: user.email }, options.jwtSecret, {
      algorithm: "HS256",
      expiresIn: "1h",
    });
    return res.status(200).json({ token });
  } catch (err) {
    return next(err);
  }
});
```

### Step 5. Update existing test setups and add login tests

In `test/health.test.js`, `test/middleware.test.js`, and `test/auth.test.js`, pass `jwtSecret: "test-jwt-secret"` in `createApp(...)` options (`TEST-7`, noting why existing test setup changes). Add tests `T1`..`T7` in `test/auth.test.js` covering valid login & JWT verification (`jwt.verify` with `algorithms: ["HS256"]`), case-insensitive email login, input validation errors, unknown email 401, wrong password 401, `findUserByEmail` unit behavior, and missing `JWT_SECRET` startup error (`TEST-1`..`TEST-4`, `TEST-6`).

### Step 6. Update Postman collection and `README.md`

Add `Login - Success (200)`, `Login - Invalid Input (400)`, and `Login - Invalid Credentials (401)` requests to `postman/task-api.postman_collection.json`, and document `JWT_SECRET` and `POST /auth/login` curl examples in `README.md` (`TEST-8`, `R6`).

## Interfaces and data

### Endpoint: `POST /auth/login`

- Headers: `Content-Type: application/json`
- Request body: `{ "email": "user@example.com", "password": "Password123!" }`
- Response `200 OK`: `{ "token": "<jwt>" }` (HS256, `expiresIn: "1h"`, claims `{ sub: "<user.id>", email: "<user.email>", iat, exp }`)
- Response `400 Bad Request`: `{ "error": "email is required" | "invalid email format" | "password is required" | "password must not exceed 72 bytes" }`
- Response `401 Unauthorized`: `{ "error": "Invalid email or password" }`

### Storage function (`src/storage/user-store.js`)

- `findUserByEmail(email, options)` -> `Promise<{ id, email, passwordHash, createdAt } | null>`

### Configuration and dependencies

- Environment variable: `JWT_SECRET` (required; no default; overridden in tests via `options.jwtSecret`).
- New runtime dependency: `jsonwebtoken@^9.0.3`.

## Tests

| ID | File | Checks | Requirement | New / existing |
| --- | --- | --- | --- | --- |
| T1 | `test/auth.test.js` | `POST /auth/login` with valid credentials (and uppercase email) returns 200 and a valid HS256 JWT with `sub`, `email`, and 1h expiry | R1 | new |
| T2 | `test/auth.test.js` | `POST /auth/login` with missing, blank, or invalid email format returns 400 | R2 | new |
| T3 | `test/auth.test.js` | `POST /auth/login` with missing, empty, non-string, or `>72`-byte password returns 400 | R2 | new |
| T4 | `test/auth.test.js` | `POST /auth/login` with wrong password returns 401 `{ error: "Invalid email or password" }` | R3 | new |
| T5 | `test/auth.test.js` | `POST /auth/login` with unregistered email returns 401 with identical error message | R3 | new |
| T6 | `test/auth.test.js` | `findUserByEmail` returns matching user (with `passwordHash`) case-insensitively and `null` when unknown | R4 | new |
| T7 | `test/auth.test.js` | `createApp` throws when `JWT_SECRET` is missing or blank | R5 | new |
| E1 | `test/auth.test.js` | Existing `POST /auth/register` tests (T1..T8 from `user-registration`) continue passing | - | existing |
| E2 | `test/health.test.js` | `GET /health` continues returning 200 | - | existing |
| E3 | `test/middleware.test.js` | Request logger, 404, 400, and 500 error handlers continue passing | - | existing |

Commands:
- `npm test`: Runs all `node:test` suites (`test/*.test.js`).
- `npm run lint`: Runs ESLint (`eslint .`); must report nothing.
- Manual check (`R6`): Start server with `JWT_SECRET=dev-secret-key npm start` and run `curl -i -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"Password123!"}'` (expects `200 OK` with `{"token":"..."}` after registering) and with a wrong password (expects `401 Unauthorized` with `{"error":"Invalid email or password"}`).

## Placeholders and tech debt

| Placeholder | Why | Removed by |
| --- | --- | --- |
| None | No placeholders needed; `role` claim and auth middleware belong to `task-authorization` and rate limiting belongs to `security-hardening` per roadmap | - |

## Size

- Production code: about 65 changed lines in 4 files (`package.json`, `src/storage/user-store.js`, `src/app.js`, `src/routes/auth.js`); new runtime dependencies: `jsonwebtoken`
- Increment budget: fits (well under 300 lines, 10 files, and max 1 runtime dependency)

## Risks

- Timing side-channel on unknown email: mitigated by always running `bcrypt.compare` against a precomputed cost-10 `DUMMY_PASSWORD_HASH` (`SEC-2`).
- Existing tests failing due to mandatory `JWT_SECRET`: mitigated by passing `jwtSecret` in `createApp` options in `test/health.test.js`, `test/middleware.test.js`, and `test/auth.test.js` (`API-7`, `TEST-7`).

## Changes since the previous version

None; initial plan version.
