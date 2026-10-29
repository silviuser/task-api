---
task: task-crud
artifact: docs-update
pr: https://github.com/silviuser/task-api/pull/5
---

# Documentation update: task-crud

| Document | Change | Source |
| --- | --- | --- |
| `README.md` | Added `/tasks` CRUD endpoints to Features, `TASKS_FILE` to Configuration, and `curl` manual verification commands for `/tasks` | `scope.md`, `plan.md`, `pr.md` |
| `docs/ARCHITECTURE.md` | Added `src/routes/tasks.js`, `src/controllers/task-controller.js`, `src/services/task-service.js`, and `src/storage/task-store.js` to Components; added `Task` entity to Data model; added decisions `D13`–`D15` | `scope.md`, `plan.md`, `dev-log.md` |
| `docs/ROADMAP.md` | Marked item 5 (`task-crud`) as `done` with PR `#5` (`dummy-data` and `task-authorization` are already scheduled as items 6 and 7) | `scope.md`, `pr.md` |
| `docs/TECH_DEBT.md` | Marked `TD-controllers-services-F1` as `resolved` (no new tech debt introduced) | `tech-debt.md`, `review.md` |
| `docs/KNOWN_ISSUES.md` | No changes (no known issues recorded) | `test-report.md` |

## Proposed standards changes

- None

The task files move to `work/done/task-crud/` in the same commit.
