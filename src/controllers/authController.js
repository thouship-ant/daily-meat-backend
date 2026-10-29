const authService = require('../services/authService');

class AuthController {
  /**
   * Endpoint to check if a phone number exists and return its role.
   */
  async checkPhone(req, res) {
    try {
      const { phone, email } = req.body;
      const identifier = email || phone;
      if (!identifier) {
        return res.status(400).json({ error: 'Phone number or email is required.' });
      }

      const result = await authService.checkPhone(identifier);
      res.status(200).json(result);
    } catch (error) {
      console.error('Check phone error:', error.message);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }

  /**
   * Endpoint for handling login with password for ADMIN and DRIVER.
   */
  async loginWithPassword(req, res) {
    try {
      const { phone, email, identifier, password } = req.body;
      const finalIdentifier = identifier || email || phone;

      if (!finalIdentifier || !password) {
        return res.status(400).json({ error: 'Email or Phone, and password are required.' });
      }

      const { user, tokens } = await authService.loginWithPassword(finalIdentifier, password);

      res.status(200).json({
        message: 'Authentication successful',
        user,
        tokens
      });
    } catch (error) {
      console.error('Login error:', error.message);
      
      if (error.message.includes('Invalid') || error.message.includes('not set') || error.message.includes('Customers must')) {
         return res.status(401).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Internal server error during authentication.' });
    }
  }

  /**
   * Endpoint to refresh access token using a refresh token.
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required.' });
      }

      const tokens = await authService.refreshToken(refreshToken);
      res.status(200).json({ tokens });
    } catch (error) {
      console.error('Refresh token error:', error.message);
      res.status(401).json({ error: error.message });
    }
  }

  /**
   * Endpoint to logout the user and invalidate the refresh token.
   */
  async logout(req, res) {
    try {
      const userId = req.user.id;
      const { pushToken } = req.body;
      await authService.logout(userId, pushToken);
      res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
      console.error('Logout error:', error.message);
      res.status(500).json({ error: 'Internal server error during logout.' });
    }
  }

  /**
   * Endpoint for updating the user's profile (name and email).
   */
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { name, email, phone, promotional_notifications } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required to complete profile.' });
      }

      const finalEmail = email && email.trim() !== '' ? email : null;
      const updatedUser = await authService.updateProfile(userId, { name, email: finalEmail, phone, promotional_notifications });

      res.status(200).json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error.message);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: 'Email already exists.' });
      }
      res.status(500).json({ error: 'Internal server error while updating profile.' });
    }
  }

  /**
   * Endpoint for deleting the user's account
   */
  async deleteAccount(req, res) {
    try {
      const userId = req.user.id;
      const { User, Address, SupportTicket, CouponRedemption } = require('../models');
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      // Delete personal associated data
      if (Address) await Address.destroy({ where: { user_id: userId } });
      if (SupportTicket) await SupportTicket.destroy({ where: { user_id: userId } });
      if (CouponRedemption) await CouponRedemption.destroy({ where: { user_id: userId } });
      
      // Anonymize the user record instead of deleting it to preserve order calculations
      user.name = 'Deleted User';
      user.email = null;
      // Date.now() is 13 digits. "del_" + 13 digits = 17 characters. Fits within VARCHAR(20)
      user.phone = `del_${Date.now()}`;
      user.password = null;
      user.push_token = null;
      user.device_id = null;
      user.refresh_token = null;
      user.is_active = false;
      user.otp = null;
      await user.save();
      
      res.status(200).json({ message: 'Account anonymized and personal data deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error.message);
      res.status(500).json({ error: 'Internal server error while deleting account.' });
    }
  }

  async getMe(req, res) {
    try {
      const userId = req.user.id;
      const { User } = require('../models');
      const user = await User.findByPk(userId, {
        attributes: ['id', 'name', 'email', 'phone', 'role', 'is_profile_completed', 'push_token', 'promotional_notifications']
      });
      if (!user) return res.status(404).json({ error: 'User not found.' });
      res.status(200).json(user);
    } catch (error) {
      console.error('Get me error:', error.message);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }

  async updatePushToken(req, res) {
    try {
      const userId = req.user.id;
      const { pushToken, platform, appVersion } = req.body;
      const { User } = require('../models');
      
      if (!pushToken) {
        return res.status(400).json({ error: 'Push token is required.' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      let tokens = [];
      if (user.push_token) {
        tokens = user.push_token.split(',').map(t => t.trim()).filter(Boolean);
      }

      // Add token if not present
      if (!tokens.includes(pushToken)) {
        tokens.push(pushToken);
        // Keep max 5 tokens to prevent VARCHAR(255) overflow
        if (tokens.length > 5) {
          tokens = tokens.slice(tokens.length - 5);
        }
        await User.update({ push_token: tokens.join(',') }, { where: { id: userId } });
      }

      // Remember which store/app version this device runs, so app-update pushes can be targeted
      const devicePlatform = ['android', 'ios'].includes(String(platform).toLowerCase()) ? String(platform).toLowerCase() : null;
      if (devicePlatform) {
        try {
          const withDevices = await User.unscoped().findByPk(userId, { attributes: ['id', 'push_devices'] });
          const existing = (withDevices && withDevices.push_devices) || {};
          const devices = {};
          for (const t of tokens) {
            if (existing[t]) devices[t] = existing[t];
          }
          devices[pushToken] = { platform: devicePlatform, app_version: appVersion ? String(appVersion) : null };
          await User.update({ push_devices: devices }, { where: { id: userId } });
        } catch (deviceError) {
          // Never fail token registration because of this optional metadata (e.g. column not migrated yet)
          console.error('Could not store push device info:', deviceError.message);
        }
      }

      res.status(200).json({ message: 'Push token updated successfully.' });
    } catch (error) {
      console.error('Update push token error:', error.message);
      res.status(500).json({ error: 'Internal server error while updating push token.' });
    }
  }

  async sendOtp(req, res) {
    try {
      const { phone, email } = req.body;
      const identifier = email || phone;
      if (!identifier) return res.status(400).json({ error: 'Phone number or email is required.' });
      const result = await authService.sendOtp(identifier);
      res.status(200).json(result);
    } catch (error) {
      console.error('Send OTP error:', error.message);
      res.status(500).json({ error: 'Failed to send OTP.' });
    }
  }

  async resendOtp(req, res) {
    try {
      const { phone, email } = req.body;
      const identifier = email || phone;
      if (!identifier) return res.status(400).json({ error: 'Phone number or email is required.' });
      const result = await authService.sendOtp(identifier);
      res.status(200).json(result);
    } catch (error) {
      console.error('Resend OTP error:', error.message);
      res.status(500).json({ error: 'Failed to resend OTP.' });
    }
  }

  async verifyOtp(req, res) {
    try {
      const { phone, email, otp, deviceId } = req.body;
      const identifier = email || phone;
      if (!identifier || !otp) return res.status(400).json({ error: 'Phone/email and OTP are required.' });
      const { user, tokens } = await authService.verifyOtp(identifier, otp, deviceId);
      res.status(200).json({ message: 'OTP verified successfully.', user, tokens });
    } catch (error) {
      console.error('Verify OTP error:', error.message);
      res.status(400).json({ error: error.message });
    }
  }

  async changePassword(req, res) {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;
      
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Old and new passwords are required.' });
      }

      const result = await authService.changePassword(userId, oldPassword, newPassword);
      res.status(200).json(result);
    } catch (error) {
      console.error('Change password error:', error.message);
      res.status(400).json({ error: error.message });
    }
  }
  async testNotification(req, res) {
    try {
      const userId = req.user.id;
      const { User } = require('../models');
      const notificationService = require('../services/notificationService');

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (!user.push_token) {
        return res.status(400).json({ error: 'User does not have a push token registered.' });
      }

      await notificationService.notifyUser({
        userId: user.id,
        title: 'Test Notification',
        body: 'This is a test notification from the backend.',
        data: { test: 'true' },
        socketEvent: 'test_event'
      });

      res.status(200).json({ message: 'Test notification sent successfully.' });
    } catch (error) {
      console.error('Test notification error:', error.message);
      res.status(500).json({ error: 'Internal server error while sending test notification.' });
    }
  }
}

module.exports = new AuthController();
