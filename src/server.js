const { createApp } = require("./app");

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = server;
