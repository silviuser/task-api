---
task: firestore-storage
artifact: plan
version: 1
scope_version: 1
answers_critique_round: 0
---

# Plan: Cloud Firestore behind the storage module and tests on the Firestore emulator

## Summary

Add Cloud Firestore persistence (`firebase-admin` modular SDK: `firebase-admin/app` and `firebase-admin/firestore`) behind `src/storage/user-store.js` and `src/storage/task-store.js` via a single initialization module `src/storage/firestore.js` (`DATA-1`, `DATA-4`, `SEC-11`). Automatically select Firestore when `FIRESTORE_EMULATOR_HOST`, `GOOGLE_APPLICATION_CREDENTIALS`, or `options.useFirestore` / `options.projectId` is present and no explicit `dataFile` / `tasksFile` option is passed, keeping local JSON storage as the fallback so all routes, controllers, services, and existing tests work unchanged (`D2`, `DATA-1`, `TEST-7`). Update `src/seed.js` to support isolated Firestore seed collections (`seed_users`, `seed_tasks`) (`DATA-7`) and add `test/firestore.test.js` running against `FIRESTORE_EMULATOR_HOST` (`TEST-1`..`TEST-6`).

## Context

- `docs/ARCHITECTURE.md`: Persistence is isolated behind `src/storage/user-store.js` and `src/storage/task-store.js`; routes (`src/routes/`), controllers (`src/controllers/`), and services (`src/services/`) depend only on the storage functions (`D2`, `D10`, `DATA-1`).
- `src/storage/user-store.js` & `src/storage/task-store.js`: Currently persist to local JSON files using a module-level `serialize` queue and `.tmp` file rename (`D7`, `D13`, `DATA-3`). Every function already accepts an `options` object forwarded from `createApp(options)` through controllers and services.
- `src/seed.js`: Calls `userStore.resetUsers`, `userStore.createUser`, `taskStore.resetTasks`, and `taskService.createTask` (`DATA-1`, `DATA-7`).
- `test/*.test.js`: Existing suites pass explicit `dataFile` / `tasksFile` paths (`TEST-4`, `TEST-7`).

## Files

| # | File | Action | Purpose |
| --- | --- | --- | --- |
| 1 | `package.json` | modify | Add runtime dependency `firebase-admin` (`^14.5.0`) |
| 2 | `package-lock.json` | modify | Lock `firebase-admin` dependency tree (`GIT-4`) |
| 3 | `.gitignore` | modify | Ignore `.firebase/`, `firebase-debug.log*`, and `firestore-debug.log*` (`GIT-4`, `SEC-6`) |
| 4 | `src/storage/firestore.js` | create | Single Firebase Admin initialization module exporting `getDb(options)` and `isFirestoreEnabled(options, fileKey)` (`DATA-4`, `SEC-6`, `SEC-11`) |
| 5 | `src/storage/user-store.js` | modify | Add Firestore implementation (`createUser` with `db.runTransaction()`, `findUserByEmail`, `readUsers`, `resetUsers`) while preserving JSON fallback (`DATA-1`, `DATA-2`, `DATA-5`) |
| 6 | `src/storage/task-store.js` | modify | Add Firestore implementation (`createTask`, `listTasks`, `getTaskById`, `updateTask`, `deleteTask`, `resetTasks`) while preserving JSON fallback (`DATA-1`, `DATA-2`, `DATA-6`) |
| 7 | `src/seed.js` | modify | Support Firestore mode with isolated default collections (`seed_users`, `seed_tasks`) while preserving JSON defaults (`DATA-7`) |
| 8 | `test/firestore.test.js` | create | Automated integration, concurrency, and HTTP tests against `FIRESTORE_EMULATOR_HOST` (`TEST-1`..`TEST-6`) |

## Steps

### Step 1. Install `firebase-admin` and update `.gitignore`

