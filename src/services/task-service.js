const taskStore = require("../storage/task-store");

function createTaskNotFoundError() {
  const err = new Error("Task not found");
  err.code = "TASK_NOT_FOUND";
  return err;
}

async function createTask(data, options = {}) {
  return taskStore.createTask(
    {
      title: data.title.trim(),
      description: data.description ?? "",
      status: data.status ?? "todo",
    },
    options,
  );
}

async function listTasks(options = {}) {
  return taskStore.listTasks(options);
}

async function getTaskById(id, options = {}) {
  const task = await taskStore.getTaskById(id, options);
  if (!task) {
    throw createTaskNotFoundError();
  }
  return task;
}

async function updateTask(id, updates, options = {}) {
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

async function deleteTask(id, options = {}) {
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
