---
task: dummy-data
artifact: test-report
round: 1
tested_commit: 8413997
verdict: pass
---

# Test report: dummy-data, round 1

## Environment

- Node.js `v24.19.0`, npm `11.17.0`, Linux `6.18.54.1-microsoft-standard-WSL2` (`x86_64`), local JSON file storage (`user-store`, `task-store`)

## Automated tests

- Clean install and test command: 42 passed, 0 failed, 0 skipped (`npm run lint`: 0 problems)

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
| R1 | T1, check E1, check E3 | pass |
| R2 | T2, check E1 | pass |
| R3 | T3, check E2 | pass |
| R4 | T3, check E2 | pass |
| R5 | T4, check E5 | pass |
| R6 | T5, check E4 | pass |

## Exploratory checks

| ID | Action | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| E1 | Run `npm run seed` with no `DATA_FILE` or `TASKS_FILE` env overrides | Exits 0, creates only `data/seed-users.json` (5 users) and `data/seed-tasks.json` (15 tasks), leaves `data/users.json` and `data/tasks.json` absent, prints summary without passwords or hashes | Exited 0, printed `Seeded 5 users (.../data/seed-users.json) and 15 tasks (.../data/seed-tasks.json)`, created only `seed-users.json` and `seed-tasks.json` | pass |
| E2 | Run `npm run seed` a second time against already populated `data/seed-*.json` files | Replaces existing contents atomically with 5 users (`nikita_crist@gmail.com`, etc.) and 15 tasks across `"todo"`, `"in_progress"`, `"done"` with identical emails and task titles/descriptions | File counts stayed 5 and 15; email list and task titles/descriptions matched the first run identically | pass |
| E3 | Run `DATA_FILE=<tmp>/seed-users.json TASKS_FILE=<tmp>/seed-tasks.json npm run seed` | Writes 5 users and 15 tasks to the temporary paths and exits 0 | Exited 0 and wrote 5 users and 15 tasks to `/tmp/.../seed-users.json` and `/tmp/.../seed-tasks.json` | pass |
| E4 | Call `seedData({ userCount: 3, taskCount: 6, seed: 123, ... })` and `seedData({ userCount: 0, taskCount: 0, ... })` programmatically | Returns `{ users, tasks, dataFile, tasksFile }` with exact counts (3/6 and 0/0) and `passwordHash` omitted from returned user objects | Returned 3 users (with `passwordHash === undefined`) and 6 tasks for custom counts, and 0 users / 0 tasks for zero counts | pass |
| E5 | Start server with seeded files (`src/server.js`) and send `POST /auth/login` with seeded email (`nikita_crist@gmail.com`) and `"Password123!"` | HTTP 200 with a 3-part HS256 JWT in `{ token }` | Returned HTTP 200 with valid JWT (`hasJwt: true`) | pass |
| E6 | Send `POST /auth/login` with seeded email and wrong password (`"WrongPassword!"`) | HTTP 401 `{"error":"Invalid email or password"}` | Returned HTTP 401 `{"error":"Invalid email or password"}` | pass |
| E7 | Send `GET /tasks` and `GET /tasks/:id` against server running with seeded `TASKS_FILE` | `GET /tasks` returns HTTP 200 with all 15 seeded tasks; `GET /tasks/:id` returns HTTP 200 with matching task | `GET /tasks` returned HTTP 200 with 15 tasks; `GET /tasks/:id` returned HTTP 200 with matching task ID | pass |
| E8 | Run `README.md` manual checks (`GET /health`, `GET /unknown`, `POST /auth/register`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE /tasks/:id`) | `200 {"status":"ok"}`, `404`, `201` with `Location`, `201` task `todo`, `200` task `in_progress`, `204` empty body | Returned `200 {"status":"ok"}`, `404 {"error":"Route GET /unknown does not exist"}`, `201` (`Location: /users/...`), `201` (`todo`), `200` (`in_progress`), and `204` | pass |

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
