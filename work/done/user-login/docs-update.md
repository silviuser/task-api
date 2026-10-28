---
task: user-login
artifact: docs-update
pr: https://github.com/silviuser/task-api/pull/3
---

# Documentation update: user-login

| Document | Change | Source |
| --- | --- | --- |
| `README.md` | Already updated during development (`POST /auth/login` feature, `JWT_SECRET` setting, run command, and manual curl examples); no further changes needed | `work/user-login/dev-log.md`, `work/user-login/plan.md` |
| `docs/ARCHITECTURE.md` | Updated `src/app.js`, `src/routes/auth.js`, and `src/storage/user-store.js` component descriptions; added decisions D8 (`jsonwebtoken` HS256 1h) and D9 (constant-time dummy bcrypt hash on unknown email) | `work/user-login/scope.md`, `work/user-login/plan.md` |
| `docs/ROADMAP.md` | Marked `user-login` as `done` with PR `#3`; added `security-hardening` follow-up (`helmet` and `express-rate-limit` on `/auth/login`) | `work/user-login/scope.md`, `work/user-login/pr.md` |
| `docs/TECH_DEBT.md` | Unchanged (no open or resolved tech debt items) | `work/user-login/tech-debt.md`, `work/user-login/review.md` |
| `docs/KNOWN_ISSUES.md` | Unchanged (no known issues recorded) | `work/user-login/test-report.md` |

## Proposed standards changes

- None

The task files move to `work/done/user-login/` in the same commit.
