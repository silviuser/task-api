---
task: user-login
artifact: review
round: 1
plan_version: 1
reviewed_commit: 7a7abfe
verdict: approved
---

# Code review: user-login, round 1

## Reviewed

- `git diff main...7a7abfe`: 15 files, +792 / -9 lines (10 non-work files: `README.md`, `package.json`, `package-lock.json`, `postman/task-api.postman_collection.json`, `src/app.js`, `src/routes/auth.js`, `src/storage/user-store.js`, `test/auth.test.js`, `test/health.test.js`, `test/middleware.test.js`)
- build: none; test: 21 passed, 0 failed; lint: no problems

## Increments

| Increment | Commit | Plan step or finding | Notes |
| --- | --- | --- | --- |
| 1 | `fb64b48` | 1. Install `jsonwebtoken` | conforms |
| 2 | `87e6a93` | 2. Add `findUserByEmail` to `src/storage/user-store.js` | conforms |
| 3 | `078268a` | 3. Enforce `JWT_SECRET` in `src/app.js` | conforms (existing test setup updates included so `npm test` passes on every commit per `GIT-3`) |
| 4 | `63e01df` | 4. Implement `validateLoginInput` and `POST /auth/login` in `src/routes/auth.js` | conforms |
| 5 | `d26cc05` | 5. Update existing test setups and add login tests | conforms |
| 6 | `01c8097` | 6. Update Postman collection and `README.md` | conforms |

## Findings

| ID | Severity | Location | Finding | Rule | Required change |
| --- | --- | --- | --- | --- | --- |
| None | - | - | No defects or standard violations found. | - | - |

## Previous findings

None (round 1).

## Tech debt

- Every placeholder has a `TODO(<id>)` and a row in `tech-debt.md`: yes (no placeholders introduced)
- Accepted as debt in this review: none

## Decision

approved: continue with task-testing.
