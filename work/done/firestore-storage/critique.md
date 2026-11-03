---
task: firestore-storage
artifact: critique
round: 1
plan_version: 1
verdict: approved
---

# Plan critique: firestore-storage, round 1

## Checklist

| Check | Result | Notes |
| --- | --- | --- |
| Every requirement in `scope.md` is covered | pass | R1–R8 are mapped to Steps 1–6 and tests T1–T6 |
| One logical increment; existing behavior keeps working | pass | JSON file persistence remains the fallback and takes precedence when `dataFile` / `tasksFile` are provided (`TEST-7`) |
| Within the increment budget (files, lines, dependencies) | pass | 5 production files, ~185 lines of production code, and 1 new runtime dependency (`firebase-admin`) |
| Testable: essential tests mapped to requirements, commands given | pass | T1–T6 cover R1–R8; `npm test` and `npm run lint` specified |
| Concise: under about 200 lines, snippets only for critical parts | pass | 158 lines with focused snippets for `getDb` and transactional `createUserInFirestore` |
| Follows `docs/standards/` (rule IDs) | pass | Follows `DATA-1`..`DATA-7`, `SEC-6`, `SEC-11`, `API-9`, `JS-6`..`JS-8`, `TEST-1`..`TEST-7`, `GIT-4` |
| Consistent with `docs/ARCHITECTURE.md` | pass | Keeps all persistence behind `src/storage/user-store.js` and `src/storage/task-store.js` (`D2`, `D10`, `D13`) without touching routes, controllers, or services |
| No over-engineering | pass | Uses plain functions in the existing storage modules and one shared `firestore.js` initializer |
| Placeholders recorded, with what removes them | pass | None needed; full increment fits in budget |
| Snippets correct and secure | pass | `db.runTransaction()` enforces case-insensitive email uniqueness (`DATA-5`) and omits `passwordHash` from returned user objects (`API-9`) |
| Risks identified | pass | Covers `FIRESTORE_EMULATOR_HOST` test isolation and fallback emulator handling when Java is unavailable |

## Required changes

| ID | Plan section | Problem | Required change |
| --- | --- | --- | --- |
| - | - | None | - |

## Suggestions

- In `src/storage/firestore.js` (Step 2), if `existing` app is found when `dbCache` misses, prefer `getFirestore(existing)` over `initializeFirestore(existing)` so it never conflicts with an already-initialized Firestore instance.
- In `src/seed.js` (Step 5), ensure the CLI log output (`require.main === module`) prints either the collection names or file paths cleanly when running in Firestore mode.

## Decision

approved: development can start.
