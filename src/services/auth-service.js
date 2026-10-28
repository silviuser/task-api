const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createUser, findUserByEmail } = require("../storage/user-store");

// Precomputed cost-10 bcrypt hash used when email is not found to prevent timing enumeration (SEC-2).
const DUMMY_PASSWORD_HASH = "$2b$10$H59/MKXi10CBrp8brax7duDggewgxngBn52fc7imdDRuVx1J4myBK";

async function registerUser({ email, password }, options = {}) {
  // bcrypt only uses up to 72 bytes; cost factor 10 per SEC-1
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    return await createUser({ email: email.trim(), passwordHash }, options);
  } catch (err) {
    if (err.code === "DUPLICATE_EMAIL") {
      err.status = 409;
    }
    throw err;
  }
}

async function loginUser({ email, password }, options = {}) {
  const user = await findUserByEmail(email, options);
  const targetHash = user ? user.passwordHash : DUMMY_PASSWORD_HASH;
  const matches = await bcrypt.compare(password, targetHash);
  // Same message for an unknown e-mail and a wrong password: the response must not reveal which accounts exist (SEC-2).
  if (!user || !matches) {
    const err = new Error("Invalid email or password");
    err.code = "INVALID_CREDENTIALS";
    err.status = 401;
    throw err;
  }
  const token = jwt.sign({ sub: user.id, email: user.email }, options.jwtSecret, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
  return { token };
}

module.exports = {
  registerUser,
  loginUser,
};
