---
task: controllers-services
artifact: critique
round: 1
plan_version: 1
verdict: approved
---

# Plan critique: controllers-services, round 1

## Checklist

| Check | Result | Notes |
| --- | --- | --- |
| Every requirement in `scope.md` is covered | pass | `R1`–`R6` are mapped across Steps 1–4 and tests `T1`–`T5`. |
| One logical increment; existing behavior keeps working | pass | Pure architectural refactoring into routes, controllers, and service layers; `createApp(options)` and HTTP behavior remain unchanged (`TEST-7`). |
| Within the increment budget (files, lines, dependencies) | pass | 5 production files (~145 lines of production code), 1 test file, 0 new runtime dependencies. |
| Testable: essential tests mapped to requirements, commands given | pass | Existing integration suites (`T1`–`T3`) plus targeted unit tests (`T4`, `T5`) for `auth-service` and controllers; `npm test` and `npm run lint` specified (`TEST-1`, `TEST-3`). |
| Concise: under about 200 lines, snippets only for critical parts | pass | 139 lines total; concise tables and two focused snippets (`loginUser` and `createAuthRouter`). |
| Follows `docs/standards/` (rule IDs) | pass | Complies with `API-3`–`API-6`, `API-9`, `DATA-1`, `DATA-2`, `JS-1`–`JS-10`, `SEC-1`–`SEC-3`, `SEC-9`, and `TEST-1`–`TEST-7`. |
| Consistent with `docs/ARCHITECTURE.md` | pass | Preserves Express 5 request flow (`D1`), `user-store.js` storage boundary (`D2`), `bcryptjs` cost-10 hashing (`D6`), `HS256`/`1h` JWT signing (`D8`), and dummy hash timing protection (`D9`). |
| No over-engineering | pass | Uses plain/factory functions consistent with codebase conventions and omits an unnecessary `health-service.js` pass-through. |
| Placeholders recorded, with what removes them | pass | None needed; explicitly recorded. |
| Snippets correct and secure | pass | `loginUser` preserves constant-time `DUMMY_PASSWORD_HASH` comparison (`SEC-2`) and `HS256`/`1h` JWT claims (`SEC-3`); `createAuthRouter` cleanly binds controller handlers. |
| Risks identified | pass | Identifies and mitigates error status/code propagation between `auth-service` and `auth-controller`. |

## Required changes

None.

## Suggestions

- In `src/controllers/auth-controller.js`, since `auth-service.js` already attaches `err.status = 409` (`DUPLICATE_EMAIL`) and `err.status = 401` (`INVALID_CREDENTIALS`), ensure the controller either handles those codes explicitly or forwards them cleanly to `errorHandler` (`API-6`), keeping behavior identical in both paths.

## Decision

approved: development can start.
