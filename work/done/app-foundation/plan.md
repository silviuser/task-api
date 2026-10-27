---
task: app-foundation
artifact: plan
version: 1
scope_version: 1
answers_critique_round: 0
---

# Plan: Application foundation

## Summary

Establish the baseline Express 5 API foundation with application factory, port configuration, request logging middleware, health check endpoint (`GET /health`), centralized 404 and error handling, and test/lint infrastructure (`node:test` and ESLint flat config).

## Context

- `work/app-foundation/scope.md`: Requirements R1–R6, constraints (Express 5, CommonJS, 1 runtime dependency).
- `docs/ARCHITECTURE.md`: Decisions D1 (Express 5, CommonJS) and D4 (`node:test`, `fetch`).
- `docs/standards/api.md`: Standards API-3 (status codes), API-4 (error format), API-6 (404 and error handler), API-7 (factory pattern).
- `docs/standards/javascript.md`: JS-1 to JS-10 (naming, CommonJS, strict equality, lint rules).
- `docs/standards/security.md`: SEC-6 (env configuration), SEC-10 (no secrets in logs).
- `docs/standards/testing.md`: TEST-1, TEST-2, TEST-3, TEST-6.

## Files

| # | File | Action | Purpose |
| --- | --- | --- | --- |
| 1 | `package.json` | create | Package metadata, npm scripts (`start`, `dev`, `test`, `lint`), dependencies |
| 2 | `eslint.config.js` | create | ESLint flat configuration (JS-10) |
| 3 | `src/middleware/request-logger.js` | create | Custom request logging middleware (R3, SEC-10) |
| 4 | `src/middleware/error-handler.js` | create | 404 unknown route handler and centralized error handler (R4, R5, API-4, API-6) |
| 5 | `src/routes/health.js` | create | Router exposing `GET /health` returning `{ status: "ok" }` (R2) |
| 6 | `src/app.js` | create | Express app factory `createApp()` assembling middleware and routes (R1, API-7) |
| 7 | `src/server.js` | create | Server startup entry point reading `PORT` from environment (R1, SEC-6) |
| 8 | `test/health.test.js` | create | Automated tests for health check endpoint and server startup (R1, R2, TEST-2) |
| 9 | `test/middleware.test.js` | create | Automated tests for request logger, 404 handler, JSON parser, and error handler (R3, R4, R5) |

## Steps

### Step 1. Project and Tooling Setup

Initialize `package.json` with scripts:
- `start`: `node src/server.js`
- `dev`: `node --env-file=.env --watch src/server.js`
- `test`: `node --test`
- `lint`: `eslint .`

Install runtime dependency `express@^5.0.0` and dev dependencies `eslint@^9.0.0`, `@eslint/js@^9.0.0`, `globals@^15.0.0`.
Configure `eslint.config.js` with Flat Config enforcing `eqeqeq`, `prefer-const`, `no-var`, CommonJS sourceType, and Node globals (JS-6, JS-10).

### Step 2. Request Logging Middleware

Create `src/middleware/request-logger.js` exporting `createRequestLogger(log = console.log)`.
The middleware measures response time using `res.on("finish")` and logs method, URL, status code, and elapsed milliseconds (R3, JS-8, SEC-10).

```javascript
function createRequestLogger(log = console.log) {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      log(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  };
}
```

### Step 3. 404 and Error Handling Middleware

Create `src/middleware/error-handler.js` exporting `notFoundHandler` and `errorHandler` (R4, R5, API-4, API-6).
- `notFoundHandler`: returns HTTP 404 with `{ error: "Route <METHOD> <PATH> does not exist" }`.
- `errorHandler`: extracts `status = err.status ?? err.statusCode ?? 500`. If `>= 500`, logs via `console.error` and responds with `{ error: "Internal server error" }`. Otherwise responds with `{ error: err.message }`. Never returns stack traces.

```javascript
function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} does not exist` });
}

