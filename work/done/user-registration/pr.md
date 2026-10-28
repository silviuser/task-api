---
task: user-registration
artifact: pr
branch: user-registration
base: main
updated_commit: none
pr: https://github.com/silviuser/task-api/pull/2
---

# feat(auth): add user registration endpoint and atomic json file storage

## Summary

Allow new users to register via `POST /auth/register` with email and password, store user records safely in a local JSON file with bcrypt password hashing, and support manual testing with Postman and curl.

## Changes

- Add `bcryptjs` runtime dependency for secure password hashing (`package.json`, `package-lock.json`).
- Implement safe local JSON user storage module with atomic file writes, missing file handling, and unique email enforcement (`src/storage/user-store.js`).
- Implement auth router with input validation for email and password, and `POST /auth/register` endpoint (`src/routes/auth.js`).
- Mount auth router in application factory (`src/app.js`).
- Add comprehensive automated test suite for registration and storage (`test/auth.test.js`).
- Add Postman collection and update documentation with registration endpoint details and curl examples (`postman/task-api.postman_collection.json`, `README.md`).

## How to test

```bash
npm ci
npm test
npm run lint
```

Manual checks:
- Start the server with `npm run dev` and send `POST /auth/register` with `{ "email": "alice@example.com", "password": "Password123!" }` to verify HTTP 201 Created and user JSON response without secrets.
- Re-send `POST /auth/register` with duplicate email `Alice@example.com` to verify HTTP 409 Conflict.
- Send invalid email or password shorter than 8 characters or longer than 72 bytes to verify HTTP 400 Bad Request.
- Run the Postman collection in `postman/task-api.postman_collection.json`.

## Quality gates

| Gate | Task file | Result |
| --- | --- | --- |
| Plan critique | `critique.md`, round 1 | approved |
| Code review | `review.md`, round 1 | approved |
| Tests | `test-report.md`, round 1 | pass |

## Tech debt

- None

## Follow-ups

- `user-login`: `POST /auth/login` with credentials check and JWT generation.
- `controllers-services`: Refactor routes, controllers, and services.
