---
task: firestore-storage
artifact: review
round: 1
plan_version: 1
reviewed_commit: e1e3ade
verdict: approved
---

# Code review: firestore-storage, round 1

## Reviewed

- `git diff main...e1e3ade`: 13 files, +2840 / -23 lines (production code: 5 files, +209 / -10 lines)
- build: none; test: 52 passed, 0 failed; lint: no problems

## Increments

| Increment | Commit | Plan step or finding | Notes |
| --- | --- | --- | --- |
| 1 | `fb9b792` | 1. Install `firebase-admin` and update `.gitignore` | Conforms (`GIT-4`, `SEC-6`) |
| 2 | `3d40299` | 2. Create `src/storage/firestore.js` | Conforms (`DATA-4`, `SEC-6`, `SEC-11`) |
| 3 | `c60ca1d` | 3. Add Firestore persistence in `src/storage/user-store.js` | Conforms (`DATA-1`, `DATA-2`, `DATA-5`, `API-9`) |
| 4 | `5147cad` | 4. Add Firestore persistence in `src/storage/task-store.js` | Conforms (`DATA-1`, `DATA-2`, `DATA-5`, `DATA-6`) |
| 5 | `8f4c168` | 5. Support Firestore mode in `src/seed.js` | Conforms (`DATA-7`, `SEC-10`) |
| 6 | `b1bbca7` | 6. Create `test/firestore.test.js` | Conforms; justified `authClient` addition in `src/storage/firestore.js` for offline emulator REST transport (`TEST-1`..`TEST-7`) |

## Findings

| ID | Severity | Location | Finding | Rule | Required change |
| --- | --- | --- | --- | --- | --- |
| None | - | - | No findings | - | - |

## Previous findings

None (round 1).

## Tech debt

- Every placeholder has a `TODO(<id>)` and a row in `tech-debt.md`: yes (no placeholders)
- Accepted as debt in this review: none

## Decision

approved: continue with task-testing.
