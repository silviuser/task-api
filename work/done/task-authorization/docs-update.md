---
task: task-authorization
artifact: docs-update
pr: https://github.com/silviuser/task-api/pull/7
---

# Documentation update: task-authorization

| Document | Change | Source |
| --- | --- | --- |
| `README.md` | Added `task-authorization` to Features table and added `Authorization: Bearer <token>` headers to `/tasks` curl examples | `scope.md`, `plan.md`, `pr.md` |
| `docs/ARCHITECTURE.md` | Added `src/middleware/authenticate.js`, updated `/tasks` components and `Task.userId` data model, and recorded decisions `D16`..`D18` | `scope.md`, `plan.md`, `dev-log.md` |
| `docs/ROADMAP.md` | Marked item 7 (`task-authorization`) as `done` with pull request `https://github.com/silviuser/task-api/pull/7` | `scope.md`, `pr.md` |
| `docs/TECH_DEBT.md` | None (no new or resolved tech debt) | `tech-debt.md`, `review.md` |
| `docs/KNOWN_ISSUES.md` | None (no known issues recorded) | `test-report.md` |

## Proposed standards changes

- None

The task files move to `work/done/task-authorization/` in the same commit.
