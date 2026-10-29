const express = require("express");
const { createRequestLogger } = require("./middleware/request-logger");
const { notFoundHandler, errorHandler } = require("./middleware/error-handler");
const healthRouter = require("./routes/health");
const { createAuthRouter } = require("./routes/auth");
const { createTasksRouter } = require("./routes/tasks");

function createApp(options = {}) {
  const jwtSecret = options.jwtSecret ?? process.env.JWT_SECRET;
  if (typeof jwtSecret !== "string" || jwtSecret.trim() === "") {
    throw new Error("JWT_SECRET is required");
  }

  const app = express();

  app.use(createRequestLogger(options.logger));
  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/auth", createAuthRouter({ ...options, jwtSecret }));
  app.use("/tasks", createTasksRouter(options));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
