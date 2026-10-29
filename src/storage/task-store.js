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
  return options.tasksFile ?? process.env.TASKS_FILE ?? path.resolve("data/tasks.json");
}

async function readTasks(filePath) {
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

async function writeTasks(filePath, tasks) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(tasks, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

async function resetTasks(options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    await writeTasks(filePath, []);
  });
}

async function createTask({ title, description, status, userId }, options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    const tasks = await readTasks(filePath);
    const now = new Date().toISOString();
    const task = {
      id: crypto.randomUUID(),
      ...(userId !== undefined ? { userId } : {}),
      title,
      description,
      status,
      createdAt: now,
      updatedAt: now,
    };
    tasks.push(task);
    await writeTasks(filePath, tasks);
    return { ...task };
  });
}

async function listTasks(options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    const tasks = await readTasks(filePath);
    const filtered =
      options && typeof options === "object" && options.userId !== undefined
        ? tasks.filter((t) => t.userId === String(options.userId))
        : tasks;
    return filtered.map((t) => ({ ...t }));
  });
}

async function getTaskById(id, options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    const tasks = await readTasks(filePath);
    const task = tasks.find((t) => t.id === String(id));
    return task ? { ...task } : null;
  });
}

async function updateTask(id, updates, options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    const tasks = await readTasks(filePath);
    const index = tasks.findIndex((t) => t.id === String(id));
    if (index === -1) return null;
    const updated = { ...tasks[index], ...updates, updatedAt: new Date().toISOString() };
    tasks[index] = updated;
    await writeTasks(filePath, tasks);
    return { ...updated };
  });
}

async function deleteTask(id, options = {}) {
  const filePath = resolveFilePath(options);
  return serialize(async () => {
    const tasks = await readTasks(filePath);
    const index = tasks.findIndex((t) => t.id === String(id));
    if (index === -1) return false;
    tasks.splice(index, 1);
    await writeTasks(filePath, tasks);
    return true;
  });
}

module.exports = {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  deleteTask,
  resetTasks,
};
