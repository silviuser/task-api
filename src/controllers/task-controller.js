const taskService = require("../services/task-service");

const ALLOWED_STATUSES = ["todo", "in_progress", "done"];
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

function validateCreateTaskInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "title is required";
  }
  const { title, description, status } = body;
  if (typeof title !== "string" || title.trim() === "") {
    return "title is required";
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    return "title must not exceed 200 characters";
  }
  if (description !== undefined) {
    if (typeof description !== "string") {
      return "description must be a string";
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return "description must not exceed 1000 characters";
    }
  }
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return "status must be one of: todo, in_progress, done";
  }
  return null;
}

function validateUpdateTaskInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "at least one of title, description, or status is required";
  }
  const { title, description, status } = body;
  if (title === undefined && description === undefined && status === undefined) {
    return "at least one of title, description, or status is required";
  }
  if (title !== undefined && (typeof title !== "string" || title.trim() === "")) {
    return "title must be a non-empty string";
  }
  if (title !== undefined && title.trim().length > MAX_TITLE_LENGTH) {
    return "title must not exceed 200 characters";
  }
  if (description !== undefined && (typeof description !== "string" || description.length > MAX_DESCRIPTION_LENGTH)) {
    return typeof description !== "string" ? "description must be a string" : "description must not exceed 1000 characters";
  }
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return "status must be one of: todo, in_progress, done";
  }
  return null;
}

function createTaskController(options = {}) {
  async function create(req, res, next) {
    try {
      const error = validateCreateTaskInput(req.body);
      if (error) {
        return res.status(400).json({ error });
      }
      const task = await taskService.createTask(req.body, options);
      return res.location(`/tasks/${task.id}`).status(201).json(task);
    } catch (err) {
      return next(err);
    }
  }

  async function list(req, res, next) {
    try {
      const tasks = await taskService.listTasks(options);
      return res.status(200).json(tasks);
    } catch (err) {
      return next(err);
    }
  }

  async function getById(req, res, next) {
    try {
      const task = await taskService.getTaskById(req.params.id, options);
      return res.status(200).json(task);
    } catch (err) {
      if (err.code === "TASK_NOT_FOUND") {
        return res.status(404).json({ error: err.message });
      }
      return next(err);
    }
  }

  async function update(req, res, next) {
    try {
      const error = validateUpdateTaskInput(req.body);
      if (error) {
        return res.status(400).json({ error });
      }
      const task = await taskService.updateTask(req.params.id, req.body, options);
      return res.status(200).json(task);
    } catch (err) {
      if (err.code === "TASK_NOT_FOUND") {
        return res.status(404).json({ error: err.message });
      }
      return next(err);
    }
  }

  async function remove(req, res, next) {
    try {
      await taskService.deleteTask(req.params.id, options);
      return res.status(204).end();
    } catch (err) {
      if (err.code === "TASK_NOT_FOUND") {
        return res.status(404).json({ error: err.message });
      }
      return next(err);
    }
  }

  return { create, list, getById, update, remove };
}

module.exports = {
  createTaskController,
  validateCreateTaskInput,
  validateUpdateTaskInput,
  ALLOWED_STATUSES,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
};
