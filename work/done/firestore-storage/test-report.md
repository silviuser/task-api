---
task: firestore-storage
artifact: test-report
round: 1
tested_commit: 7a6e004
verdict: pass
---

# Test report: firestore-storage, round 1

## Environment

- Node.js v24.19.0, npm 11.17.0, Linux 6.18.54.1-microsoft-standard-WSL2, local Firestore v1 REST emulator (`FIRESTORE_EMULATOR_HOST`) and local JSON file fallback

## Automated tests

- Clean install and test command: 52 passed, 0 failed, 0 skipped (`npm ci && npm test`, plus `npm run lint` with 0 warnings/errors)

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
| R1 | T1, check E1 | pass |
| R2 | T1, T6, check E1 | pass |
| R3 | T2, T4, check E2 | pass |
| R4 | T2, T4, check E3 | pass |
| R5 | T3, T4, check E4 | pass |
| R6 | T4, checks E1, E2, E3, E4, E5 | pass |
| R7 | T5, check E6 | pass |
| R8 | T1, T2, T3, T4, T5, T6 | pass |

## Exploratory checks

| ID | Action | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| E1 | Start `src/server.js` with `FIRESTORE_EMULATOR_HOST` and `JWT_SECRET`, then send `GET /health` and `GET /unknown` | `200 {"status":"ok"}` for `/health` and `404 {"error":"Route GET /unknown does not exist"}` for `/unknown` | `200 {"status":"ok"}` and `404 {"error":"Route GET /unknown does not exist"}` | pass |
| E2 | Send `POST /auth/register` with `user@example.com` and then duplicate `USER@example.com` against Firestore emulator | First returns `201` with normalized email, UUIDv4 `id`, and no `passwordHash`; second returns `409 {"error":"Email already registered"}` | `201` (`email: "user@example.com"`, `passwordHash: undefined`) and `409 {"error":"Email already registered"}` | pass |
| E3 | Send `POST /auth/login` with valid password and with `"WrongPassword!"` against Firestore emulator | Valid returns `200` with JWT `token`; wrong password returns `401 {"error":"Invalid email or password"}` | `200` with valid JWT and `401 {"error":"Invalid email or password"}` | pass |
| E4 | Run manual `/tasks` CRUD lifecycle (`POST /tasks`, `GET /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id` to `in_progress`, `DELETE /tasks/:id`, `GET /tasks/:id`) with Bearer JWT | `201` created with `userId`, `200` list of 1, `200` fetched by id, `200` patched preserving `title`, `204` deleted, `404` after delete | `201`, `200` (1 task), `200`, `200` (`status: "in_progress"`, `title: "Write API documentation"`), `204`, `404` | pass |
| E5 | Send `GET /tasks` without `Authorization` header and `PATCH /tasks/:id` with protected field `{"userId":"hijack"}` | `401` for missing token and `400` for protected field | `401` and `400` | pass |
| E6 | Run `node src/seed.js` CLI with `FIRESTORE_EMULATOR_HOST` set, then query `GET /tasks` for the existing application user | CLI exits `0` and prints `Seeded 5 users (seed_users) and 15 tasks (seed_tasks)` without touching application `users`/`tasks` collections | Exit `0`, output `Seeded 5 users (seed_users) and 15 tasks (seed_tasks)`, app `GET /tasks` still returns `200 []` | pass |

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
