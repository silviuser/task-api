function createRequestLogger(log = console.log) {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      log(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
  };
}

module.exports = {
  createRequestLogger,
};
