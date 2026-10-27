---
task: app-foundation
artifact: pr
branch: app-foundation
base: main
updated_commit: none
pr: https://github.com/silviuser/task-api/pull/1
---

# feat(foundation): establish Express 5 application foundation and tooling

## Summary

Establishes the baseline Express 5 application with configuration from environment variables, health check endpoint (`GET /health`), request logging, standard 404 and error handling, and test/lint infrastructure.

## Changes

- Project configuration and tooling: initialized `package.json`, locked `package-lock.json` dependencies, and configured ESLint flat config (`eslint.config.js`).
- Request logging middleware: implemented middleware capturing HTTP method, URL, status code, and response time in milliseconds (`src/middleware/request-logger.js`).
- Not-found and error handling: implemented 404 handler returning JSON route errors and centralized error handler hiding stack traces and sanitizing internal errors (`src/middleware/error-handler.js`).
- Routing and server entry point: created health route (`src/routes/health.js`), application factory `createApp` (`src/app.js`), and server bootstrap listening on configurable `PORT` (`src/server.js`).
- Automated tests: created integration test suites with `node:test` covering health checks, port configuration, request logging, 404 routes, and 400/500 error scenarios (`test/health.test.js`, `test/middleware.test.js`).

## How to test

```bash
npm ci
npm test
npm run lint
```

Manual checks:

```bash
# Start server with default port
npm start

# In another terminal:
curl -i http://localhost:3000/health
curl -i http://localhost:3000/unknown
curl -i -X POST -H "Content-Type: application/json" -d "invalid-json" http://localhost:3000/health
```

## Quality gates

| Gate | Task file | Result |
| --- | --- | --- |
| Plan critique | `critique.md`, round 1 | approved |
| Code review | `review.md`, round 1 | approved |
| Tests | `test-report.md`, round 1 | pass |

## Tech debt

- None

## Follow-ups

- user-registration: implement `POST /auth/register` with password hashing and local JSON storage
