const taskStore = require("../storage/task-store");

function createTaskNotFoundError() {
  const err = new Error("Task not found");
  err.code = "TASK_NOT_FOUND";
  return err;
}

function createTaskForbiddenError() {
  const err = new Error("Forbidden");
  err.code = "TASK_FORBIDDEN";
  return err;
}

async function createTask(data, options = {}) {
  return taskStore.createTask(
    {
      title: data.title.trim(),
      description: data.description ?? "",
      status: data.status ?? "todo",
      userId: data.userId,
    },
    options,
  );
}

async function listTasks(userId, options = {}) {
  if (typeof userId === "object" && userId !== null) {
    return taskStore.listTasks(userId);
  }
  return taskStore.listTasks({ ...options, userId });
}

async function getTaskById(id, userId, options = {}) {
  if (typeof userId === "object" && userId !== null) {
    options = userId;
    userId = undefined;
  }
  const task = await taskStore.getTaskById(id, options);
  if (!task) {
    throw createTaskNotFoundError();
  }
  if (task.userId !== userId) {
    throw createTaskForbiddenError();
  }
  return task;
}

async function updateTask(id, updates, userId, options = {}) {
  if (typeof userId === "object" && userId !== null) {
    options = userId;
    userId = undefined;
  }
  await getTaskById(id, userId, options);
  const patch = {};
  if (updates.title !== undefined) {
    patch.title = updates.title.trim();
  }
  if (updates.description !== undefined) {
    patch.description = updates.description;
  }
  if (updates.status !== undefined) {
    patch.status = updates.status;
  }
  const task = await taskStore.updateTask(id, patch, options);
  if (!task) {
    throw createTaskNotFoundError();
  }
  return task;
}

async function deleteTask(id, userId, options = {}) {
  if (typeof userId === "object" && userId !== null) {
    options = userId;
    userId = undefined;
  }
  await getTaskById(id, userId, options);
  const deleted = await taskStore.deleteTask(id, options);
  if (!deleted) {
    throw createTaskNotFoundError();
  }
}

module.exports = {
  createTask,
  listTasks,
  getTaskById,
  updateTask,
  deleteTask,
};
