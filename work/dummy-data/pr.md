---
task: dummy-data
artifact: pr
branch: dummy-data
base: main
updated_commit: none
pr: not created
---

# feat(seed): add deterministic seed script with fake users and tasks

## Summary

Adds a deterministic seed script (`src/seed.js`, exposed as `npm run seed`) and a programmatic `seedData(options)` helper using `@faker-js/faker` (`devDependencies`). By default, it writes 5 loggable fake users (cost-10 bcrypt password `"Password123!"`) and 15 fake tasks to isolated seed files (`data/seed-users.json` and `data/seed-tasks.json`, overridable via `DATA_FILE` and `TASKS_FILE`) so developers and testers can immediately log in and query seeded records without modifying real data files.

## Changes

- Add `@faker-js/faker` (`^10.6.0`) to `devDependencies` and `"seed": "node src/seed.js"` script (`package.json`, `package-lock.json`)
- Extract `writeUsers` and export serialized atomic `resetUsers(options)` and `resetTasks(options)` helpers (`src/storage/user-store.js`, `src/storage/task-store.js`)
- Create `seedData(options)`, `DEFAULT_SEED_PASSWORD`, and CLI runner (`src/seed.js`)
- Add CLI, default path isolation, atomic replacement, and HTTP login/tasks integration tests (`test/seed.test.js`)

## How to test

```bash
npm ci
npm test
npm run lint
```

Manual checks (from `test-report.md`):

- Run `npm run seed` and verify it exits 0, prints `Seeded 5 users (.../data/seed-users.json) and 15 tasks (.../data/seed-tasks.json)` without exposing secrets, and leaves `data/users.json` and `data/tasks.json` untouched.
- Run `npm run seed` a second time and verify `data/seed-users.json` and `data/seed-tasks.json` are replaced atomically with the same 5 deterministic users and 15 tasks across `"todo"`, `"in_progress"`, and `"done"`.
- Start the API against the seeded files (`DATA_FILE=data/seed-users.json TASKS_FILE=data/seed-tasks.json JWT_SECRET=dev-secret npm start`), send `POST /auth/login` with a seeded user email (`nikita_crist@gmail.com`) and `"Password123!"` to receive a `200` JWT response, and send `GET /tasks` to receive the 15 seeded tasks.

## Quality gates

| Gate | Task file | Result |
| --- | --- | --- |
| Plan critique | `critique.md`, round 1 | approved |
| Code review | `review.md`, round 1 | approved |
| Tests | `test-report.md`, round 1 | pass |

## Tech debt

- None

## Follow-ups

- `task-authorization`: Protect `/tasks` with JWT authentication, associate tasks (including seeded tasks) with a `userId`, and enforce ownership and stricter validation.
