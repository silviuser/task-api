# Architecture

## Overview

A stateless REST API: Node.js 22 or newer, Express 5, CommonJS modules. Clients exchange JSON over HTTP; authenticated requests carry a JSON Web Token in the `Authorization` header. Components are added incrementally according to `docs/ROADMAP.md`.

## Components

| Component | Location | Responsibility |
| --- | --- | --- |
| Server entry point | `src/server.js` | Starts HTTP server listening on configured `PORT` |
| Application factory | `src/app.js` | Enforces required `JWT_SECRET` configuration and assembles middleware, routes, and error handling into Express app |
| Request logger | `src/middleware/request-logger.js` | Logs HTTP method, URL, status code, and response time |
| Error handlers | `src/middleware/error-handler.js` | Centralized 404 route handling and error response sanitization |
| Health router | `src/routes/health.js` | Exposes `GET /health` endpoint |
| Auth router | `src/routes/auth.js` | User registration and login input validation, `POST /auth/register`, and `POST /auth/login` with timing-protected bcrypt verification and JWT signing |
| User storage | `src/storage/user-store.js` | Promise-serialized local JSON persistence with atomic file writes, duplicate email check, and case-insensitive email lookup |

## Data model

| Entity | Fields | Stored in |
| --- | --- | --- |
| User | `id` (UUIDv4), `email` (string, lowercase), `passwordHash` (string, bcrypt cost 10), `createdAt` (ISO 8601 string) | `data/users.json` (configurable via `DATA_FILE`) |

## Request flow

Incoming HTTP request -> `express.json()` -> `requestLogger` (records start time) -> matching route (e.g. `GET /health` -> `{ status: "ok" }`) -> if unmatched, `notFoundHandler` (404 JSON) -> if error thrown, `errorHandler` (JSON error response) -> `requestLogger` logs method, URL, status code, and duration on response `finish`.

## Decisions

| ID | Decision | Reason | Task |
| --- | --- | --- | --- |
| D1 | Node.js 22 or newer, Express 5, CommonJS modules | the stack of the PWCC course; Express 5 sends rejected promises from async routes to the error handler | before the first task |
| D2 | All persistence behind one storage module: a local JSON file first, Cloud Firestore later | the switch to Firestore must not change routes or business logic (`DATA-1`) | before the first task |
| D3 | Stateless authentication with JSON Web Tokens in the `Authorization` header | REST statelessness (`SEC-3`, `SEC-4`) | before the first task |
| D4 | Tests with `node:test` and `fetch` against the app started on a free port | no extra test framework (`TEST-1`, `TEST-2`) | before the first task |
| D5 | Custom request logger middleware instead of external package | Zero extra runtime dependencies, staying within single runtime dependency budget | `app-foundation` |
| D6 | `bcryptjs` for password hashing | Pure JavaScript, zero native toolchain dependencies (`SEC-1`), within dependency budget | `user-registration` |
| D7 | Promise-serialized atomic writes with `.tmp` file rename for JSON storage | Prevents file corruption and race conditions without third-party database dependencies (`DATA-3`, `DATA-5`) | `user-registration` |
| D8 | `jsonwebtoken` (`HS256`, `1h` expiry) for token signing and verification | Synchronous signing, algorithm pinning, and standard JWT claims (`sub`, `email`) within the single runtime dependency budget (`SEC-3`) | `user-login` |
| D9 | Constant-time bcrypt comparison against a precomputed cost-10 dummy hash when login email is not found | Prevents user enumeration via response timing differences and returns a uniform 401 message (`SEC-2`) | `user-login` |
