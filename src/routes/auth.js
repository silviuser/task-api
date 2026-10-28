const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createUser, findUserByEmail } = require("../storage/user-store");

// Precomputed cost-10 bcrypt hash used when email is not found to prevent timing enumeration (SEC-2).
const DUMMY_PASSWORD_HASH = "$2b$10$H59/MKXi10CBrp8brax7duDggewgxngBn52fc7imdDRuVx1J4myBK";

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

function validateLoginInput(body) {
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

  router.post("/login", async (req, res, next) => {
    try {
      const error = validateLoginInput(req.body);
      if (error) {
        return res.status(400).json({ error });
      }
      const user = await findUserByEmail(req.body.email, options);
      const targetHash = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
      const matches = await bcrypt.compare(req.body.password, targetHash);
      // Same message for an unknown e-mail and a wrong password: the response must not reveal which accounts exist (SEC-2).
      if (!user || !matches) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      const token = jwt.sign({ sub: user.id, email: user.email }, options.jwtSecret, {
        algorithm: "HS256",
        expiresIn: "1h",
      });
      return res.status(200).json({ token });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = {
  createAuthRouter,
  validateRegisterInput,
  validateLoginInput,
};
