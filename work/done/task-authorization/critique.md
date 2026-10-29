---
task: task-authorization
artifact: critique
round: 1
plan_version: 1
verdict: approved
---

# Plan critique: task-authorization, round 1

## Checklist

| Check | Result | Notes |
| --- | --- | --- |
| Every requirement in `scope.md` is covered | pass | R1..R8 all mapped to concrete implementation steps and tests T1..T9. |
| One logical increment; existing behavior keeps working | pass | Adds `/tasks` Bearer JWT authentication, ownership enforcement, and strict validation; updates existing task and seed tests where requirements changed (`TEST-7`) while keeping `/health` and `/auth` suites untouched. |
| Within the increment budget (files, lines, dependencies) | pass | 7 production files, ~140 changed production lines (budget <= 300 lines, <= 10 files), 0 new runtime dependencies. |
| Testable: essential tests mapped to requirements, commands given | pass | T1..T9 cover 401 auth errors, 201 `userId` persistence, user-scoped `GET /tasks`, 403 vs 404 ownership, 400 unknown fields, 400 non-UUIDv4 `:id`, domain errors without `err.status`, and deterministic seed `userId` distribution. |
| Concise: under about 200 lines, snippets only for critical parts | pass | `plan.md` is 167 lines with focused snippets for JWT verification, ownership check, and allow-list validation. |
| Follows `docs/standards/` (rule IDs) | pass | Complies with `API-3`..`API-5`, `DATA-1`, `DATA-2`, `DATA-5`..`DATA-7`, `JS-1`..`JS-10`, `SEC-3`..`SEC-6`, `SEC-9`, and `TEST-1`..`TEST-8`. |
| Consistent with `docs/ARCHITECTURE.md` | pass | Preserves `routes -> controllers -> services -> storage` separation (`D10`, `D11`) and transport-agnostic domain `err.code` (`TASK_FORBIDDEN`, `TASK_NOT_FOUND`) (`D15`). |
| No over-engineering | pass | Uses existing `jsonwebtoken` and plain allow-list/UUIDv4 checks without unnecessary external schema libraries or role layers. |
| Placeholders recorded, with what removes them | pass | No placeholders or shortcuts needed. |
| Snippets correct and secure | pass | Pins `{ algorithms: ["HS256"] }`, validates `payload.sub`, enforces allow-list keys, and checks UUIDv4 format before storage lookups. |
| Risks identified | pass | Identifies existing test updates (`TEST-7`) and `README.md` phase boundary (`AGENTS.md`). |

## Required changes

None.

## Suggestions

- In `postman/task-api.postman_collection.json`, update the default `taskId` variable and the `Not Found (404)` request URLs from `00000000-0000-0000-0000-000000000000` (nil UUID) to a valid UUIDv4 such as `00000000-0000-4000-8000-000000000000` so those requests pass the new `UUID_V4_REGEX` check and reach the 404 path instead of returning 400.
- In `src/services/task-service.js`, ensure `updateTask` and `deleteTask` perform the ownership check inside the serialized `taskStore` operation (or pass `userId` into `taskStore` / keep the read-check-write atomic) if concurrent ownership/delete edge cases arise (`DATA-5`), and update the direct `controller.list` unit test in `test/tasks.test.js` to pass `{ user: { sub: "..." } }` on `req`.

## Decision

approved: development can start.
