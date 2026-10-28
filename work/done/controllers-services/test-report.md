---
task: controllers-services
artifact: test-report
round: 1
tested_commit: b854665
verdict: pass
---

# Test report: controllers-services, round 1

## Environment

- Node.js v24.19.0 (npm 11.17.0), Linux 6.18 WSL2 x86_64, local JSON file storage (temporary `DATA_FILE`), no external services

## Automated tests

- Clean install (`npm ci`, 0 vulnerabilities) and `npm test`: 29 passed, 0 failed, 0 skipped; `npm run lint`: no problems
- No code change after the reviewed commit: `git diff f1f9502 HEAD -- . ':!work'` is empty
- Existing tests unchanged: `git diff main...HEAD -- test` has only insertions, all in `test/auth.test.js` (`TEST-7`)

| Plan test | Exists | Result |
| --- | --- | --- |
| T1 | yes (`test/health.test.js`, 2 tests) | pass |
| T2 | yes (`test/middleware.test.js`, 4 tests) | pass |
| T3 | yes (`test/auth.test.js`, 15 existing tests, unmodified) | pass |
| T4 | yes (4 `auth-service` tests) | pass |
| T5 | yes (3 `auth-controller` tests, 1 `health-controller` test) | pass |

## Acceptance criteria

| Requirement | Verified by | Result |
| --- | --- | --- |
| R1 | T1, T3, T5; inspection of `src/routes/health.js` and `src/routes/auth.js` (only bind paths to handlers); E1, E3 | pass |
| R2 | T1, T5, E1 | pass |
| R3 | T3, T5, E3, E5a–E5e, E6b, E7, E10a–b | pass |
| R4 | T4; inspection of `src/services/auth-service.js` (no Express, `req` or `res`); E7, E12, E13 | pass |
| R5 | T3, T4, T5, E4, E8, E9 | pass |
| R6 | 29/29 tests, lint clean, existing tests unmodified, E1–E13 | pass |

## Exploratory checks

Server: `PORT=3917 DATA_FILE=<tmp>/users.json JWT_SECRET=<tmp> npm start`; requests with curl, including the README manual checks.

| ID | Action | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| E1 | `GET /health` | 200 `{"status":"ok"}` | 200 `{"status":"ok"}` | pass |
| E2 | `GET /unknown` | 404 standard error | 404 `{"error":"Route GET /unknown does not exist"}` | pass |
| E3 | `POST /auth/register` with `"  explore@example.com "` | 201, `Location: /users/<id>`, user without secrets, e-mail trimmed | as expected | pass |
| E4 | register `EXPLORE@example.com` again | 409 `Email already registered` | as expected | pass |
| E5a–e | register with bad e-mail, 5-char password, `{}`, numeric password, 74-byte password | 400 with the specific message | 400 each, messages as before the refactoring | pass |
| E6 | register with malformed JSON | 400 standard error | 400 `{"error":"Unexpected end of JSON input"}` | pass |
| E6b | register with form-encoded body | 400 | 400 `email is required` | pass |
| E7 | `POST /auth/login` with mixed-case e-mail | 200 `{token}`; HS256, `sub`, `email`, 1h | header HS256, `sub`/`email` correct, `exp - iat = 3600`, verifies with the secret | pass |
| E8 | login with wrong password | 401 `Invalid email or password` | as expected | pass |
| E9 | login with unknown e-mail | 401, identical message | as expected | pass |
| E10a–b | login without password / without e-mail | 400 | 400 `password is required` / `email is required` | pass |
| E11 | `GET /auth/login` | 404 | 404 | pass |
| E12 | 3× login wrong password vs. unknown e-mail, timed | similar times (dummy hash compared) | 0.10–0.11 s for both | pass |
| E13 | inspect the temporary `users.json` | `$2b$10$` hash, no plain password | as expected | pass |

Server log lines (method, URL, status, duration) were written for every request.

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
