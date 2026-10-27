---
task: app-foundation
artifact: dev-log
plan_version: 1
round: 1
status: done
---

# Development log: app-foundation

One entry per increment, in commit order: a plan step, or a fix in a fix round. The code review reads the increments one by one, so each entry says what the reviewer needs to know about its commit.

## Increment 1: 1. Project and Tooling Setup

- Commit: `55c2b07` chore(setup): initialize project and eslint tooling
- Changes: `package.json`: define package metadata, scripts (start, dev, test, lint), and dependencies; `package-lock.json`: lock exact versions for Express and ESLint tooling; `eslint.config.js`: ESLint flat configuration enforcing eqeqeq, prefer-const, no-var, CommonJS, Node globals, and unused vars pattern
- Decisions: Used `--env-file-if-exists=.env` in the dev script to prevent failure when `.env` is not yet present on a fresh clone; added `argsIgnorePattern: "^_"` to `no-unused-vars` to support standard Express error handler signatures
- Tests: None for this step (infrastructure setup; verified `npm test` and `npm run lint` execute cleanly)
- Review focus: Tooling configuration in `eslint.config.js` and script definitions in `package.json`
- Deviation from the plan: None

## Increment 2: 2. Request Logging Middleware

- Commit: `56f4ca1` feat(logger): implement request logging middleware
- Changes: `src/middleware/request-logger.js`: create request logger middleware measuring request duration and logging method, URL, status code, and duration
- Decisions: Accepted an optional `log` function defaulting to `console.log` for testability and log output decoupling
- Tests: None in this step (middleware tests implemented in Step 5 as planned)
- Review focus: Safe logging format adhering to SEC-10 (no body/headers/tokens logged, only method, URL, status, and duration)
- Deviation from the plan: None

## Increment 3: 3. 404 and Error Handling Middleware

- Commit: `9dfe526` feat(middleware): implement not-found and error handling middleware
- Changes: `src/middleware/error-handler.js`: create `notFoundHandler` returning 404 with error message and centralized `errorHandler` extracting status, logging >= 500 errors, hiding stack traces, and formatting errors
- Decisions: Extracted status using `err.status ?? err.statusCode ?? 500` to support standard Express/body-parser errors; sanitized >= 500 error messages to "Internal server error"
- Tests: None in this step (middleware tests implemented in Step 5 as planned)
- Review focus: Safe error response format adhering to API-4 and API-6 (no stack traces or internal details leaked to clients)
- Deviation from the plan: None

## Increment 4: 4. Routes, App Factory, and Server Entry Point

- Commit: `afd91de` feat(app): configure app factory, health router, and server entry point
- Changes: `src/routes/health.js`: route handling `GET /` to return `{ status: "ok" }`; `src/app.js`: Express app factory `createApp(options)` wiring logger, json parser, health router, not-found and error handling; `src/server.js`: server entry point starting app on configurable `PORT` and logging startup
- Decisions: Mounted `createRequestLogger` ahead of `express.json()` as suggested in critique so malformed JSON requests are properly logged; added startup log message in `listen()` callback to meet R1 acceptance criterion
- Tests: None in this step (tests implemented in Step 5)
- Review focus: Order of middleware assembly in `src/app.js` and separation of app factory from server entry point (API-7)
- Deviation from the plan: None

## Increment 5: 5. Tests and Verification

- Commit: `d8415d9` test(foundation): add health and middleware automated tests
- Changes: `test/health.test.js`: automated tests for port binding and GET /health endpoint; `test/middleware.test.js`: automated tests for request logger, 404 handler, JSON body parsing error, and unhandled 500 errors
- Decisions: Used ephemeral test server on port 0 with `fetch()` and `node:test` per TEST-1/TEST-2; stubbed `console.error` during 500 test to suppress stdout noise while asserting error logging
- Tests: T1 (server port binding), T2 (GET /health 200 { status: "ok" }), T3 (request logging format and finish timing), T4 (404 unknown route message), T5 (400 malformed JSON syntax error), T6 (500 unhandled error sanitization and stack hiding)
- Review focus: Coverage of requirements R1-R6, assertion on response formats, and absence of leaked stack traces
- Deviation from the plan: None

## Commands

| Command | Result |
| --- | --- |
| test: `npm test` | 6 passed, 0 failed |
| lint: `npm run lint` | no problems |

## Notes for testing

- Automated tests: run `npm test` to execute all 6 test cases using `node:test`.
- Linting: run `npm run lint` to execute ESLint over the repository.
- Starting the server: run `npm start` (or `PORT=3000 npm start`). The server listens on the specified port and logs `Server listening on port <PORT>`.
- Testing endpoints manually:
  - `curl -i http://localhost:3000/health` returns HTTP 200 `{"status":"ok"}`.
  - `curl -i http://localhost:3000/unknown` returns HTTP 404 `{"error":"Route GET /unknown does not exist"}`.
  - `curl -i -X POST -H "Content-Type: application/json" -d "invalid-json" http://localhost:3000/health` returns HTTP 400 `{"error":"..."}`.
- Limitations: Foundation setup only; authentication and task endpoints are deferred to subsequent roadmap increments.
