require('dotenv').config();
const sequelize = require('../config/database');
const { User } = require('../models');
const notificationService = require('../services/notificationService');

async function testPush() {
  try {
    await sequelize.authenticate();
    
    const phone = process.argv[2];
    if (!phone) {
      console.log('\x1b[31m%s\x1b[0m', 'Error: Please provide a phone number as an argument.');
      console.log('Example: node src/scripts/testPush.js +919999999999');
      process.exit(1);
    }
    
    const user = await User.findOne({ where: { phone } });
    if (!user) {
      console.log('\x1b[31m%s\x1b[0m', 'Error: User not found with that phone number.');
      process.exit(1);
    }

    if (!user.push_token) {
      console.log('\x1b[33m%s\x1b[0m', 'Warning: User found, but has no push_token saved.');
      console.log('Make sure you have logged into the app on a physical device at least once to register the push token.');
      process.exit(1);
    }

    console.log('\x1b[32m%s\x1b[0m', `Found push token: ${user.push_token}`);
    console.log('Sending test push notification...');

    await notificationService.notifyUser({
      userId: user.id,
      title: 'Local Test Notification',
      body: 'This is a test notification triggered from the backend script!',
      data: { test: true }
    });

    console.log('\x1b[32m%s\x1b[0m', 'Push notification sent to Expo servers successfully!');
    
    // Give Expo SDK a moment to finish any background HTTP requests
    setTimeout(() => {
      process.exit(0);
    }, 1000);
    
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to send notification:');
    console.error(err);
    process.exit(1);
  }
}

testPush();
