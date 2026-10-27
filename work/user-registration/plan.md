---
task: user-registration
artifact: plan
version: 1
scope_version: 1
answers_critique_round: 0
---

# Plan: User registration

## Summary

Implement `POST /auth/register` to register new users with email and password. Input validation enforces email format and password length (8-72 bytes), passwords are hashed with bcryptjs (cost 10), and user records are stored safely in a local JSON file using promise-serialized atomic writes.

## Context

- `work/user-registration/scope.md`: Confirmed requirements R1-R7 and decisions.
- `docs/ARCHITECTURE.md`: Decisions D1 (Express 5/CJS), D2 (storage abstraction), D4 (testing on free port).
- `docs/standards/`: API-1..API-9 (REST rules), DATA-1..DATA-5 (atomic storage), SEC-1, SEC-9 (security), TEST-1..TEST-4, TEST-8 (testing standards).

## Files

| # | File | Action | Purpose |
| --- | --- | --- | --- |
| 1 | `package.json` | modify | Add `bcryptjs` runtime dependency (`SEC-1`) |
| 2 | `src/storage/user-store.js` | create | Local JSON persistence with serialized check-then-write (`DATA-1`, `DATA-3`, `DATA-5`) |
| 3 | `src/routes/auth.js` | create | Input validation and `POST /auth/register` route handler (`API-1`, `API-3`, `API-5`, `SEC-1`) |
| 4 | `src/app.js` | modify | Mount `/auth` router in application factory (`API-7`) |
| 5 | `test/auth.test.js` | create | Automated tests for registration, validation, duplicate prevention, and storage (`TEST-1`..`TEST-4`) |
| 6 | `postman/task-api.postman_collection.json` | create | Postman collection for repeatable manual testing (`TEST-8`, `R7`) |
| 7 | `README.md` | modify | Add `POST /auth/register` to features and curl manual testing examples (`TEST-8`) |

## Steps

### Step 1. Add `bcryptjs` dependency

Install `bcryptjs@^3.0.3` via `npm install bcryptjs@^3.0.3`, updating `package.json` and `package-lock.json` (`SEC-1`, `GIT-4`).

### Step 2. Create user storage module (`src/storage/user-store.js`)

Implement atomic JSON storage with a promise serialization queue. Enforces check-then-write for email uniqueness (`DATA-5`), writes atomically via a temporary file rename (`DATA-3`), and normalizes email to lowercase.

```javascript
let queue = Promise.resolve();
function serialize(task) {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

async function createUser({ email, passwordHash }, options = {}) {
  const filePath = options.dataFile ?? process.env.DATA_FILE ?? path.resolve("data/users.json");
  return serialize(async () => {
    const users = await readUsers(filePath);
    const normalized = email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalized)) {
      const err = new Error("Email already registered");
      err.code = "DUPLICATE_EMAIL";
      throw err;
    }
    const user = { id: crypto.randomUUID(), email: normalized, passwordHash, createdAt: new Date().toISOString() };
    users.push(user);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
    await fs.rename(tmp, filePath);
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  });
}
```

### Step 3. Create auth router and validation (`src/routes/auth.js`)

Implement pure validation function `validateRegisterInput(body)` (`JS-4`, `JS-8`, `SEC-9`) and router factory `createAuthRouter(options)` (`API-7`). Hash password with `bcryptjs.hash(password, 10)` (`SEC-1`).

```javascript
function validateRegisterInput(body) {
  const { email, password } = body ?? {};
  if (typeof email !== "string" || email.trim() === "") return "email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "invalid email format";
  if (typeof password !== "string" || password.length === 0) return "password is required";
  if (password.length < 8) return "password must be at least 8 characters long";
  if (Buffer.byteLength(password, "utf8") > 72) return "password must not exceed 72 bytes";
  return null;
}

router.post("/register", async (req, res, next) => {
  try {
    const error = validateRegisterInput(req.body);
    if (error) return res.status(400).json({ error });
    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const user = await createUser({ email: req.body.email, passwordHash }, options);
    res.location(`/users/${user.id}`).status(201).json(user);
  } catch (err) {
    if (err.code === "DUPLICATE_EMAIL") return res.status(409).json({ error: err.message });
    next(err);
  }
});
```

