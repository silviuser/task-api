const express = require("express");
const { createTaskController } = require("../controllers/task-controller");

function createTasksRouter(options = {}) {
  const router = express.Router();
  const { create, list, getById, update, remove } = createTaskController(options);

  router.post("/", create);
  router.get("/", list);
  router.get("/:id", getById);
  router.patch("/:id", update);
  router.delete("/:id", remove);

  return router;
}

module.exports = {
  createTasksRouter,
};
