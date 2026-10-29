const jwt = require("jsonwebtoken");

function createAuthenticate(options = {}) {
  return function authenticate(req, res, next) {
    const header = req.headers.authorization;
    const match = typeof header === "string" ? /^Bearer (\S+)$/.exec(header) : null;
    if (!match) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      // Pin allowed algorithm to HS256 to prevent algorithm-confusion attacks (SEC-3).
      const payload = jwt.verify(match[1], options.jwtSecret, { algorithms: ["HS256"] });
      if (!payload || typeof payload !== "object" || typeof payload.sub !== "string" || payload.sub.trim() === "") {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      req.user = { sub: payload.sub, email: payload.email };
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

module.exports = {
  createAuthenticate,
};