function errorHandler(err, req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message
  });
}
```

### Step 4. Routes, App Factory, and Server Entry Point

1. `src/routes/health.js`: Express Router defining `GET /` that returns `res.json({ status: "ok" })` (R2).
2. `src/app.js`: Export `createApp(options = {})` (API-7). Assembles:
   - `express.json()` for parsing JSON payloads (R5).
   - `createRequestLogger(options.logger)` (R3).
   - Routes mounted at `/health` (R2).
   - `notFoundHandler` followed by `errorHandler` (API-6).
3. `src/server.js`: Reads `PORT = Number(process.env.PORT) || 3000`, instantiates `createApp()`, and calls `listen(PORT)` (R1, SEC-6).

### Step 5. Tests and Verification

Implement automated tests with `node:test` and `node:assert/strict` (TEST-1, TEST-2):
- `test/health.test.js`: Start app on port 0, query `GET /health`, assert status 200 and `{ status: "ok" }`.
- `test/middleware.test.js`:
  - Request logging assertion with a mock logger function.
  - Query unregistered route, assert status 404 and `{ error: "Route GET /unknown does not exist" }`.
  - Send invalid JSON payload with `Content-Type: application/json`, assert status 400 and `{ error: "<message>" }`.
  - Trigger unhandled error, assert status 500 and `{ error: "Internal server error" }` without stack trace.
- Run `npm test` and `npm run lint`.

## Interfaces and data

### HTTP Endpoints

- `GET /health`
  - Request: empty body
  - Response 200: `{ "status": "ok" }`
- Unmatched route (e.g., `GET /unknown`)
  - Response 404: `{ "error": "Route GET /unknown does not exist" }`
- Malformed JSON body
  - Response 400: `{ "error": "<parser error message>" }`
- Server error
  - Response 500: `{ "error": "Internal server error" }`

### Signatures

- `createApp(options = {}) -> Express.Application`
- `createRequestLogger(log = console.log) -> Middleware`
- `notFoundHandler(req, res) -> void`
- `errorHandler(err, req, res, next) -> void`

### Configuration and Dependencies

- Environment variables: `PORT` (default `3000`)
- Runtime dependencies: `express@^5.0.0`
- Dev dependencies: `eslint@^9.0.0`, `@eslint/js@^9.0.0`, `globals@^15.0.0`

## Tests

| ID | File | Checks | Requirement | New / existing |
| --- | --- | --- | --- | --- |
| T1 | `test/health.test.js` | Server starts and listens on dynamically assigned port | R1 | new |
| T2 | `test/health.test.js` | `GET /health` returns HTTP 200 with `{ status: "ok" }` | R2 | new |
| T3 | `test/middleware.test.js` | Logger records method, URL, status code, and duration | R3 | new |
| T4 | `test/middleware.test.js` | Unregistered route returns HTTP 404 with standard error format | R4 | new |
| T5 | `test/middleware.test.js` | Malformed JSON body returns HTTP 400 with standard error format | R5 | new |
| T6 | `test/middleware.test.js` | Unhandled route error returns HTTP 500 with no stack trace | R5 | new |

Commands:
- `npm test`: runs `node --test` (all tests pass)
- `npm run lint`: runs `eslint .` (zero warnings or errors)

## Placeholders and tech debt

| Placeholder | Why | Removed by |
| --- | --- | --- |
| None | Foundation increment is self-contained | N/A |

## Size

- Production code: about 110 lines in 7 files; new runtime dependencies: 1 (`express`)
- Increment budget: fits (within ~300 lines limit, 1 runtime dependency, essential tests)

## Risks

- Express 5 body-parser error status: Ensure `err.status ?? err.statusCode ?? 500` is used to reliably catch 400 status codes from syntax parsing errors.
- Test stdout noise: Custom logger option in `createApp({ logger })` suppresses stdout output during automated tests.

## Changes since the previous version

None (initial plan).
