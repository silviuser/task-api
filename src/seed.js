const path = require("node:path");
const bcrypt = require("bcryptjs");
const { faker } = require("@faker-js/faker");
const userStore = require("./storage/user-store");
const taskStore = require("./storage/task-store");
const taskService = require("./services/task-service");

const DEFAULT_USER_COUNT = 5;
const DEFAULT_TASK_COUNT = 15;
const DEFAULT_FAKER_SEED = 42;
const DEFAULT_SEED_PASSWORD = "Password123!";
const TASK_STATUSES = ["todo", "in_progress", "done"];
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

function generateUniqueEmail(usedEmails) {
  let email;
  do {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    email = faker.internet.email({ firstName, lastName }).toLowerCase();
  } while (usedEmails.has(email));
  usedEmails.add(email);
  return email;
}

async function seedData(options = {}) {
  const dataFile = options.dataFile ?? process.env.DATA_FILE ?? path.resolve("data/seed-users.json");
  const tasksFile = options.tasksFile ?? process.env.TASKS_FILE ?? path.resolve("data/seed-tasks.json");
  const userCount = options.userCount ?? DEFAULT_USER_COUNT;
  const taskCount = options.taskCount ?? DEFAULT_TASK_COUNT;
  const password = options.password ?? DEFAULT_SEED_PASSWORD;

  faker.seed(options.seed ?? DEFAULT_FAKER_SEED);
  await Promise.all([userStore.resetUsers({ dataFile }), taskStore.resetTasks({ tasksFile })]);

  // Pre-hash the shared seed password with cost 10 so every seeded user can log in via /auth/login (SEC-1).
  const passwordHash = await bcrypt.hash(password, 10);
  const usedEmails = new Set();
  const users = [];
  for (let i = 0; i < userCount; i += 1) {
    const email = generateUniqueEmail(usedEmails);
    users.push(await userStore.createUser({ email, passwordHash }, { dataFile }));
  }

  const tasks = [];
  for (let i = 0; i < taskCount; i += 1) {
    const title = faker.hacker.phrase().slice(0, MAX_TITLE_LENGTH);
    const description = faker.lorem.sentence().slice(0, MAX_DESCRIPTION_LENGTH);
    const status = TASK_STATUSES[i % TASK_STATUSES.length];
    const userId = users.length > 0 ? users[i % users.length].id : undefined;
    tasks.push(await taskService.createTask({ title, description, status, userId }, { tasksFile }));
  }

  return { users, tasks, dataFile, tasksFile };
}

if (require.main === module) {
  seedData()
    .then(({ users, tasks, dataFile, tasksFile }) => {
      // Never include passwords or password hashes in logs (SEC-10).
      console.log(`Seeded ${users.length} users (${dataFile}) and ${tasks.length} tasks (${tasksFile})`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  seedData,
  DEFAULT_SEED_PASSWORD,
};
