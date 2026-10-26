require('dotenv').config();
const http = require('http');
const app = require('./app');
const sequelize = require('./config/database');
const { initSocket } = require('./config/socket');
const { initSlotNotificationCron } = require('./services/slotNotificationCron');
const { initReengagementCron } = require('./services/reengagementCron');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const startServer = async () => {
  try {
    // Test the database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Sync database (optional: use with caution in production)
    // await sequelize.sync({ alter: true });

    // Initialize Socket.io
    initSocket(server);

    // Initialize Cron Jobs
    initSlotNotificationCron();
    initReengagementCron();

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Swagger Docs available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();
