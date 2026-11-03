---
task: firestore-storage
artifact: docs-update
pr: https://github.com/silviuser/task-api/pull/9
---

# Documentation update: firestore-storage

| Document | Change | Source |
| --- | --- | --- |
| `README.md` | Updated overview, added `firestore-storage` feature row, documented `FIRESTORE_EMULATOR_HOST`, `GOOGLE_APPLICATION_CREDENTIALS`, and `GCLOUD_PROJECT` / `FIREBASE_PROJECT_ID`, and added Firestore emulator run and seed commands | `scope.md`, `plan.md`, `dev-log.md` |
| `docs/ARCHITECTURE.md` | Added `src/storage/firestore.js` component, updated `user-store`, `task-store`, `seed.js`, and Data model tables for Cloud Firestore (`users`, `tasks`, `seed_users`, `seed_tasks`), and recorded decisions D20–D22 | `plan.md`, `dev-log.md`, `review.md` |
| `docs/ROADMAP.md` | Marked item 8 (`firestore-storage`) as `done` with PR `#9` and noted `firestore-storage` on the `security-hardening` follow-up | `scope.md`, `pr.md` |
| `docs/TECH_DEBT.md` | Unchanged (no open or resolved tech debt items in this task) | `tech-debt.md`, `review.md` |
| `docs/KNOWN_ISSUES.md` | Unchanged (no known issues recorded) | `test-report.md` |

## Proposed standards changes

- None

The task files move to `work/done/firestore-storage/` in the same commit.
