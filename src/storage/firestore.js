const { initializeApp, getApps, applicationDefault } = require("firebase-admin/app");
const { getFirestore, initializeFirestore } = require("firebase-admin/firestore");

const dbCache = new Map();

function isFirestoreEnabled(options = {}, fileKey) {
  if (typeof options === "string" || Boolean(options?.[fileKey])) {
    return false;
  }
  return Boolean(
    options?.useFirestore ||
      options?.projectId ||
      process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

function getDb(options = {}) {
  const projectId =
    options?.projectId ??
    process.env.GCLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT_ID ??
    "task-api";
  if (dbCache.has(projectId)) {
    return dbCache.get(projectId);
  }
  const existing = getApps().find((app) => app.name === projectId);
  const app =
    existing ??
    initializeApp(
      process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST
        ? { credential: applicationDefault(), projectId }
        : { projectId },
      projectId,
    );
  const db = existing ? getFirestore(existing) : initializeFirestore(app, { preferRest: true });
  if (!existing && process.env.FIRESTORE_EMULATOR_HOST) {
    db.settings({
      authClient: {
        getRequestHeaders: async () => ({ Authorization: "Bearer owner" }),
        fetch: (url, init) => fetch(url, init),
      },
    });
  }
  dbCache.set(projectId, db);
  return db;
}

module.exports = {
  getDb,
  isFirestoreEnabled,
};