Run `npm install firebase-admin@14.5.0` to add the single allowed runtime dependency (`AGENTS.md`, `GIT-4`). Append `.firebase/`, `firebase-debug.log*`, and `firestore-debug.log*` to `.gitignore` (`GIT-4`, `SEC-6`).

### Step 2. Create `src/storage/firestore.js`

Use `firebase-admin/app` (`initializeApp`, `getApps`, `applicationDefault`) and `firebase-admin/firestore` (`getFirestore`, `initializeFirestore`) (`DATA-4`, `SEC-6`, `SEC-11`, `JS-6`).
- Export `isFirestoreEnabled(options = {}, fileKey)`: return `false` if `typeof options === "string"` or `Boolean(options?.[fileKey])`; return `true` if `Boolean(options?.useFirestore || options?.projectId || process.env.FIRESTORE_EMULATOR_HOST || process.env.GOOGLE_APPLICATION_CREDENTIALS)`.
- Export `getDb(options = {})`: resolve `projectId = options.projectId ?? process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? "task-api"`. Maintain a `Map` of initialized Firestore instances keyed by `projectId`. If no app named `projectId` exists in `getApps()`, call `initializeApp(appOptions, projectId)` (passing `credential: applicationDefault()` when `process.env.GOOGLE_APPLICATION_CREDENTIALS` is set and `process.env.FIRESTORE_EMULATOR_HOST` is not) and `initializeFirestore(app, { preferRest: true })` so REST and gRPC emulator/production transports both work cleanly. Cache and return the `db` instance (`DATA-4`).

```javascript
const { initializeApp, getApps, getApp, applicationDefault } = require("firebase-admin/app");
const { initializeFirestore } = require("firebase-admin/firestore");

const dbCache = new Map();

function getDb(options = {}) {
  const projectId = options.projectId ?? process.env.GCLOUD_PROJECT ?? "task-api";
  if (dbCache.has(projectId)) return dbCache.get(projectId);
  const existing = getApps().find((a) => a.name === projectId);
  const app = existing ?? initializeApp(
    process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST
      ? { credential: applicationDefault(), projectId }
      : { projectId },
    projectId,
  );
  const db = existing ? initializeFirestore(getApp(projectId)) : initializeFirestore(app, { preferRest: true });
  dbCache.set(projectId, db);
  return db;
}
```

### Step 3. Add Firestore persistence in `src/storage/user-store.js`

Import `{ getDb, isFirestoreEnabled }` from `./firestore` (`DATA-1`, `DATA-2`, `DATA-5`, `JS-7`, `JS-8`). Resolve the collection name via `options.usersCollection ?? "users"`.When `isFirestoreEnabled(options, "dataFile")` is true:
- `createUser({ email, passwordHash }, options)`: normalize `normalized = email.trim().toLowerCase()`. Run `await db.runTransaction(async (tx) => { ... })` (`DATA-5`): query `tx.get(col.where("email", "==", normalized).limit(1))`; if `!snap.empty`, throw `Object.assign(new Error("Email already registered"), { code: "DUPLICATE_EMAIL" })`. Otherwise generate `user = { id: crypto.randomUUID(), email: normalized, passwordHash, createdAt: new Date().toISOString() }`, call `tx.set(col.doc(user.id), user)`, and return `{ id: user.id, email: user.email, createdAt: user.createdAt }` (`API-9`, `DATA-2`).
- `findUserByEmail(email, options)`: query `col.where("email", "==", String(email).trim().toLowerCase()).limit(1).get()`; return `snap.empty ? null : { ...snap.docs[0].data() }`.
- `readUsers(options)`: fetch `await col.get()` and return `snap.docs.map((doc) => ({ ...doc.data() }))`.
- `resetUsers(options)`: fetch `await col.get()`, delete all docs in a `db.batch()` (`await batch.commit()`), and return.

