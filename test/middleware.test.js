const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const express = require("express");
const { createApp } = require("../src/app");
const { errorHandler } = require("../src/middleware/error-handler");

let server;
let baseUrl;
const logs = [];

before(async () => {
  server = createApp({ logger: (msg) => logs.push(msg) }).listen(0);
  await once(server, "listening");
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server.close());

test("request logger records method, URL, status code, and duration", async () => {
  logs.length = 0;
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  await res.json();

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(logs.length, 1);
  assert.match(logs[0], /^GET \/health 200 \d+ms$/);
});

test("unregistered route returns HTTP 404 with standard error format", async () => {
  const res = await fetch(`${baseUrl}/unknown`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.deepEqual(body, { error: "Route GET /unknown does not exist" });
});

test("malformed JSON body returns HTTP 400 with standard error format", async () => {
  const res = await fetch(`${baseUrl}/health`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: "invalid-json{",
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(typeof body.error === "string");
  assert.ok(body.error.length > 0);
  assert.equal(body.stack, undefined);
});

test("unhandled route error returns HTTP 500 with no stack trace", async () => {
  const errorApp = express();
  errorApp.get("/boom", () => {
    throw new Error("unhandled database failure");
  });
  errorApp.use(errorHandler);

  const errorServer = errorApp.listen(0);
  await once(errorServer, "listening");
  const errorUrl = `http://localhost:${errorServer.address().port}`;

  const originalConsoleError = console.error;
  let loggedError = null;
  console.error = (err) => {
    loggedError = err;
  };

  try {
    const res = await fetch(`${errorUrl}/boom`);
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.deepEqual(body, { error: "Internal server error" });
    assert.equal(body.stack, undefined);
    assert.ok(loggedError instanceof Error);
    assert.equal(loggedError.message, "unhandled database failure");
  } finally {
    console.error = originalConsoleError;
    errorServer.close();
  }
});
