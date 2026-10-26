const { sequelize } = require('../models');

const syncDatabase = async () => {
  try {
    console.log('Authenticating database connection...');
    await sequelize.authenticate();
    
    console.log('Syncing database...');
    // { alter: true } checks the current state of the database and performs the necessary changes to match the models.
    await sequelize.sync({ alter: true });
    
    console.log('Database synced successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing database:', error);
    process.exit(1);
  }
};

syncDatabase();
