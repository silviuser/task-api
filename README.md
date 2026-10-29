# Task API

A REST API for personal tasks (to-dos): users register, sign in with a JSON Web Token and manage their own tasks. Node.js and Express 5; data in a local JSON file first, in Cloud Firestore later.

## Features

| Feature | Interface | Since |
| --- | --- | --- |
| Health check | `GET /health` | `app-foundation` |
| User registration | `POST /auth/register` | `user-registration` |
| User login | `POST /auth/login` | `user-login` |
| Task CRUD | `POST /tasks`, `GET /tasks`, `GET /tasks/:id`, `PATCH /tasks/:id`, `DELETE /tasks/:id` | `task-crud` |
| Seed data | `npm run seed` (`seedData` in `src/seed.js`) | `dummy-data` |
| Task authorization | Bearer JWT authentication, per-user task ownership (`userId`), and strict allow-list/UUIDv4 validation on `/tasks` | `task-authorization` |

## Requirements

- Node.js 22 or newer, with npm
- Git, and GitHub CLI (`gh`) for pull requests
- A coding agent that reads skills, for example Antigravity CLI (`agy`)

## Setup

```bash
npm ci
```

## Configuration

| Setting | Meaning | Default |
| --- | --- | --- |
| `PORT` | HTTP port the server listens on | `3000` |
| `DATA_FILE` | Path to local JSON file for user persistence (`data/seed-users.json` for `npm run seed`) | `data/users.json` |
| `TASKS_FILE` | Path to local JSON file for task persistence (`data/seed-tasks.json` for `npm run seed`) | `data/tasks.json` |
| `JWT_SECRET` | Secret key used to sign and verify JSON Web Tokens | required (no default) |

## Run

```bash
JWT_SECRET=dev-secret-key npm start
```

In development, with `.env` loaded (`JWT_SECRET=...`) and automatic restart on change:

```bash
npm run dev
```

To populate isolated seed files (`data/seed-users.json` with 5 users and password `"Password123!"`, and `data/seed-tasks.json` with 15 tasks) and start the server against them:

```bash
npm run seed
DATA_FILE=data/seed-users.json TASKS_FILE=data/seed-tasks.json JWT_SECRET=dev-secret-key npm start
```

## Test

```bash
npm test
npm run lint
```

Manual checks:

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/unknown
curl -i -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123!"}'
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"WrongPassword!"}'
curl -i -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Write API documentation","description":"Document all /tasks endpoints","status":"todo"}'
curl -i http://localhost:3000/tasks \
  -H "Authorization: Bearer <token>"
curl -i http://localhost:3000/tasks/<taskId> \
  -H "Authorization: Bearer <token>"
curl -i -X PATCH http://localhost:3000/tasks/<taskId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'
curl -i -X DELETE http://localhost:3000/tasks/<taskId> \
  -H "Authorization: Bearer <token>"
```

Alternatively, import and run `postman/task-api.postman_collection.json` in Postman.

## Development workflow

Every change is a task that goes through eight phases, each one a skill in `.agents/skills/`; the rules are in `AGENTS.md`. A task starts with `/task-scoping`, which takes the next roadmap item when it gets no request. The later phases (`/task-planning`, `/task-plan-critique`, `/task-development`, `/task-code-review`, `/task-testing`, `/task-gitops`, `/task-doc-updates`) find the task from the current branch. The files of a task are in `work/<slug>/` while it is open and in `work/done/<slug>/` after it is finished.

The skills do not depend on this project; `.agents/README.md` explains how to use them in another one.
