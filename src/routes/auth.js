const express = require("express");
const { createAuthController } = require("../controllers/auth-controller");

function createAuthRouter(options = {}) {
  const router = express.Router();
  const { register, login } = createAuthController(options);

  router.post("/register", register);
  router.post("/login", login);

  return router;
}

module.exports = {
  createAuthRouter,
};
