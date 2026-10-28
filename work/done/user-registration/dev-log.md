---
task: user-registration
artifact: dev-log
plan_version: 1
round: 1
status: done
---

# Development log: user-registration

One entry per increment, in commit order: a plan step, or a fix in a fix round. The code review reads the increments one by one, so each entry says what the reviewer needs to know about its commit.

## Increment 1: 1. Add `bcryptjs` dependency

- Commit: `c599735` chore(auth): add bcryptjs dependency
- Changes: `package.json`: added bcryptjs runtime dependency; `package-lock.json`: locked dependency version
- Decisions: none
- Tests: existing test suite (6 tests) passes
- Review focus: dependency version matches plan (^3.0.3)
- Deviation from the plan: none

## Increment 2: 2. Create user storage module (`src/storage/user-store.js`)

- Commit: `97caee6` feat(auth): add user storage module with atomic file writes
- Changes: `src/storage/user-store.js`: atomic user persistence module with serialization queue, ENOENT handling, unique email enforcement, and atomic file write (`.tmp` + `rename`)
- Decisions: handled missing data file (ENOENT) by returning empty array `[]` as suggested in critique; exported `readUsers` alongside `createUser` for verification and inspection
- Tests: existing test suite (6 tests) passes
- Review focus: promise serialization queue and atomic file write logic (`DATA-3`, `DATA-5`)
- Deviation from the plan: none

## Increment 3: 3. Create auth router and validation (`src/routes/auth.js`)

- Commit: `1938943` feat(auth): add auth router with input validation and register endpoint
- Changes: `src/routes/auth.js`: pure validation function `validateRegisterInput` checking email and password requirements; router factory `createAuthRouter` handling `POST /register` with bcrypt hashing and error formatting
- Decisions: passed trimmed email to `createUser` for consistent persistence and response payloads as suggested in critique
- Tests: existing test suite (6 tests) passes
- Review focus: input validation bounds (email regex, 8 characters min, 72 bytes max Buffer check) and bcrypt cost factor 10 (`SEC-1`, `SEC-9`)
- Deviation from the plan: none

## Increment 4: 4. Mount auth router in application factory (`src/app.js`)

- Commit: `b863191` feat(auth): mount auth router in application factory
- Changes: `src/app.js`: mounted auth router at `/auth` via `createAuthRouter(options)`
- Decisions: passed `options` down to `createAuthRouter` for flexible configuration and isolated test runs
- Tests: existing test suite (6 tests) passes
- Review focus: route mount placement before error handlers (`API-6`, `API-7`)
- Deviation from the plan: none

## Increment 5: 5. Create automated test suite (`test/auth.test.js`)

- Commit: `8968203` test(auth): add automated tests for registration endpoint and storage
- Changes: `test/auth.test.js`: automated test suite for registration covering valid registration, input validations, duplicate prevention (case-insensitive), bcrypt hash verification, and concurrent request serialization
- Decisions: created isolated temporary directory via `fs.mkdtemp` and cleaned up in `after` hook via `fs.rm` with recursive and force flags (`TEST-4`)
- Tests: T1–T8 added, verifying requirements R1–R6; all 14 tests in suite pass
- Review focus: concurrent registration test T8 verifying serialization and single saved user, and T7 inspecting stored password hash properties (`SEC-1`, `DATA-5`)
- Deviation from the plan: none

## Increment 6: 6. Add Postman collection and manual verification examples

- Commit: `5d8019f` docs(auth): add postman collection and update readme for registration
- Changes: `postman/task-api.postman_collection.json`: repeatable Postman collection with registration success, validation errors, and duplicate conflict requests; `README.md`: added `POST /auth/register` to features table, `DATA_FILE` to configuration, and curl verification command
- Decisions: structured Postman requests into Health and Auth folders with baseUrl variable (`TEST-8`)
- Tests: all 14 automated tests pass; manual curl verification documented
- Review focus: collection format compatibility and clear curl instructions (`TEST-8`, `R7`)
- Deviation from the plan: none

## Commands

| Command | Result |
| --- | --- |
| test: `npm test` | 14 passed, 0 failed |
| lint: `npm run lint` | no problems |

## Notes for testing

- The registration endpoint `POST /auth/register` accepts JSON with `email` and `password`.
- Passwords must be at least 8 characters and at most 72 bytes; emails must match standard format and are deduplicated case-insensitively.
- Storage defaults to `data/users.json`, or the path in `DATA_FILE` environment variable when set.
- Postman collection is available at `postman/task-api.postman_collection.json`.