```javascript
async function createUserInFirestore({ email, passwordHash }, options) {
  const col = getDb(options).collection(options.usersCollection ?? "users");
  const normalized = email.trim().toLowerCase();
  return getDb(options).runTransaction(async (tx) => {
    const existing = await tx.get(col.where("email", "==", normalized).limit(1));
    if (!existing.empty) {
      const err = new Error("Email already registered");
      err.code = "DUPLICATE_EMAIL";
      throw err;
    }
    const user = { id: crypto.randomUUID(), email: normalized, passwordHash, createdAt: new Date().toISOString() };
    tx.set(col.doc(user.id), user);
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  });
}
```

### Step 4. Add Firestore persistence in `src/storage/task-store.js`

Import `{ getDb, isFirestoreEnabled }` from `./firestore` (`DATA-1`, `DATA-2`, `DATA-6`, `JS-7`, `JS-8`). Resolve the collection name via `options.tasksCollection ?? "tasks"`. When `isFirestoreEnabled(options, "tasksFile")` is true:
- `createTask({ title, description, status, userId }, options)`: build `task = { id: crypto.randomUUID(), ...(userId !== undefined ? { userId } : {}), title, description, status, createdAt: now, updatedAt: now }`, write `await col.doc(task.id).set(task)`, and return `{ ...task }`.
- `listTasks(options)`: if `options?.userId !== undefined`, run `await col.where("userId", "==", String(options.userId)).get()`; otherwise `await col.get()`. Return `snap.docs.map((d) => ({ ...d.data() }))`.
- `getTaskById(id, options)`: fetch `const doc = await col.doc(String(id)).get()`; return `doc.exists ? { ...doc.data() } : null`.
- `updateTask(id, updates, options)`: inside `db.runTransaction(async (tx) => { ... })` (`DATA-5`, `DATA-6`), read `const doc = await tx.get(col.doc(String(id)))`; if `!doc.exists`, return `null`. Compute `updated = { ...doc.data(), ...updates, updatedAt: new Date().toISOString() }`, call `tx.update(col.doc(String(id)), { ...updates, updatedAt: updated.updatedAt })`, and return `updated`.
- `deleteTask(id, options)`: inside `db.runTransaction`, read `doc`; if `!doc.exists`, return `false`; call `tx.delete(doc.ref)` and return `true`.
- `resetTasks(options)`: batch-delete all documents in `col`.

### Step 5. Support Firestore mode in `src/seed.js`

In `src/seed.js` (`DATA-7`), check `const useFirestore = isFirestoreEnabled(options, "dataFile") && isFirestoreEnabled(options, "tasksFile")`.
- When `useFirestore` is true, pass `storeOptions = { ...options, useFirestore: true, usersCollection: options.usersCollection ?? "seed_users", tasksCollection: options.tasksCollection ?? "seed_tasks" }` to `userStore.resetUsers`, `taskStore.resetTasks`, `userStore.createUser`, and `taskService.createTask`, and return `{ users, tasks, usersCollection: storeOptions.usersCollection, tasksCollection: storeOptions.tasksCollection }`.
- When `useFirestore` is false, keep the existing `dataFile` / `tasksFile` behavior (`data/seed-users.json`, `data/seed-tasks.json`) unchanged.

### Step 6. Create `test/firestore.test.js`

Write `test/firestore.test.js` (`TEST-1`..`TEST-7`). Before the suite runs, if `process.env.FIRESTORE_EMULATOR_HOST` is not set, start a lightweight in-process HTTP/1.1 + gRPC-compatible Firestore REST emulator server on an ephemeral port (`127.0.0.1:<port>`) and set `process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:<port>"` so `firebase-admin/firestore` (`preferRest: true`) talks to `FIRESTORE_EMULATOR_HOST` over HTTP without external network access or Java requirement (`TEST-2`, `TEST-4`, `TEST-5`), and close it in `after()`. Use a unique `projectId` (`test-firestore-${crypto.randomUUID()}`) and test R1–R8.

## Interfaces and data

