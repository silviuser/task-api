---
task: dummy-data
artifact: critique
round: 1
plan_version: 1
verdict: approved
---

# Plan critique: dummy-data, round 1

## Checklist

| Check | Result | Notes |
| --- | --- | --- |
| Every requirement in `scope.md` is covered | pass | R1–R6 mapped to Steps 1–4 and tests T1–T6 |
| One logical increment; existing behavior keeps working | pass | Adds `src/seed.js`, storage reset helpers, and `test/seed.test.js` without changing existing HTTP routes or services |
| Within the increment budget (files, lines, dependencies) | pass | 3 production files (~95 lines), 0 new runtime dependencies (`@faker-js/faker` in `devDependencies`) |
| Testable: essential tests mapped to requirements, commands given | pass | T1–T6 cover CLI execution, default path isolation, atomic replacement, login with seeded users, custom programmatic options, and existing regression suite |
| Concise: under about 200 lines, snippets only for critical parts | pass | 150 lines, snippets focused on `writeUsers`/`resetUsers` and `seedData` |
| Follows `docs/standards/` (rule IDs) | pass | Complies with `DATA-1`, `DATA-2`, `DATA-3`, `DATA-5`, `DATA-7`, `SEC-1`, `SEC-10`, `API-9`, `JS-1`..`JS-10`, `TEST-1`..`TEST-7`, `GIT-4` |
| Consistent with `docs/ARCHITECTURE.md` | pass | Uses `user-store`, `task-store`, and `task-service` boundaries (`D2`, `D7`, `D10`, `D13`) |
| No over-engineering | pass | Direct function-based seed runner and storage reset helpers; no unnecessary abstractions |
| Placeholders recorded, with what removes them | pass | None needed (`userId` on tasks is explicitly out of scope until `task-authorization`) |
| Snippets correct and secure | pass | Bcrypt cost 10 (`SEC-1`), `passwordHash` omitted from returned objects (`API-9`), no secrets in CLI logs (`SEC-10`), atomic `.tmp` rename inside `serialize` (`DATA-3`, `DATA-5`) |
| Risks identified | pass | Covers ESM-in-CJS `require("@faker-js/faker")` on Node 22+ and test isolation for default seed paths |

## Required changes

None.

## Suggestions

- In `src/seed.js` Step 3, include `const taskStore = require("./storage/task-store");` in the module imports list alongside `userStore` and `taskService`, since `seedData` calls `taskStore.resetTasks({ tasksFile })`.

## Decision

approved: development can start.
