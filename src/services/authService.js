const jwt = require('jsonwebtoken');
const { User } = require('../models');

class AuthService {
  /**
   * Generates a JWT Access Token for the authenticated user.
   */
  generateAccessToken(user) {
    const payload = { id: user.id, phone: user.phone, role: user.role };
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    });
  }

  /**
   * Generates a Refresh Token, saves it to the DB, and returns it.
   */
  async generateRefreshToken(user) {
    const payload = { id: user.id };
    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'
    });
    
    // Save to database so we can invalidate it on logout
    user.refresh_token = refreshToken;
    await user.save();
    return refreshToken;
  }

  /**
   * Generates both tokens.
   */
  async generateAuthTokens(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    return { accessToken, refreshToken };
  }

  /**
   * Checks if a phone number exists and returns its role.
   * @param {string} phone - The phone number to check.
   * @returns {Promise<Object>} Object containing exists boolean and role.
   */
  async checkPhone(identifier) {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const whereClause = isEmail ? { email: identifier } : { phone: identifier };
    const user = await User.findOne({ where: whereClause });
    if (!user) {
      return { exists: false, role: 'CUSTOMER' }; // Default to customer if not found
    }
    return { exists: true, role: user.role };
  }

  /**
   * Logs in a user using their phone and password (for ADMIN and DRIVER).
   * @param {string} phone - The phone number.
   * @param {string} password - The password.
   * @returns {Promise<Object>} The user and generated JWT token.
   */
  async loginWithPassword(identifier, password) {
    const bcrypt = require('bcrypt'); // Lazy load to avoid circular deps if any
    
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const whereClause = isEmail ? { email: identifier } : { phone: identifier };

    const user = await User.findOne({ where: whereClause });
    if (!user) {
      throw new Error('Invalid email/phone or password.');
    }

    if (user.role === 'CUSTOMER') {
      throw new Error('Customers must login using OTP.');
    }

    if (!user.password) {
      throw new Error('Password not set for this account.');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid email/phone or password.');
    }

    if (!user.is_active) {
      throw new Error('Account deactivated. Please contact support.');
    }

    const tokens = await this.generateAuthTokens(user);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        is_profile_completed: user.is_profile_completed,
        is_active: user.is_active
      },
      tokens
    };
  }

  /**
   * Refreshes the Access Token using a valid Refresh Token.
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token is required.');
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      
      const user = await User.findByPk(decoded.id);
      if (!user) {
        throw new Error('User not found.');
      }

      if (user.refresh_token !== refreshToken) {
        throw new Error('Invalid refresh token.');
      }

      const tokens = await this.generateAuthTokens(user);
      return tokens;
    } catch (error) {
      throw new Error('Invalid or expired refresh token.');
    }
  }

  /**
   * Logs out the user by invalidating their refresh token.
   * If a pushToken is provided, it removes only that token, leaving other devices active.
   */
  async logout(userId, pushTokenToClear) {
    const user = await User.findByPk(userId);
    if (user) {
      user.refresh_token = null;
      
      if (pushTokenToClear && user.push_token) {
        let tokens = user.push_token.split(',').map(t => t.trim()).filter(Boolean);
        tokens = tokens.filter(t => t !== pushTokenToClear);
        user.push_token = tokens.length > 0 ? tokens.join(',') : null;
      } else if (!pushTokenToClear) {
        // Fallback if no specific token is provided (though it's best if it is)
        user.push_token = null;
      }
      
      await user.save();
    }
    return { success: true };
  }

  /**
   * Updates the user's name and email, and marks profile as completed.
   * @param {string} userId - The database user ID.
   * @param {Object} data - Contains name and email.
   * @returns {Promise<Object>} Updated user object.
   */
  async updateProfile(userId, data) {
    const { name, email, phone, promotional_notifications } = data;
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found.');
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (promotional_notifications !== undefined) user.promotional_notifications = promotional_notifications;
    user.is_profile_completed = true;

    await user.save();

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      is_profile_completed: user.is_profile_completed,
      promotional_notifications: user.promotional_notifications
    };
  }

  /**
   * Changes the user's password.
   */
  async changePassword(userId, oldPassword, newPassword) {
    const bcrypt = require('bcrypt');
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('User not found.');
    }

    if (!user.password) {
      throw new Error('No password set. Please use forgot password or contact admin.');
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      throw new Error('Incorrect old password.');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return { success: true, message: 'Password changed successfully.' };
  }

  /**
   * Sends an OTP to a phone number using Firebase Admin SDK.
   * Stores a 6-digit OTP in-memory with an expiry.
   * @param {string} phone - E.164 phone number e.g. +919704611443
   */
  async sendOtp(identifier) {
    // Test account bypass: skips SMS gateway for automated testing
    if (identifier && identifier.includes('9000000000')) {
      return { success: true, message: 'OTP sent successfully (Test Account).' };
    }

    // Generate random 6-digit OTP valid for 5 minutes
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const whereClause = isEmail ? { email: identifier } : { phone: identifier };

    // Persist OTP directly on existing user record with attempt counter reset
    const user = await User.findOne({ where: whereClause });
    if (user) {
      await User.update(
        { otp, otp_expires_at: expiresAt, otp_attempts: 0 },
        { where: { id: user.id } }
      );
    } else {
      // New registration: cache OTP in short-lived memory store until verified
      if (!global._otpStore) global._otpStore = {};
      global._otpStore[identifier] = { otp, expiresAt: expiresAt.getTime(), attempts: 0 };
    }

    // Route delivery: SMTP email or SMS Fortius DLT gateway
    if (isEmail) {
      const { sendOtpEmail } = require('./emailService');
      await sendOtpEmail(identifier, otp);
      console.log(`[OTP] Email: ${identifier} | OTP: ${otp} | Expires: ${expiresAt.toISOString()}`);
      return { success: true, message: 'OTP sent to email.' };
    } else {
      const smsService = require('./smsService');
      await smsService.sendOtpSms(identifier, otp);
      console.log(`[OTP] Phone: ${identifier} | OTP: ${otp} | Expires: ${expiresAt.toISOString()}`);
      return { success: true, message: 'OTP sent via SMS successfully.' };
    }
  }

  /**
   * Verifies an OTP for a phone number.
   * If valid, creates or fetches the user and returns tokens.
   * @param {string} phone - E.164 phone number
   * @param {string} otp - 6-digit OTP entered by user
   */
  async verifyOtp(identifier, otp, deviceId) {
    // Fixed test OTP check for app store reviewers and automated testing
    const isTestAccount = identifier && identifier.includes('9000000000');
    const isTestOtpValid = isTestAccount && String(otp) === '123456';

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const whereClause = isEmail ? { email: identifier } : { phone: identifier };

    let existingUser = await User.findOne({ where: whereClause });

    if (isTestAccount) {
      if (!isTestOtpValid) {
        throw new Error('Invalid OTP. For test account, use 123456.');
      }
      
      if (!existingUser) {
        const createData = { phone: identifier, name: 'testing account', is_profile_completed: true };
        if (deviceId) createData.device_id = deviceId;
        existingUser = await User.create(createData);
      } else if (existingUser.name !== 'testing account') {
        existingUser.name = 'testing account';
        await existingUser.save();
      }

      if (!existingUser.is_active) {
        throw new Error('Account deactivated. Please contact support.');
      }

      const tokens = await this.generateAuthTokens(existingUser);
      return {
        user: {
          id: existingUser.id,
          phone: existingUser.phone,
          name: existingUser.name,
          role: existingUser.role,
          is_profile_completed: existingUser.is_profile_completed,
          is_active: existingUser.is_active
        },
        tokens
      };
    }

    if (existingUser) {
      // ── DB-backed OTP verification ──
      if (!existingUser.otp) {
        throw new Error('No OTP found for this number/email. Please request a new OTP.');
      }

      if (new Date() > new Date(existingUser.otp_expires_at)) {
        await User.update(
          { otp: null, otp_expires_at: null, otp_attempts: 0 },
          { where: { id: existingUser.id } }
        );
        throw new Error('OTP has expired. Please request a new OTP.');
      }

      if (existingUser.otp !== otp) {
        const newAttempts = (existingUser.otp_attempts || 0) + 1;
        if (newAttempts >= 5) {
          await User.update(
            { otp: null, otp_expires_at: null, otp_attempts: 0 },
            { where: { id: existingUser.id } }
          );
          throw new Error('Too many failed attempts. OTP has been invalidated. Please request a new one.');
        }
        await User.update({ otp_attempts: newAttempts }, { where: { id: existingUser.id } });
        throw new Error(`Invalid OTP. You have ${5 - newAttempts} attempt(s) left.`);
      }

      // OTP is valid — clear it from DB
      await User.update(
        { otp: null, otp_expires_at: null, otp_attempts: 0 },
        { where: { id: existingUser.id } }
      );

      if (!existingUser.is_active) {
        throw new Error('Account deactivated. Please contact support.');
      }

      const tokens = await this.generateAuthTokens(existingUser);
      return {
        user: {
          id: existingUser.id,
          phone: existingUser.phone,
          name: existingUser.name,
          role: existingUser.role,
          is_profile_completed: existingUser.is_profile_completed,
          is_active: existingUser.is_active
        },
        tokens
      };
    } else {
      // ── In-memory fallback for brand-new users not yet in DB ──
      if (!global._otpStore || !global._otpStore[identifier]) {
        throw new Error('No OTP found for this number/email. Please request a new OTP.');
      }

      const record = global._otpStore[identifier];

      if (Date.now() > record.expiresAt) {
        delete global._otpStore[identifier];
        throw new Error('OTP has expired. Please request a new OTP.');
      }

      if (record.otp !== otp) {
        record.attempts = (record.attempts || 0) + 1;
        if (record.attempts >= 5) {
          delete global._otpStore[identifier];
          throw new Error('Too many failed attempts. OTP has been invalidated. Please request a new one.');
        }
        throw new Error(`Invalid OTP. You have ${5 - record.attempts} attempt(s) left.`);
      }

      // OTP valid — clear memory store
      delete global._otpStore[identifier];

      // Check device limit before creating user
      if (deviceId) {
        const deviceCount = await User.count({ where: { device_id: deviceId } });
        if (deviceCount >= 2) {
          throw new Error('Maximum registration limit reached for this device.');
        }
      }

      const createData = { ...whereClause };
      if (deviceId) createData.device_id = deviceId;

      const newUser = await User.create(createData);

      const tokens = await this.generateAuthTokens(newUser);
      return {
        user: {
          id: newUser.id,
          phone: newUser.phone,
          name: newUser.name,
          role: newUser.role,
          is_profile_completed: newUser.is_profile_completed,
          is_active: newUser.is_active
        },
        tokens
      };
    }
  }
}

module.exports = new AuthService();
