---
task: user-login
artifact: test-report
round: 1
tested_commit: 4d0db4e
verdict: pass
---

# Test report: user-login, round 1

## Environment

- Node.js v24.19.0 (npm 11.17.0), Linux 6.18.54.1-microsoft-standard-WSL2 x86_64 GNU/Linux, local JSON file storage (temporary test directory)

## Automated tests

- Clean install and test command (`npm ci && npm test && npm run lint`): 21 passed, 0 failed, 0 skipped; lint: 0 problems

| Plan test | Exists | Result |
| --- | --- | --- |
| T1 | yes | pass |
| T2 | yes | pass |
| T3 | yes | pass |
| T4 | yes | pass |
| T5 | yes | pass |
| T6 | yes | pass |
| T7 | yes | pass |
| E1 | yes | pass |
| E2 | yes | pass |
| E3 | yes | pass |

## Acceptance criteria

| Requirement | Verified by | Result |
| --- | --- | --- |
| R1 | T1, check EX2, check EX3 | pass |
| R2 | T2, T3, check EX6 | pass |
| R3 | T4, T5, check EX4, check EX5 | pass |
| R4 | T6, check EX7 | pass |
| R5 | T7, check EX1 | pass |
| R6 | check EX2, check EX4, check EX6 | pass |

## Exploratory checks

| ID | Action | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| EX1 | Run `env -u JWT_SECRET npm start` | Server refuses to start and throws `Error: JWT_SECRET is required` | Exited non-zero with `Error: JWT_SECRET is required` | pass |
| EX2 | Start server with `JWT_SECRET=dev-secret-key`, register `user@example.com`, and run `README.md` / Postman `POST /auth/login` valid request | `201 Created` on register; `200 OK` on login with `{ "token": "<jwt>" }` where JWT header is `{"alg":"HS256","typ":"JWT"}` and payload has `sub`, `email: "user@example.com"`, and `exp - iat === 3600` | Returned `200 OK` with valid HS256 JWT (`ttl: 3600`, matching `sub` and `email`) | pass |
| EX3 | `POST /auth/login` with `"  USER@EXAMPLE.COM  "` and matching password | `200 OK` with `{ "token": "<jwt>" }` | `200 OK` with `{ "token": "<jwt>" }` | pass |
| EX4 | Run `README.md` / Postman `POST /auth/login` with wrong password (`WrongPassword!`) | `401 Unauthorized` with `{"error":"Invalid email or password"}` | `401` with `{"error":"Invalid email or password"}` | pass |
| EX5 | `POST /auth/login` with unregistered email (`unknown@example.com`) | `401 Unauthorized` with identical `{"error":"Invalid email or password"}` | `401` with `{"error":"Invalid email or password"}` | pass |
| EX6 | `POST /auth/login` with invalid email (`not-an-email`), empty password (`""`), and 74-byte UTF-8 password (`"é".repeat(37)`) | `400 Bad Request` with `{"error":"invalid email format"}`, `{"error":"password is required"}`, and `{"error":"password must not exceed 72 bytes"}` | Returned `400` with exact expected error payloads | pass |
| EX7 | Call `findUserByEmail("USER@example.com", { dataFile })` and `findUserByEmail("none@example.com", { dataFile })` via Node one-liner | Returns user record with `email: "user@example.com"` and `$2b$10$` `passwordHash` for registered email, and `null` for unknown email | Returned matching user object (`hasHash: true`) and `null` | pass |
| EX8 | Run `README.md` manual checks `GET /health` and `GET /unknown` | `200` `{"status":"ok"}` and `404` `{"error":"Route GET /unknown does not exist"}` | `200` `{"status":"ok"}` and `404` `{"error":"Route GET /unknown does not exist"}` | pass |

## Failures

| ID | Description | Steps to reproduce | Severity |
| --- | --- | --- | --- |
| None | - | - | - |

## Known issues to record

| Description | Severity |
| --- | --- |
| None | - |

## Decision

pass: continue with task-gitops.
