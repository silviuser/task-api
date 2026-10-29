---
task: dummy-data
artifact: review
round: 1
plan_version: 1
reviewed_commit: e8772ac
verdict: approved
---

# Code review: dummy-data, round 1

## Reviewed

- `git diff main...e8772ac`: 11 files, +637 / -4 lines (production code: 3 files, +100 / -4 lines)
- build: none; test: 42 passed, 0 failed; lint: no problems

## Increments

| Increment | Commit | Plan step or finding | Notes |
| --- | --- | --- | --- |
| 1 | `3a3e695` | 1. Install `@faker-js/faker` and add `npm run seed` in `package.json` | conforms |
| 2 | `ad4c3f4` | 2. Add `resetUsers` to `src/storage/user-store.js` and `resetTasks` to `src/storage/task-store.js` | conforms |
| 3 | `a8b7ee2` | 3. Create `src/seed.js` | conforms |
| 4 | `5a25c8b` | 4. Create `test/seed.test.js` | conforms |

## Findings

| ID | Severity | Location | Finding | Rule | Required change |
| --- | --- | --- | --- | --- | --- |
| None | - | - | No issues found | - | - |

## Previous findings

Not applicable (round 1).

## Tech debt

- Every placeholder has a `TODO(<id>)` and a row in `tech-debt.md`: yes
- Accepted as debt in this review: none

## Decision

approved: continue with task-testing.
