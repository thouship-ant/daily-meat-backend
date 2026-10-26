require('dotenv').config();
const sequelize = require('../config/database');
const { User } = require('../models');
const bcrypt = require('bcrypt');

async function setupAdmin() {
  try {
    await sequelize.authenticate();
    console.log('Database connection OK.');

    const adminPhone = '+919876543210';
    const rawPassword = '123456';
    
    // Check if user already exists
    const existingAdmin = await User.findOne({ where: { phone: adminPhone } });
    if (existingAdmin) {
      console.log('An account with this phone number already exists.');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await User.create({
      phone: adminPhone,
      password: hashedPassword,
      name: 'Super Admin',
      role: 'ADMIN',
      is_profile_completed: true
    });

    console.log('Successfully created initial Admin account!');
    console.log(`Phone: ${adminPhone}`);
    console.log(`Password: ${rawPassword}`);
    console.log('You can now log in using POST /api/auth/login-with-password');

    process.exit(0);
  } catch (error) {
    console.error('Failed to setup admin account:', error);
    process.exit(1);
  }
}

setupAdmin();