### Step 4. Mount auth router in application factory (`src/app.js`)

Import `createAuthRouter` and mount at `/auth`: `app.use("/auth", createAuthRouter(options))` (`API-7`).

### Step 5. Create automated test suite (`test/auth.test.js`)

Write tests using `node:test`, `node:assert/strict`, and `fetch` against port 0 (`TEST-1`, `TEST-2`). Each test run uses a unique temporary directory via `fs.mkdtemp` and cleans up on exit (`TEST-4`).

### Step 6. Add Postman collection and manual verification examples

Create `postman/task-api.postman_collection.json` containing registration success, validation errors, and conflict requests (`R7`). Update `README.md` with features table and curl commands (`TEST-8`).

## Interfaces and data

### Endpoint: `POST /auth/register`

- Headers: `Content-Type: application/json`
- Request body: `{ "email": "user@example.com", "password": "Password123!" }`
- Response `201 Created`:
  - Header: `Location: /users/<id>`
  - Body: `{ "id": "<uuid>", "email": "user@example.com", "createdAt": "<iso-8601>" }`
- Response `400 Bad Request`: `{ "error": "<message>" }`
- Response `409 Conflict`: `{ "error": "Email already registered" }`

### Data entity (`data/users.json`)

```json
[
  {
    "id": "e8d64478-f73c-4e89-b235-94f4791e8460",
    "email": "user@example.com",
    "passwordHash": "$2a$10$...",
    "createdAt": "2026-10-27T18:00:00.000Z"
  }
]
```

Configuration: `DATA_FILE` (defaults to `data/users.json`, overridden via `options.dataFile` in tests).
Dependency: `bcryptjs@^3.0.3` (1 runtime dependency).

## Tests

| ID | File | Checks | Requirement | New / existing |
| --- | --- | --- | --- | --- |
| T1 | `test/auth.test.js` | Valid registration returns 201, `Location` header, and user without secrets | R1, R5 | new |
| T2 | `test/auth.test.js` | Missing, blank, or invalid email format returns 400 | R2 | new |
| T3 | `test/auth.test.js` | Password shorter than 8 characters returns 400 | R3 | new |
| T4 | `test/auth.test.js` | Password longer than 72 bytes returns 400 | R3 | new |
| T5 | `test/auth.test.js` | Duplicate email returns 409 Conflict | R4 | new |
| T6 | `test/auth.test.js` | Duplicate email check is case-insensitive | R4 | new |
| T7 | `test/auth.test.js` | User record stored in file has bcrypt hash cost 10 and no plain text password | R5, R6 | new |
| T8 | `test/auth.test.js` | Concurrent registration requests for same email serialize safely (one 201, one 409) | R4, R6 | new |
| E1 | `test/health.test.js` | `GET /health` continues to return 200 | - | existing |
| E2 | `test/middleware.test.js` | Request logger, 404, 400, and 500 error handlers continue passing | - | existing |

Commands:
- `npm test`: Runs all `node:test` test suites.
- `npm run lint`: ESLint verification, must report zero errors.
- Manual check: `curl -i -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"Password123!"}'`

## Placeholders and tech debt

| Placeholder | Why | Removed by |
| --- | --- | --- |
| None | Feature is fully functional with atomic file storage; no placeholders needed | - |

## Size

- Production code: about 115 changed lines in 4 files (`package.json`, `src/app.js`, `src/storage/user-store.js`, `src/routes/auth.js`); new runtime dependencies: `bcryptjs`
- Increment budget: fits (budget allows up to 300 lines production code, 10 files, and 1 runtime dependency)

## Risks

- Concurrent registration race: simultaneous requests with the same email could race. Mitigation: promise serialization queue in `user-store.js` guarantees atomic check-then-write (`DATA-5`).
- Crash during file write: process termination could leave incomplete JSON. Mitigation: write to unique `.tmp` file and atomic `fs.rename` (`DATA-3`).

## Changes since the previous version

None; initial plan version.
