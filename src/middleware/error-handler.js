function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} does not exist` });
}

function errorHandler(err, req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message,
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
