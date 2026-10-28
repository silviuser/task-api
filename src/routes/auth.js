const express = require("express");
const bcrypt = require("bcryptjs");
const { createUser } = require("../storage/user-store");

function validateRegisterInput(body) {
  const { email, password } = body ?? {};
  if (typeof email !== "string" || email.trim() === "") {
    return "email is required";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "invalid email format";
  }
  if (typeof password !== "string" || password.length === 0) {
    return "password is required";
  }
  if (password.length < 8) {
    return "password must be at least 8 characters long";
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    return "password must not exceed 72 bytes";
  }
  return null;
}

function createAuthRouter(options = {}) {
  const router = express.Router();

  router.post("/register", async (req, res, next) => {
    try {
      const error = validateRegisterInput(req.body);
      if (error) {
        return res.status(400).json({ error });
      }

      // bcrypt only uses up to 72 bytes; cost factor 10 per SEC-1
      const passwordHash = await bcrypt.hash(req.body.password, 10);
      const user = await createUser({ email: req.body.email.trim(), passwordHash }, options);

      return res.location(`/users/${user.id}`).status(201).json(user);
    } catch (err) {
      if (err.code === "DUPLICATE_EMAIL") {
        return res.status(409).json({ error: err.message });
      }
      return next(err);
    }
  });

  return router;
}

module.exports = {
  createAuthRouter,
  validateRegisterInput,
};
