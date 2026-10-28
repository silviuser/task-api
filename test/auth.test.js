const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createApp } = require("../src/app");
const { readUsers, findUserByEmail } = require("../src/storage/user-store");
const { registerUser, loginUser } = require("../src/services/auth-service");
const {
  createAuthController,
  validateRegisterInput,
  validateLoginInput,
} = require("../src/controllers/auth-controller");
const { getHealth } = require("../src/controllers/health-controller");

const TEST_JWT_SECRET = "test-jwt-secret";

let server;
let baseUrl;
let tempDir;
let dataFile;

before(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "task-api-auth-test-"));
  dataFile = path.join(tempDir, "users.json");

  server = createApp({
    logger: () => {},
    dataFile,
    jwtSecret: TEST_JWT_SECRET,
  }).listen(0);

  await once(server, "listening");
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  if (server) {
    server.close();
  }
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("POST /auth/register with valid input returns 201, Location header, and user without secrets", async () => {
  const payload = {
    email: "user1@example.com",
    password: "Password123!",
  };

  const res = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const body = await res.json();

  assert.ok(typeof body.id === "string" && body.id.length > 0);
  assert.equal(body.email, "user1@example.com");
  assert.ok(typeof body.createdAt === "string");
  assert.equal(body.password, undefined);
  assert.equal(body.passwordHash, undefined);
  assert.equal(res.headers.get("Location"), `/users/${body.id}`);
});

test("POST /auth/register with missing, blank, or invalid email format returns 400", async () => {
  const cases = [
    { payload: { password: "Password123!" }, expected: "email is required" },
    { payload: { email: "", password: "Password123!" }, expected: "email is required" },
    { payload: { email: "   ", password: "Password123!" }, expected: "email is required" },
    { payload: { email: "invalid-email", password: "Password123!" }, expected: "invalid email format" },
    { payload: { email: "user@domain", password: "Password123!" }, expected: "invalid email format" },
  ];

  for (const { payload, expected } of cases) {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body, { error: expected });
  }
});

test("POST /auth/register with password shorter than 8 characters returns 400", async () => {
  const cases = [
    { payload: { email: "short@example.com" }, expected: "password is required" },
    { payload: { email: "short@example.com", password: "" }, expected: "password is required" },
    { payload: { email: "short@example.com", password: "1234567" }, expected: "password must be at least 8 characters long" },
  ];

  for (const { payload, expected } of cases) {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body, { error: expected });
  }
});

test("POST /auth/register with password longer than 72 bytes returns 400", async () => {
  const longAsciiPassword = "a".repeat(73);
  const resAscii = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "toolong1@example.com", password: longAsciiPassword }),
  });

  assert.equal(resAscii.status, 400);
  const bodyAscii = await resAscii.json();
  assert.deepEqual(bodyAscii, { error: "password must not exceed 72 bytes" });

  // 37 2-byte characters = 74 bytes (string length is 37, but byte length is 74)
  const longUtf8Password = "é".repeat(37);
  const resUtf8 = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "toolong2@example.com", password: longUtf8Password }),
  });

  assert.equal(resUtf8.status, 400);
  const bodyUtf8 = await resUtf8.json();
  assert.deepEqual(bodyUtf8, { error: "password must not exceed 72 bytes" });
});

test("POST /auth/register with duplicate email returns 409 Conflict", async () => {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user1@example.com", password: "AnotherPassword123!" }),
  });

  assert.equal(res.status, 409);
  const body = await res.json();
  assert.deepEqual(body, { error: "Email already registered" });
});

test("POST /auth/register duplicate email check is case-insensitive", async () => {
  const res = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "USER1@EXAMPLE.COM", password: "AnotherPassword123!" }),
  });

  assert.equal(res.status, 409);
  const body = await res.json();
  assert.deepEqual(body, { error: "Email already registered" });
});

test("User record stored in file has bcrypt hash cost 10 and no plain text password", async () => {
  const users = await readUsers(dataFile);
  const user = users.find((u) => u.email === "user1@example.com");

  assert.ok(user);
  assert.equal(user.email, "user1@example.com");
  assert.equal(user.password, undefined);
  assert.ok(typeof user.passwordHash === "string");
  // bcrypt hashes with cost factor 10 start with $2a$10$ or $2b$10$
  assert.match(user.passwordHash, /^\$2[ab]\$10\$/);

  const passwordMatches = await bcrypt.compare("Password123!", user.passwordHash);
  assert.equal(passwordMatches, true);
});

test("Concurrent registration requests for same email serialize safely (one 201, one 409)", async () => {
  const email = "concurrent@example.com";
  const password = "Password123!";

  const [res1, res2] = await Promise.all([
    fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  ]);

  const statuses = [res1.status, res2.status].sort();
  assert.deepEqual(statuses, [201, 409]);

  const users = await readUsers(dataFile);
  const matching = users.filter((u) => u.email === email);
  assert.equal(matching.length, 1);
});

