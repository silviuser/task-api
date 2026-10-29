---
task: task-crud
artifact: test-report
round: 1
tested_commit: 51bad9d
verdict: pass
---

# Test report: task-crud, round 1

## Environment

- Node.js v24.19.0, npm 11.17.0, Linux 6.18.54.1-microsoft-standard-WSL2, local JSON file storage (`TASKS_FILE` / `DATA_FILE` in temporary directory)

## Automated tests

- Clean install and test command: 37 passed, 0 failed, 0 skipped (`npm ci`, `npm test`, `npm run lint` with 0 errors)

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
| T10 | yes | pass |

## Acceptance criteria

| Requirement | Verified by | Result |
| --- | --- | --- |
| R1 | T1, check E2, check E3 | pass |
| R2 | T2, T5, check E4, check E7 | pass |
| R3 | T3, check E1, check E5 | pass |
| R4 | T4, check E6 | pass |
| R5 | T5, check E7 | pass |
| R6 | T6, check E8 | pass |
| R7 | T7, check E9 | pass |
| R8 | T8, T9, check E6, check E9 | pass |
| R9 | check E2, check E4, check E5, check E6, check E7, check E8, check E9 | pass |

## Exploratory checks

| ID | Action | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| E1 | `GET /tasks` against fresh `TASKS_FILE` | HTTP 200 `[]` | HTTP 200 `[]` | pass |
| E2 | `POST /tasks` with `{"title":"Write API documentation","description":"Document all /tasks endpoints","status":"todo"}` (Postman `Create Task - Success (201)`) | HTTP 201, `Location: /tasks/<id>`, JSON task with UUID `id`, `title`, `description`, `status`, `createdAt`, `updatedAt` | HTTP 201, `Location: /tasks/7dbb40f9-edf9-48a7-96b7-70b8719a13e7`, task JSON with matching fields and ISO timestamps | pass |
| E3 | `POST /tasks` with `{"title":"  Review PR  ","priority":"high"}` | HTTP 201, trimmed `title: "Review PR"`, default `description: ""` and `status: "todo"`, unknown `priority` omitted | HTTP 201, `{"id":"25828621-9e25-4259-a683-7f7b88c725e1","title":"Review PR","description":"","status":"todo",...}` | pass |
| E4 | `POST /tasks` with `{"title":"","status":"invalid"}` (Postman 400), 201-char `title`, and 1001-char `description` | HTTP 400 with `{ "error": "<message>" }` for each invalid payload | HTTP 400 `{"error":"title is required"}`, `{"error":"title must not exceed 200 characters"}`, `{"error":"description must not exceed 1000 characters"}` | pass |
| E5 | `GET /tasks` after creating two tasks (Postman `List Tasks - Success (200)`) | HTTP 200 JSON array containing both created tasks | HTTP 200 JSON array of 2 task objects | pass |
| E6 | `GET /tasks/<id>` and `GET /tasks/00000000-0000-0000-0000-000000000000` (Postman 200 & 404) | HTTP 200 matching task object; HTTP 404 `{"error":"Task not found"}` | HTTP 200 task JSON; HTTP 404 `{"error":"Task not found"}` | pass |
| E7 | `PATCH /tasks/<id>` with `{"status":"in_progress"}`, `{}` (invalid), and missing ID `00000000-0000-0000-0000-000000000000` (Postman 200, 400, 404) | HTTP 200 with `status: "in_progress"` and refreshed `updatedAt`; HTTP 400 `{"error":"at least one of title, description, or status is required"}`; HTTP 404 `{"error":"Task not found"}` | HTTP 200 (`updatedAt` advanced from `.055Z` to `.262Z`); HTTP 400; HTTP 404 `{"error":"Task not found"}` | pass |
| E8 | `DELETE /tasks/<id>` twice (Postman 204 & 404) | First call HTTP 204 with empty body; second call HTTP 404 `{"error":"Task not found"}` | HTTP 204 empty body; HTTP 404 `{"error":"Task not found"}` | pass |
| E9 | Execute `README.md` manual checks (`/health`, `/unknown`, `/auth/register` 201 & 409, `/auth/login` 200 & 401) and inspect on-disk `tasks.json` | All existing endpoints return expected statuses; `tasks.json` contains valid JSON with 1 remaining task and 0 leftover `.tmp` files | 200, 404, 201, 409, 200, 401 returned as expected; `tasks.json` valid with 1 task and 0 `.tmp` files | pass |

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
