class SmsService {
  /**
   * Sends an OTP via SMS Fortius API
   * @param {string} phone - The recipient's phone number
   * @param {string} otp - The OTP to send
   * @returns {Promise<Object>} The response from the API
   */
  async sendOtpSms(phone, otp) {
    try {
      const apiKey = process.env.SMS_FORTIUS_API_KEY;
      const senderId = process.env.SMS_FORTIUS_SENDER_ID;
      const templateId = process.env.SMS_FORTIUS_TEMPLATE_ID;
      const baseUrl = process.env.SMS_FORTIUS_BASE_URL;

      if (!apiKey || !senderId || !templateId || !baseUrl) {
        console.warn('SMS Fortius configuration is missing in .env. Falling back to log.');
        console.log(`[OTP Mock] Phone: ${phone} | OTP: ${otp}`);
        return { success: true, message: 'Mock OTP sent (missing config).' };
      }

      // Ensure phone number format is correct (e.g., stripping '+' if needed by the API)
      // The API usually takes numbers like 8052940888 without country code if it's local,
      // but let's just use what is passed (often includes +91, which might need to be removed)
      const cleanPhone = phone.replace(/^\+91/, '');

      // The 11-character hash (YgbYXq+qNj4) allows Android to auto-read the OTP.
      // If the OTP is not delivered, this is the first thing to verify.
      const message = `Welcome to Daily Meat! Your OTP for Daily Meat app registration is ${otp}.Valid for 10 minutes. Please do not share it. - YgbYXq+qNj4`;

      const params = new URLSearchParams({
        apikey: apiKey,
        senderid: senderId,
        templateid: templateId,
        number: cleanPhone,
        message: message
      });

      const requestUrl = `${baseUrl}?${params.toString()}`;

      console.log(`[SMS] Sending OTP to ${cleanPhone} via SMS Fortius...`);

      const response = await fetch(requestUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`SMS Fortius API returned ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log(`[SMS] Response:`, responseText);

      return { success: true, message: 'OTP sent via SMS successfully.' };
    } catch (error) {
      console.error('[SMS Service Error]:', error.message);
      throw new Error('Failed to send OTP SMS. Please try again later.');
    }
  }
}

module.exports = new SmsService();
