---
task: user-registration
artifact: test-report
round: 1
tested_commit: 9001092
verdict: pass
---

# Test report: user-registration, round 1

## Environment

- Node.js v24.19.0, npm 11.17.0, Linux (WSL2 x86_64), local JSON file persistence (`data/users.json`)

## Automated tests

- Clean install and test command: 14 passed, 0 failed, 0 skipped
- Linter (`npm run lint`): 0 errors, 0 warnings

| Plan test | Exists | Result |
| --- | --- | --- |
| T1 | yes | pass |
| T2 | yes | pass |
| T3 | yes | pass |
| T4 | yes | pass |
| T5 | yes | pass |
| T6 | yes | pass |
| T7 | yes | pass |
| T8 | yes | pass |
| E1 | yes | pass |
| E2 | yes | pass |

## Acceptance criteria

| Requirement | Verified by | Result |
| --- | --- | --- |
| R1 | T1, check E3 | pass |
| R2 | T2, check E5, E8 | pass |
| R3 | T3, T4, check E6, E7 | pass |
| R4 | T5, T6, T8, check E4 | pass |
| R5 | T1, T7, check E3, E10 | pass |
| R6 | T7, T8, check E3, E10 | pass |
| R7 | checks E1–E10, Postman collection inspection | pass |

## Exploratory checks

| ID | Action | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| E1 | `curl -i http://localhost:PORT/health` | HTTP 200 `{"status":"ok"}` | HTTP 200 `{"status":"ok"}` | pass |
| E2 | `curl -i http://localhost:PORT/unknown` | HTTP 404 with standard error body | HTTP 404 `{"error":"Route GET /unknown does not exist"}` | pass |
| E3 | `POST /auth/register` with valid email and password | HTTP 201, `Location: /users/<id>`, body `{ id, email, createdAt }` without secrets | HTTP 201 Created, `Location: /users/ab119575-...`, JSON body with id, normalized email, createdAt | pass |
| E4 | `POST /auth/register` with duplicate email in mixed casing | HTTP 409 `{"error":"Email already registered"}` | HTTP 409 Conflict `{"error":"Email already registered"}` | pass |
| E5 | `POST /auth/register` with invalid email format (`notanemail`) | HTTP 400 `{"error":"invalid email format"}` | HTTP 400 Bad Request `{"error":"invalid email format"}` | pass |
| E6 | `POST /auth/register` with short password (5 chars) | HTTP 400 `{"error":"password must be at least 8 characters long"}` | HTTP 400 Bad Request `{"error":"password must be at least 8 characters long"}` | pass |
| E7 | `POST /auth/register` with password exceeding 72 bytes | HTTP 400 `{"error":"password must not exceed 72 bytes"}` | HTTP 400 Bad Request `{"error":"password must not exceed 72 bytes"}` | pass |
| E8 | `POST /auth/register` with missing password | HTTP 400 `{"error":"password is required"}` | HTTP 400 Bad Request `{"error":"password is required"}` | pass |
| E9 | `POST /auth/register` with malformed JSON body | HTTP 400 with standard error body | HTTP 400 Bad Request `{"error":"Expected property name..."}` | pass |
| E10 | Inspect stored user record in temporary `DATA_FILE` | JSON array containing `{ id, email, passwordHash, createdAt }`, cost 10 hash (`$2b$10$...`), no plaintext password | JSON array with 1 record, valid UUID id, lowercase email, bcrypt salt rounds 10 hash, ISO timestamp, no plaintext password | pass |

## Failures

| ID | Description | Steps to reproduce | Severity |
| --- | --- | --- | --- |
| None | | | |

## Known issues to record

| Description | Severity |
| --- | --- |
| None | |

## Decision

pass: continue with task-gitops.
