---
task: task-crud
artifact: critique
round: 1
plan_version: 1
verdict: approved
---

# Plan critique: task-crud, round 1

## Checklist

| Check | Result | Notes |
| --- | --- | --- |
| Every requirement in `scope.md` is covered | pass | R1–R9 are covered across Steps 1–6 and Tests T1–T10; `README.md` manual verification examples (R9) are appropriately deferred to `task-doc-updates` per `AGENTS.md` |
| One logical increment; existing behavior keeps working | pass | Unauthenticated `/tasks` CRUD + resolving `TD-controllers-services-F1`; existing `/health` and `/auth` routes and tests remain intact (`TEST-7`) |
| Within the increment budget (files, lines, dependencies) | pass | 6 production files modified/created (~210–230 lines), 0 new runtime dependencies (`AGENTS.md`: <= 10 files, <= 300 lines, <= 1 runtime dep) |
| Testable: essential tests mapped to requirements, commands given | pass | T1–T10 cover every requirement with essential success and error/concurrency checks (`TEST-1`..`TEST-8`), with exact commands provided |
| Concise: under about 200 lines, snippets only for critical parts | pass | 149 lines total; concise snippets limited to serialized `updateTask` and partial-update validation |
| Follows `docs/standards/` (rule IDs) | pass | Adheres to `API-1`..`API-8`, `DATA-1`..`DATA-3`, `DATA-5`, `DATA-6`, `JS-1`..`JS-10`, `SEC-9`, `TEST-1`..`TEST-8` |
| Consistent with `docs/ARCHITECTURE.md` | pass | Follows `routes` -> `controllers` -> `services` -> `storage` (`D10`, `D11`) and promise-serialized atomic JSON storage (`D7`) |
| No over-engineering | pass | Plain/factory functions, native `node:fs/promises` + `node:crypto`, no extra abstractions or unnecessary layers |
| Placeholders recorded, with what removes them | pass | No placeholders needed; resolves existing tech debt `TD-controllers-services-F1` |
| Snippets correct and secure | pass | `updateTask` serializes read-modify-write and clones returned object; `validateUpdateTaskInput` enforces types, trim/length bounds (`SEC-9`), and allow-listed status values (`API-5`) |
| Risks identified | pass | Concurrent file write races and `README.md` phase ownership (`AGENTS.md`) are identified and mitigated |

## Required changes

None.

## Suggestions

- In `test/auth.test.js` (Step 1), besides removing `status: 409` / `status: 401` from the expected rejection object in `assert.rejects`, explicitly assert `err.status === undefined` (for example with a predicate function in `assert.rejects`) so `assert.rejects` does not merely ignore an extra `status` property on the thrown error.

## Decision

approved: development can start.
