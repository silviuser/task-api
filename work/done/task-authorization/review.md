---
task: task-authorization
artifact: review
round: 1
plan_version: 1
reviewed_commit: 13c9e4f
verdict: approved
---

# Code review: task-authorization, round 1

## Reviewed

- `git diff main...13c9e4f`: 15 files, +876 / -61 lines (production `src/`: 7 files, +110 / -14 lines)
- build: none; test: 47 passed, 0 failed; lint: no problems

## Increments

| Increment | Commit | Plan step or finding | Notes |
| --- | --- | --- | --- |
| 1 | `8cd30e0` | 1. Create `src/middleware/authenticate.js` and wire `jwtSecret` in `src/app.js` and `src/routes/tasks.js` | conforms (justified test header updates to keep `npm test` green after mounting `authenticate` per `GIT-3`) |
| 2 | `8847d9c` | 2. Update `src/storage/task-store.js` and `src/services/task-service.js` for `userId` and ownership | conforms |
| 3 | `b495765` | 3. Add allow-list body validation, UUIDv4 `:id` validation, and 403 mapping in `src/controllers/task-controller.js` | conforms (justified assertion updates on existing tests to keep `npm test` green per `GIT-3`) |
| 4 | `c377940` | 4. Assign deterministic `userId` in `src/seed.js` | conforms |
| 5 | `10f106c` | 5. Update `test/tasks.test.js`, `test/seed.test.js`, and `postman/task-api.postman_collection.json` | conforms |

## Findings

| ID | Severity | Location | Finding | Rule | Required change |
| --- | --- | --- | --- | --- | --- |
| None | - | - | No blockers, majors, minors, or nits found | - | - |

## Previous findings

None (round 1).

## Tech debt

- Every placeholder has a `TODO(<id>)` and a row in `tech-debt.md`: yes (no placeholders)
- Accepted as debt in this review: none

## Decision

approved: continue with task-testing.
