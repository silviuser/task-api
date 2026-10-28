---
task: controllers-services
artifact: docs-update
pr: https://github.com/silviuser/task-api/pull/4
---

# Documentation update: controllers-services

| Document | Change | Source |
| --- | --- | --- |
| `README.md` | None: no change in features, interfaces, configuration or commands | `scope.md` (out of scope) |
| `docs/ARCHITECTURE.md` | Health and auth routers now only bind handlers; added health controller, auth controller and auth service; request flow goes route -> controller -> service -> storage; decisions D10–D12 | `plan.md`, `scope.md` (options), `pr.md` |
| `docs/ROADMAP.md` | Item 4 `controllers-services` done with PR #4; follow-up `task-crud` already planned (item 5); fixed the separator row of the table (6 columns for 5 headers) | `scope.md`, `pr.md` |
| `docs/TECH_DEBT.md` | Added `TD-controllers-services-F1` (HTTP status of domain errors defined in service and controller), removed by `task-crud` | `review.md` (F1 accepted as debt) |
| `docs/KNOWN_ISSUES.md` | None: no known issues to record | `test-report.md` |

## Proposed standards changes

- None

The task files move to `work/done/controllers-services/` in the same commit.
