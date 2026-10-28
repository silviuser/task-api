const { registerUser, loginUser } = require("../services/auth-service");

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

function createAuthController(options = {}) {
  async function register(req, res, next) {
    try {
      const error = validateRegisterInput(req.body);
      if (error) {
        return res.status(400).json({ error });
      }
      const user = await registerUser(req.body, options);
      return res.location(`/users/${user.id}`).status(201).json(user);
    } catch (err) {
      if (err.code === "DUPLICATE_EMAIL") {
        return res.status(409).json({ error: err.message });
      }
      return next(err);
    }
  }

  async function login(req, res, next) {
    try {
      const error = validateLoginInput(req.body);
      if (error) {
        return res.status(400).json({ error });
      }
      const result = await loginUser(req.body, options);
      return res.status(200).json(result);
    } catch (err) {
      if (err.code === "INVALID_CREDENTIALS") {
        return res.status(401).json({ error: err.message });
      }
      return next(err);
    }
  }

  return { register, login };
}

module.exports = {
  createAuthController,
  validateRegisterInput,
  validateLoginInput,
};
