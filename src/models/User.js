const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { USER_ROLES } = require('../constants/enum');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true,
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Only for ADMIN and DRIVER
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
  },
  is_profile_completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  role: {
    type: DataTypes.ENUM(...Object.values(USER_ROLES)),
    allowNull: false,
    defaultValue: USER_ROLES.CUSTOMER,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  refresh_token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tokens_valid_after: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Access tokens issued before this time are rejected (used to force logout on all devices)'
  },
  push_token: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  push_devices: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Per push token metadata: { "<token>": { platform: "android"|"ios", app_version: "1.0.0" } }'
  },
  device_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  promotional_notifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  otp: {
    type: DataTypes.STRING(6),
    allowNull: true,
  },
  otp_expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  otp_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  }
}, {
  tableName: 'users',
  timestamps: true,
  indexes: [
    {
      name: 'users_email_idx',
      fields: ['email'],
    },
    {
      name: 'users_phone_idx',
      fields: ['phone'],
    },
    {
      name: 'users_role_idx',
      fields: ['role'],
    }
  ]
});

module.exports = User;
