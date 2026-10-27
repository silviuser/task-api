---
task: app-foundation
artifact: scope
version: 1
status: confirmed
branch: app-foundation
roadmap_item: app-foundation
---

# Scope: Application foundation

## Goal

Establish the baseline Express 5 application with configuration from environment variables, health check endpoint, request logging, standard 404 and error handling, and test/lint infrastructure.

## Requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| R1 | Express application factory and server startup with port configuration | Given `PORT` set (or default 3000), when the server starts, then it listens on that port and logs startup. |
| R2 | Health check endpoint at `GET /health` | Given a running server, when `GET /health` is requested, then it returns HTTP 200 with `{ "status": "ok" }`. |
| R3 | Request logging middleware | Given an incoming HTTP request, when processed, then its method, path, status code, and response time are logged to stdout. |
| R4 | Unknown route 404 handler | Given an unregistered route, when requested with any HTTP method, then it returns HTTP 404 with `{ "error": "Route <METHOD> <PATH> does not exist" }`. |
| R5 | Centralized error handler and JSON body parsing | Given an unhandled error or malformed JSON payload, when processed, then it returns the appropriate HTTP status code (400 or 500) with `{ "error": "<message>" }` and no stack trace in response. |
| R6 | Standard npm scripts and tooling setup | Given `npm test` and `npm run lint`, when executed, then `node:test` passes all tests and ESLint reports zero errors. |

## Out of scope

- User authentication, registration, or JWT handling (deferred to `user-registration` and `user-login`).
- Task data endpoints or storage layer (deferred to `task-crud` and `firestore-storage`).
- External runtime dependencies beyond Express (such as `morgan`, `dotenv`, `helmet`).

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Express 5 (`express@^5.0.0`) | Native async error forwarding, modern Express standard | Breaking changes from v4 | Chosen (Architecture D1) |
| Custom request logger middleware | Zero extra dependencies, stays within 1 runtime dependency budget | Fewer built-in formatting options | Chosen |
| `morgan` library for logging | Pre-configured formats (combined, dev) | Adds a second runtime dependency | Rejected (exceeds 1-dependency budget) |
| Native Node `--env-file` | Zero external dependencies, built into Node 22+ | Requires Node 20.6.0+ | Chosen |
| Flat config `eslint.config.js` | Modern ESLint standard (ESLint 9/10) | Newer syntax | Chosen |

Sources:

- https://expressjs.com/en/5x/api.html
- https://nodejs.org/docs/latest-v22.x/api/cli.html#--env-fileconfig
- https://eslint.org/docs/latest/use/configure/configuration-files

## Constraints and assumptions

- Node.js 22 or newer (environment runs Node 24.19.0).
- Express 5 with CommonJS modules (`require`, `module.exports`).
- Exactly one new runtime dependency (`express`).
- App factory pattern (`createApp()`) separated from server entry point (`listen()`), per `API-7`.

## Impact

- Code areas touched: `package.json`, `eslint.config.js`, `src/app.js`, `src/server.js`, `src/middleware/`, `test/`.
- Blast radius: Low (initial repository setup, no existing code).
- Increment budget: Fits (approx. 100-150 lines of production code, 1 runtime dependency `express`, 6-8 files).

## Split and placeholders

None needed; the foundation increment fits within the increment budget.

## Follow-ups

- `user-registration`: `POST /auth/register` with password hashing and local JSON storage.

## Open questions

- None
