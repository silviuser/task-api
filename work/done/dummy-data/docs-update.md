---
task: dummy-data
artifact: docs-update
pr: https://github.com/silviuser/task-api/pull/6
---

# Documentation update: dummy-data

| Document | Change | Source |
| --- | --- | --- |
| `README.md` | Added `npm run seed` (`seedData` in `src/seed.js`) to Features, noted `data/seed-users.json` and `data/seed-tasks.json` defaults for `npm run seed` in Configuration, and added seed usage commands under Run | `scope.md`, `plan.md`, `pr.md` |
| `docs/ARCHITECTURE.md` | Added `src/seed.js` and `resetUsers`/`resetTasks` storage methods to Components; added decision `D16` | `scope.md`, `plan.md`, `dev-log.md` |
| `docs/ROADMAP.md` | Marked item 6 (`dummy-data`) as `done` with PR `#6` (`task-authorization` is already scheduled as item 7) | `scope.md`, `pr.md` |
| `docs/TECH_DEBT.md` | No changes (no new tech debt introduced or resolved) | `tech-debt.md`, `review.md` |
| `docs/KNOWN_ISSUES.md` | No changes (no known issues recorded) | `test-report.md` |

## Proposed standards changes

- None

The task files move to `work/done/dummy-data/` in the same commit.
