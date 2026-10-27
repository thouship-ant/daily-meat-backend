require('dotenv').config();
const sequelize = require('../config/database');
const { User } = require('../models');

// Logs every ADMIN out of all devices: access tokens issued before now are rejected,
// refresh tokens are cleared, and admin push tokens are removed so logged-out devices stop receiving alerts.
async function logoutAdmins() {
  try {
    await sequelize.authenticate();

    // Column is new; add it without needing a full db:sync
    await sequelize.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMP WITH TIME ZONE');

    const [affected] = await User.update(
      { tokens_valid_after: new Date(), refresh_token: null, push_token: null },
      { where: { role: 'ADMIN' } }
    );

    console.log(`Logged out ${affected} admin account(s) from all devices.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to log out admins:', error);
    process.exit(1);
  }
}

logoutAdmins();
