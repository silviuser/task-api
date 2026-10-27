const express = require("express");
const { createRequestLogger } = require("./middleware/request-logger");
const { notFoundHandler, errorHandler } = require("./middleware/error-handler");
const healthRouter = require("./routes/health");

function createApp(options = {}) {
  const app = express();

  app.use(createRequestLogger(options.logger));
  app.use(express.json());

  app.use("/health", healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};
