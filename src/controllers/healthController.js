const sequelize = require('../config/database');

const checkHealth = async (req, res) => {
  try {
    // Check DB connection
    await sequelize.authenticate();
    
    res.status(200).json({
      status: 'success',
      message: 'Server is healthy',
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server is healthy, but database connection failed',
      database: 'disconnected',
      error: error.message
    });
  }
};

module.exports = {
  checkHealth
};
