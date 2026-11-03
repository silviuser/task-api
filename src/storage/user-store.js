const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { getDb, isFirestoreEnabled } = require("./firestore");

let queue = Promise.resolve();

function serialize(task) {
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

function resolveFilePath(options = {}) {
  if (typeof options === "string") {
    return path.resolve(options);
  }
  return options.dataFile ?? process.env.DATA_FILE ?? path.resolve("data/users.json");
}

function getUsersCollection(options = {}) {
  return getDb(options).collection(options?.usersCollection ?? "users");
}

async function readUsersFromFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function readUsers(options = {}) {
  if (isFirestoreEnabled(options, "dataFile")) {
    const snap = await getUsersCollection(options).get();
    return snap.docs.map((doc) => ({ ...doc.data() }));
  }
  return readUsersFromFile(resolveFilePath(options));
}

async function writeUsers(filePath, users) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

async function resetUsers(options = {}) {
  if (isFirestoreEnabled(options, "dataFile")) {
    const db = getDb(options);
    const snap = await getUsersCollection(options).get();
    if (snap.empty) {
      return;
    }
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    return;
  }
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    await writeUsers(filePath, []);
  });
}

async function createUserInFirestore({ email, passwordHash }, options = {}) {
  const db = getDb(options);
  const col = getUsersCollection(options);
  const normalized = email.trim().toLowerCase();
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(col.where("email", "==", normalized).limit(1));
    if (!existing.empty) {
      const err = new Error("Email already registered");
      err.code = "DUPLICATE_EMAIL";
      throw err;
    }
    const user = {
      id: crypto.randomUUID(),
      email: normalized,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    tx.set(col.doc(user.id), user);
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  });
}

async function createUser({ email, passwordHash }, options = {}) {
  if (isFirestoreEnabled(options, "dataFile")) {
    return createUserInFirestore({ email, passwordHash }, options);
  }
  const filePath = resolveFilePath(options);

  return serialize(async () => {
    const users = await readUsersFromFile(filePath);
    const normalized = email.trim().toLowerCase();

    if (users.some((u) => u.email.toLowerCase() === normalized)) {
      const err = new Error("Email already registered");
      err.code = "DUPLICATE_EMAIL";
      throw err;
    }

    const user = {
      id: crypto.randomUUID(),
      email: normalized,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    await writeUsers(filePath, users);

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  });
}

async function findUserByEmail(email, options = {}) {
  if (isFirestoreEnabled(options, "dataFile")) {
    const normalized = String(email).trim().toLowerCase();
    const snap = await getUsersCollection(options).where("email", "==", normalized).limit(1).get();
    return snap.empty ? null : { ...snap.docs[0].data() };
  }
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    const users = await readUsersFromFile(filePath);
    const normalized = String(email).trim().toLowerCase();
    const user = users.find((u) => u.email.toLowerCase() === normalized);
    return user ? { ...user } : null;
  });
}

module.exports = {
  createUser,
  findUserByEmail,
  readUsers,
  resetUsers,
};