test("POST /auth/login with valid credentials (and uppercase email) returns 200 and a valid HS256 JWT with sub, email, and 1h expiry", async () => {
  const users = await readUsers(dataFile);
  const expectedUser = users.find((u) => u.email === "user1@example.com");
  assert.ok(expectedUser);

  for (const loginEmail of ["user1@example.com", "  USER1@EXAMPLE.COM  "]) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: "Password123!" }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body), ["token"]);
    assert.ok(typeof body.token === "string" && body.token.length > 0);

    const decoded = jwt.verify(body.token, TEST_JWT_SECRET, {
      algorithms: ["HS256"],
      complete: true,
    });

    assert.equal(decoded.header.alg, "HS256");
    assert.equal(decoded.payload.sub, expectedUser.id);
    assert.equal(decoded.payload.email, "user1@example.com");
    assert.equal(typeof decoded.payload.iat, "number");
    assert.equal(typeof decoded.payload.exp, "number");
    assert.equal(decoded.payload.exp - decoded.payload.iat, 3600);
    assert.equal(decoded.payload.password, undefined);
    assert.equal(decoded.payload.passwordHash, undefined);
  }
});

test("POST /auth/login with missing, blank, or invalid email format returns 400", async () => {
  const cases = [
    { payload: { password: "Password123!" }, expected: "email is required" },
    { payload: { email: "", password: "Password123!" }, expected: "email is required" },
    { payload: { email: "   ", password: "Password123!" }, expected: "email is required" },
    { payload: { email: 123, password: "Password123!" }, expected: "email is required" },
    { payload: { email: "invalid-email", password: "Password123!" }, expected: "invalid email format" },
    { payload: { email: "user@domain", password: "Password123!" }, expected: "invalid email format" },
  ];

  for (const { payload, expected } of cases) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body, { error: expected });
  }
});

test("POST /auth/login with missing, empty, non-string, or >72-byte password returns 400", async () => {
  const cases = [
    { payload: { email: "user1@example.com" }, expected: "password is required" },
    { payload: { email: "user1@example.com", password: "" }, expected: "password is required" },
    { payload: { email: "user1@example.com", password: 12345 }, expected: "password is required" },
    { payload: { email: "user1@example.com", password: "a".repeat(73) }, expected: "password must not exceed 72 bytes" },
    { payload: { email: "user1@example.com", password: "é".repeat(37) }, expected: "password must not exceed 72 bytes" },
  ];

  for (const { payload, expected } of cases) {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.deepEqual(body, { error: expected });
  }
});

test("POST /auth/login with wrong password returns 401 Invalid email or password", async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user1@example.com", password: "WrongPassword!" }),
  });

  assert.equal(res.status, 401);
  const body = await res.json();
  assert.deepEqual(body, { error: "Invalid email or password" });
});

test("POST /auth/login with unregistered email returns 401 with identical error message", async () => {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "unknown@example.com", password: "Password123!" }),
  });

  assert.equal(res.status, 401);
  const body = await res.json();
  assert.deepEqual(body, { error: "Invalid email or password" });
});

test("findUserByEmail returns matching user (with passwordHash) case-insensitively and null when unknown", async () => {
  const found = await findUserByEmail("  USER1@Example.com ", { dataFile });
  assert.ok(found);
  assert.equal(found.email, "user1@example.com");
  assert.ok(typeof found.id === "string" && found.id.length > 0);
  assert.ok(typeof found.passwordHash === "string" && found.passwordHash.startsWith("$2"));
  assert.ok(typeof found.createdAt === "string");

  // Mutating returned object does not mutate underlying data
  found.email = "mutated@example.com";
  const foundAgain = await findUserByEmail("user1@example.com", { dataFile });
  assert.equal(foundAgain.email, "user1@example.com");

  const missing = await findUserByEmail("nobody@example.com", { dataFile });
  assert.equal(missing, null);
});

test("createApp throws when JWT_SECRET is missing or blank", () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  try {
    assert.throws(() => createApp({ logger: () => {} }), {
      message: "JWT_SECRET is required",
    });
    assert.throws(() => createApp({ logger: () => {}, jwtSecret: "" }), {
      message: "JWT_SECRET is required",
    });
    assert.throws(() => createApp({ logger: () => {}, jwtSecret: "   " }), {
      message: "JWT_SECRET is required",
    });
  } finally {
    if (originalJwtSecret !== undefined) {
      process.env.JWT_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  }
});

function createFakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    location(url) {
      this.headers.location = url;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("auth-service registerUser stores a bcrypt hash and returns the user without secrets", async () => {
  const user = await registerUser({ email: " service1@example.com ", password: "Password123!" }, { dataFile });

  assert.ok(typeof user.id === "string" && user.id.length > 0);
  assert.equal(user.email, "service1@example.com");
  assert.ok(typeof user.createdAt === "string");
  assert.equal(user.passwordHash, undefined);

  const stored = await findUserByEmail("service1@example.com", { dataFile });
  assert.equal(bcrypt.getRounds(stored.passwordHash), 10);
  assert.ok(await bcrypt.compare("Password123!", stored.passwordHash));
});

test("auth-service registerUser with an e-mail already registered throws DUPLICATE_EMAIL without status", async () => {
  await registerUser({ email: "service2@example.com", password: "Password123!" }, { dataFile });

  await assert.rejects(
    registerUser({ email: "SERVICE2@example.com", password: "Password123!" }, { dataFile }),
    (err) => {
      assert.equal(err.code, "DUPLICATE_EMAIL");
      assert.equal(err.message, "Email already registered");
      assert.equal(err.status, undefined);
      return true;
    },
  );
});

test("auth-service loginUser with valid credentials returns an HS256 JWT with sub and email", async () => {
  const user = await registerUser({ email: "service3@example.com", password: "Password123!" }, { dataFile });

  const { token } = await loginUser(
    { email: "service3@example.com", password: "Password123!" },
    { dataFile, jwtSecret: TEST_JWT_SECRET },
  );

  const payload = jwt.verify(token, TEST_JWT_SECRET, { algorithms: ["HS256"] });
  assert.equal(payload.sub, user.id);
  assert.equal(payload.email, "service3@example.com");
  assert.equal(payload.exp - payload.iat, 3600);
});

test("auth-service loginUser with a wrong password or unknown e-mail throws INVALID_CREDENTIALS without status", async () => {
  await registerUser({ email: "service4@example.com", password: "Password123!" }, { dataFile });
  const options = { dataFile, jwtSecret: TEST_JWT_SECRET };
  const checkError = (err) => {
    assert.equal(err.code, "INVALID_CREDENTIALS");
    assert.equal(err.message, "Invalid email or password");
    assert.equal(err.status, undefined);
    return true;
  };

  await assert.rejects(loginUser({ email: "service4@example.com", password: "WrongPassword!" }, options), checkError);
  await assert.rejects(loginUser({ email: "nobody@example.com", password: "Password123!" }, options), checkError);
});

test("auth-controller validators return null for valid input and an error message for invalid input", () => {
  assert.equal(validateRegisterInput({ email: "a@example.com", password: "Password123!" }), null);
  assert.equal(validateRegisterInput({ email: "a@example.com", password: "short" }), "password must be at least 8 characters long");
  assert.equal(validateLoginInput({ email: "a@example.com", password: "x" }), null);
  assert.equal(validateLoginInput(undefined), "email is required");
});

test("auth-controller register returns 400 for invalid input and 201 with Location for a new user", async () => {
  const { register } = createAuthController({ dataFile });

  const invalidRes = createFakeResponse();
  await register({ body: { email: "invalid-email", password: "Password123!" } }, invalidRes, assert.fail);
  assert.equal(invalidRes.statusCode, 400);
  assert.deepEqual(invalidRes.body, { error: "invalid email format" });

  const res = createFakeResponse();
  await register({ body: { email: "controller1@example.com", password: "Password123!" } }, res, assert.fail);
  assert.equal(res.statusCode, 201);
  assert.equal(res.headers.location, `/users/${res.body.id}`);
  assert.equal(res.body.email, "controller1@example.com");
  assert.equal(res.body.passwordHash, undefined);
});

test("auth-controller login returns 401 for invalid credentials and forwards unexpected errors to next", async () => {
  await registerUser({ email: "controller2@example.com", password: "Password123!" }, { dataFile });

  const { login } = createAuthController({ dataFile, jwtSecret: TEST_JWT_SECRET });
  const res = createFakeResponse();
  await login({ body: { email: "controller2@example.com", password: "WrongPassword!" } }, res, assert.fail);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Invalid email or password" });

  // Without a JWT secret, signing fails with an unexpected error that must reach the error handler.
  const { login: loginWithoutSecret } = createAuthController({ dataFile });
  let forwarded;
  await loginWithoutSecret(
    { body: { email: "controller2@example.com", password: "Password123!" } },
    createFakeResponse(),
    (err) => {
      forwarded = err;
    },
  );
  assert.ok(forwarded instanceof Error);
  assert.equal(forwarded.code, undefined);
});

test("health-controller getHealth responds with status ok", () => {
  const res = createFakeResponse();
  getHealth({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { status: "ok" });
});
