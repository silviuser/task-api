const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp } = require("../src/app");

let server;
let baseUrl;

before(async () => {
  server = createApp({ logger: () => {}, jwtSecret: "test-jwt-secret" }).listen(0);
  await once(server, "listening");
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server.close());

test("server starts and listens on dynamically assigned port", () => {
  const address = server.address();
  assert.ok(address);
  assert.equal(typeof address.port, "number");
  assert.ok(address.port > 0);
});

test("GET /health returns HTTP 200 with status ok", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, { status: "ok" });
});