- HTTP endpoints: unchanged (`/health`, `/auth/register`, `/auth/login`, `/tasks`, `/tasks/:id`).
- `src/storage/firestore.js`:
  - `getDb(options?: { projectId?: string, useFirestore?: boolean }) => Firestore`
  - `isFirestoreEnabled(options?: object | string, fileKey?: string) => boolean`
- Storage & seed options extended with `{ useFirestore?: boolean, projectId?: string, usersCollection?: string, tasksCollection?: string }`.
- Environment variables: `FIRESTORE_EMULATOR_HOST` (e.g. `127.0.0.1:8080`), `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON).
- New runtime dependency: `firebase-admin@^14.5.0`.

## Tests

| ID | File | Checks | Requirement | New / existing |
| --- | --- | --- | --- | --- |
| T1 | `test/firestore.test.js` | `getDb(options)` returns the same Firestore instance across repeated calls for the same project and selects Firestore when `FIRESTORE_EMULATOR_HOST` or `useFirestore` is set | R1, R2 | new |
| T2 | `test/firestore.test.js` | `createUser` stores a UUIDv4 user without `passwordHash` in return value, `findUserByEmail` finds case-insensitively with `passwordHash`, `readUsers` lists users, `resetUsers` clears collection, and concurrent `createUser` calls with the same email allow only one to succeed while rejecting the other with `DUPLICATE_EMAIL` | R3, R4 | new |
| T3 | `test/firestore.test.js` | `createTask`, `listTasks({ userId })`, `getTaskById`, `updateTask` (partial update + `updatedAt`, `null` when missing), `deleteTask` (`true`/`false`), and `resetTasks` on Firestore | R5 | new |
| T4 | `test/firestore.test.js` | Full HTTP flow via `createApp({ useFirestore: true, projectId, jwtSecret })`: `POST /auth/register` (201, 409), `POST /auth/login` (200, 401), and `/tasks` CRUD + ownership (201, 200, 403, 404, 204) | R6 | new |
| T5 | `test/firestore.test.js` | `seedData({ useFirestore: true, projectId, userCount: 2, taskCount: 4 })` populates `seed_users` and `seed_tasks` without touching `users` or `tasks` | R7 | new |
| T6 | `test/auth.test.js`, `test/tasks.test.js`, `test/seed.test.js`, `test/health.test.js`, `test/middleware.test.js` | Existing JSON-backed test suites pass unchanged when `dataFile` / `tasksFile` are provided | R2, R8 | existing |

Commands:
- `npm test` (runs all `node:test` suites including `test/firestore.test.js` and exits 0)
- `npm run lint` (ESLint reports 0 errors)

## Placeholders and tech debt

| Placeholder | Why | Removed by |
| --- | --- | --- |
| None | Full Firestore storage and emulator test suite fit within the increment budget | - |

## Size

- Production code: about 185 changed lines in 5 files (`package.json`, `src/storage/firestore.js`, `src/storage/user-store.js`, `src/storage/task-store.js`, `src/seed.js`); new runtime dependencies: 1 (`firebase-admin`).
- Increment budget: fits (<= 300 lines, <= 10 files, <= 1 new runtime dependency).

## Risks

- Setting `FIRESTORE_EMULATOR_HOST` globally during `npm test` could affect other test files if they do not pass `dataFile` / `tasksFile`: mitigated by having `isFirestoreEnabled` return `false` whenever `dataFile` / `tasksFile` is passed, and restoring `process.env.FIRESTORE_EMULATOR_HOST` in `after()` in `test/firestore.test.js`.
- Environments without a Java runtime cannot spawn the Java `cloud-firestore-emulator` binary: mitigated by supporting an already-running `FIRESTORE_EMULATOR_HOST` and falling back to a local in-process Firestore v1 REST emulator endpoint when `FIRESTORE_EMULATOR_HOST` is unset.

## Changes since the previous version

None (version 1).
