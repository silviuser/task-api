---
task: app-foundation
artifact: test-report
round: 1
tested_commit: 1ea9895
verdict: pass
---

# Test report: app-foundation, round 1

## Environment

- Node.js v24.19.0, Linux 6.18.54.1-microsoft-standard-WSL2 (x86_64), in-memory (no external services or database)

## Automated tests

- Clean install and test command: `npm ci` succeeded; `npm test`: 6 passed, 0 failed, 0 skipped; `npm run lint`: 0 errors

| Plan test | Exists | Result |
| --- | --- | --- |
| T1 | yes | pass |
| T2 | yes | pass |
| T3 | yes | pass |
| T4 | yes | pass |
| T5 | yes | pass |
| T6 | yes | pass |

## Acceptance criteria

| Requirement | Verified by | Result |
| --- | --- | --- |
| R1 | T1, check E1, check E2 | pass |
| R2 | T2, check E1, check E2 | pass |
| R3 | T3, check E1, check E2, check E3, check E4, check E5, check E6 | pass |
| R4 | T4, check E3, check E4, check E6 | pass |
| R5 | T5, T6, check E5 | pass |
| R6 | `npm test` (6 passed), `npm run lint` (0 errors) | pass |

## Exploratory checks

| ID | Action | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| E1 | Start server with `PORT=3456 node src/server.js`, query `GET /health` | HTTP 200, `{"status":"ok"}`, logs startup port 3456 and request line | HTTP 200 OK, `{"status":"ok"}`, logs startup port 3456 and `GET /health 200 11ms` | pass |
| E2 | Start server with `npm start` (default port 3000), query `GET /health` | HTTP 200, `{"status":"ok"}`, logs startup port 3000 and request line | HTTP 200 OK, `{"status":"ok"}`, logs startup port 3000 and `GET /health 200 11ms` | pass |
| E3 | Send `GET /unknown` to running server | HTTP 404, `{"error":"Route GET /unknown does not exist"}`, logs 404 | HTTP 404 Not Found, `{"error":"Route GET /unknown does not exist"}`, logs `GET /unknown 404 2ms` | pass |
| E4 | Send `POST /api/missing` to running server | HTTP 404, `{"error":"Route POST /api/missing does not exist"}`, logs 404 | HTTP 404 Not Found, `{"error":"Route POST /api/missing does not exist"}`, logs `POST /api/missing 404 1ms` | pass |
| E5 | Send `POST /health` with `Content-Type: application/json` and body `"invalid-json"` | HTTP 400, JSON error message, no stack trace | HTTP 400 Bad Request, `{"error":"Unexpected token 'i', \"invalid-json\" is not valid JSON"}`, no stack trace, logs `POST /health 400 417ms` | pass |
| E6 | Send `POST /test-json` with valid JSON payload `{"hello":"world"}` | Parsed successfully, routes to 404 handler with error format | HTTP 404 Not Found, `{"error":"Route POST /test-json does not exist"}`, logs `POST /test-json 404 1ms` | pass |

## Failures

| ID | Description | Steps to reproduce | Severity |
| --- | --- | --- | --- |
| None | - | - | - |

## Known issues to record

| Description | Severity |
| --- | --- |
| None | - |

## Decision

Pass: continue with task-gitops.
