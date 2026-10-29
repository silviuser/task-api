---
task: dummy-data
artifact: scope
version: 1
status: confirmed
branch: dummy-data
roadmap_item: dummy-data
---

# Scope: Seed script with realistic fake users and tasks

## Goal

Enable developers and testers to populate isolated seed data files (`data/seed-users.json` and `data/seed-tasks.json` by default) with realistic, reproducible fake users and tasks via `npm run seed`, and log in or query seeded records immediately.

## Requirements

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| R1 | CLI seed command via `npm run seed` (`src/seed.js`) | Given a clean workspace, when `npm run seed` is executed, then it generates fake users and tasks, writes them to the configured seed files, prints a summary without exposing secrets (`SEC-10`), and exits with code 0. |
| R2 | Separate default seed files (`DATA-7`) | Given no `DATA_FILE` or `TASKS_FILE` environment overrides, when the seed function runs, then it writes to `data/seed-users.json` and `data/seed-tasks.json` without modifying `data/users.json` or `data/tasks.json`. |
| R3 | Clean replacement via storage modules (`DATA-1`, `DATA-3`) | Given existing records in the target seed files, when the seed function runs, then it replaces the file contents atomically through `user-store` and `task-store` so only the newly seeded records remain. |
| R4 | Realistic, deterministic fake data (`@faker-js/faker`) | Given default options (`userCount = 5`, `taskCount = 15`, fixed Faker seed), when the seed function runs twice, then it produces 5 valid users (unique lowercase emails) and 15 valid tasks (1–200 char titles, 0–1000 char descriptions, statuses across `"todo"`, `"in_progress"`, `"done"`) with repeatable content. |
| R5 | Loggable seeded users with bcrypt cost-10 password hashes (`SEC-1`) | Given users created by the seed script with the known default password (`"Password123!"`), when `POST /auth/login` is called against an app using the seeded user file, then login succeeds and returns a 200 JWT response. |
| R6 | Programmatic seed function with configurable counts and file paths | Given custom `userCount`, `taskCount`, `dataFile`, `tasksFile`, or `seed` options passed to `seedData(options)`, when called in automated tests (`TEST-4`), then it writes the exact requested counts to the temporary files and returns `{ users, tasks }` without `passwordHash` (`API-9`). |

## Out of scope

- Adding a `userId` ownership field to tasks (deferred to `task-authorization`).
- HTTP endpoints for triggering database seeding (seeding is CLI and programmatic only).
- Seeding Cloud Firestore or its emulator (deferred to `firestore-storage`).

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| `@faker-js/faker` (`devDependencies`) | Industry standard, built-in deterministic `faker.seed()`, rich person/lorem/company generators, supports `require("@faker-js/faker")` on Node 22+ | Larger install size in `node_modules` | Chosen |
| `@ngneat/falso` | Tree-shakeable, functional API | Less standard in PWCC coursework than Faker | Rejected |
| `chance` | Lightweight, seedable Mersenne Twister | Fewer domain-specific generators for task phrases | Rejected |
| Separate defaults `data/seed-users.json` and `data/seed-tasks.json` | Strictly satisfies `DATA-7` (seed data separate from real data) while allowing `DATA_FILE`/`TASKS_FILE` override | Requires passing env vars when starting the server with seed data | Chosen |

Sources:

- https://fakerjs.dev/guide/usage.html
- https://www.npmjs.com/package/@faker-js/faker
- https://www.npmjs.com/package/@ngneat/falso
- https://www.npmjs.com/package/chance

## Constraints and assumptions

- Node.js 22+ (`v24.19.0` in environment) supports `require("@faker-js/faker")` natively via ESM-in-CJS interop (`JS-6`).
- `@faker-js/faker` is installed in `devDependencies` (zero new production runtime dependencies).
- All persistence goes through `src/storage/user-store.js` and `src/storage/task-store.js` (`DATA-1`, `DATA-3`), adding `resetUsers` / `resetTasks` (or clear helpers) so replacement writes stay serialized and atomic.
- All existing tests and `npm run lint` continue passing (`JS-10`, `TEST-7`).

## Impact

- Code areas touched: `package.json`, `src/seed.js`, `src/storage/user-store.js`, `src/storage/task-store.js`, `test/seed.test.js`, `README.md`.
- Blast radius: Low (adds standalone `src/seed.js` script and storage reset helpers; existing HTTP routes and services are unchanged).
- Increment budget: Fits (3 production files touched, ~120 lines of production code, 0 new runtime dependencies).

## Split and placeholders

None needed; `dummy-data` fits within a single increment budget.

## Follow-ups

- `task-authorization`: Protect `/tasks` with JWT authentication, associate tasks (including seeded tasks) with a `userId`, and enforce ownership and stricter validation.

## Open questions

- None
