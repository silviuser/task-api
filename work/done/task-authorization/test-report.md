---
task: task-authorization
artifact: test-report
round: 1
tested_commit: fe93a29
verdict: pass
---

# Test report: task-authorization, round 1

## Environment

- Node.js v24.19.0, Linux 6.18.54.1-microsoft-standard-WSL2 x86_64, local JSON file storage (`DATA_FILE` / `TASKS_FILE` in temporary directories)

## Automated tests

- Clean install and test command: 47 passed, 0 failed, 0 skipped (`npm ci && npm test && npm run lint`)

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
| T9 | yes | pass |

## Acceptance criteria

| Requirement | Verified by | Result |
| --- | --- | --- |
| R1 | T1, T2, check E3 | pass |
| R2 | T2, check E6 | pass |
| R3 | T3, T8, checks E4, E6 | pass |
| R4 | T4, T7, check E7 | pass |
| R5 | T5, check E8 | pass |
| R6 | T6, T7, check E8 | pass |
| R7 | T8, check E1, E4 | pass |
| R8 | T8, T9, checks E2, E5, E6, E9, E10 | pass |

## Exploratory checks

| ID | Action | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| E1 | Run `npm run seed` with temporary `DATA_FILE` and `TASKS_FILE` | Exits 0, writes 5 users and 15 tasks with deterministic `userId` ownership, prints summary without secrets | Exited 0; printed `Seeded 5 users (...) and 15 tasks (...)`; each user owns 3 tasks | pass |
| E2 | `curl -i http://localhost:3456/health` and `curl -i http://localhost:3456/unknown` | `200 {"status":"ok"}` and `404 {"error":"Route GET /unknown does not exist"}` | `200 {"status":"ok"}` and `404 {"error":"Route GET /unknown does not exist"}` | pass |
| E3 | `GET /tasks` without header, with `Basic` header, malformed token, wrong secret, `alg: "none"`, and expired token | `401 {"error":"Authentication required"}` for missing/non-Bearer header; `401 {"error":"Invalid or expired token"}` for bad/expired tokens | Returned HTTP 401 with exact expected `{ "error": ... }` payloads in all 6 cases | pass |
| E4 | `POST /auth/login` as seeded user 0 (`Password123!`), then `GET /tasks` with `Authorization: Bearer <token>` | `200` with JWT on login; `200` on `GET /tasks` returning only the 3 tasks where `userId === users[0].id` | Returned 3 tasks all matching `users[0].id` | pass |
| E5 | `POST /auth/register` and `POST /auth/login` for `usera@example.com` and `userb@example.com` | `201` on register and `200 { token }` on login for both users | Returned `201` and `200` with valid HS256 Bearer tokens | pass |
| E6 | `POST /tasks` as User A and User B, then `GET /tasks` as User A | `201` with `userId` set to each caller's `sub`; `GET /tasks` as User A returns only User A's task | `POST /tasks` returned `201` with matching `userId`; User A's `GET /tasks` returned only User A's 1 task | pass |
| E7 | Call `GET`, `PATCH`, and `DELETE /tasks/<userATaskId>` with User B's token; call `GET /tasks/00000000-0000-4000-8000-000000000000` | `403 {"error":"Forbidden"}` on User B's requests without modifying User A's task; `404 {"error":"Task not found"}` on missing UUIDv4 | Returned `403 {"error":"Forbidden"}` for `GET`/`PATCH`/`DELETE` and `404 {"error":"Task not found"}` for non-existent UUIDv4 | pass |
| E8 | Send `POST /tasks` with `userId`, `PATCH /tasks/:id` with `extraField`, and `GET`/`PATCH`/`DELETE` with `"not-a-uuid"`, nil UUID, and `"123"` | `400 {"error":"unknown field: <key>"}` for extra/protected fields; `400 {"error":"Invalid task id"}` for non-UUIDv4 `:id` | Returned `400 {"error":"unknown field: userId"}`, `400 {"error":"unknown field: extraField"}`, and `400 {"error":"Invalid task id"}` | pass |
| E9 | Call `GET`, `PATCH` (`{"status":"in_progress"}`), and `DELETE /tasks/<userATaskId>` as User A, then `GET` again | `200` task JSON, `200` updated task JSON (`status: "in_progress"`), `204` empty body, then `404 {"error":"Task not found"}` | Returned `200`, `200` with updated status and `updatedAt`, `204`, and `404` after deletion | pass |
| E10 | Validate `postman/task-api.postman_collection.json` structure and auth/error requests | Valid JSON containing `token` variable, Bearer headers on `/tasks` requests, and 401/403/404 requests | Parsed cleanly (`Health: 1, Auth: 7, Tasks: 12`) with `Bearer {{token}}` and UUIDv4 404 URLs | pass |

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
