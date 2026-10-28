const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

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

async function readUsers(options = {}) {
  const filePath = resolveFilePath(options);
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

async function createUser({ email, passwordHash }, options = {}) {
  const filePath = resolveFilePath(options);

  return serialize(async () => {
    const users = await readUsers(filePath);
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

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(users, null, 2), "utf8");
    await fs.rename(tmp, filePath);

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    };
  });
}

module.exports = {
  createUser,
  readUsers,
};
