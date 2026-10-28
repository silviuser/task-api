---
task: controllers-services
artifact: review
round: 1
plan_version: 1
reviewed_commit: f1f9502
verdict: approved
---

# Code review: controllers-services, round 1

## Reviewed

- `git diff main...f1f9502`: 11 files, +587 / -90 lines (production code: 5 files, +135 / -90)
- build: none; test: 29 passed, 0 failed; lint: no problems

## Increments

| Increment | Commit | Plan step or finding | Notes |
| --- | --- | --- | --- |
| 1 | `0263aaa` | 1. Create health controller and update health route | conforms; route only binds `GET /` to `getHealth` (`R1`, `R2`) |
| 2 | `3267c0f` | 2. Create authentication service | conforms; no Express imports, cost 10, `DUMMY_PASSWORD_HASH` always compared, `HS256`/`1h`, same 401 message for both failures (`SEC-1`–`SEC-3`); `try`/`catch` only around `createUser` keeps bcrypt errors untouched |
| 3 | `55a3a67` | 3. Create authentication controller and update auth route | conforms; validators moved verbatim, 400/201/`Location`/200/409/401 identical to the old route; other errors go to `next` (`API-6`); dropping the validator export from `src/routes/auth.js` is safe (no other importer) |
| 4 | `f0a35dc` | 4. Add unit tests for service and controller layers | conforms; T4/T5 cover success and the 409/401/400 security cases, `next` forwarding verified; existing tests unchanged (`TEST-7`); unique e-mails keep tests independent (`TEST-4`) — see F1 |

## Findings

| ID | Severity | Location | Finding | Rule | Required change |
| --- | --- | --- | --- | --- | --- |
| F1 | nit | `src/services/auth-service.js:15`, `:29`; `src/controllers/auth-controller.js:51`, `:67` | HTTP status is defined twice: the service sets `err.status` (409/401), which `errorHandler` would already honor, and the controller also hardcodes 409/401 by `err.code`. Behavior is consistent and follows the approved plan, but there are two sources of truth. | `API-6` | None now; when `task-crud` adds more domain errors, pick one mapping (controller by `code`, or `errorHandler` by `status`). |

## Previous findings

None (round 1).

## Tech debt

- Every placeholder has a `TODO(<id>)` and a row in `tech-debt.md`: yes (no placeholders; no `TODO` in the diff)
- Accepted as debt in this review: F1

## Decision

approved: continue with task-testing.
