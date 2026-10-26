const nodemailer = require('nodemailer');

// Create a transporter using SMTP configuration from .env
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Generates an attractive and responsive HTML email template for Daily Meat
 * with built-in dark and light mode support.
 * 
 * @param {string} title - The title/header of the email content
 * @param {string} bodyContent - The main body content (HTML string)
 * @returns {string} - Full HTML string
 */
const generateEmailTemplate = (title, bodyContent) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${title}</title>
    <style>
        /* Base styles (Light Mode Default) */
        body {
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f7f6;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            color: #333333;
        }
        .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f4f7f6;
            padding: 40px 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.06);
        }
        .header {
            background-color: #6C210A; /* Daily Meat Premium Red */
            padding: 35px 20px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 800;
            letter-spacing: 1.5px;
            text-transform: uppercase;
        }
        .content {
            padding: 40px 35px;
            line-height: 1.8;
            font-size: 16px;
        }
        .content h2 {
            color: #1d3557;
            font-size: 22px;
            margin-top: 0;
            margin-bottom: 20px;
            font-weight: 700;
        }
        .content p {
            margin-bottom: 20px;
            color: #4a4a4a;
        }
        .highlight-box {
            background-color: #f1faee;
            border: 2px dashed #457b9d;
            border-radius: 10px;
            padding: 25px 20px;
            text-align: center;
            margin: 35px 0;
        }
        .otp-code {
            font-size: 42px;
            font-weight: 900;
            color: #1d3557;
            letter-spacing: 8px;
            margin: 0;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 25px;
            text-align: center;
            font-size: 13px;
            color: #6c757d;
            border-top: 1px solid #eeeeee;
        }
        .footer a {
            color: #6C210A;
            text-decoration: none;
            font-weight: 600;
        }
        .social-links {
            margin: 15px 0;
        }
        
        /* Dark Mode Styles */
        @media (prefers-color-scheme: dark) {
            body, .wrapper {
                background-color: #121212 !important;
                color: #e0e0e0 !important;
            }
            .container {
                background-color: #1e1e1e !important;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
            }
            .header {
                background-color: #6C210A !important; /* Slightly darker red for dark mode */
            }
            .content p {
                color: #cccccc !important;
            }
            .content h2 {
                color: #f1faee !important;
            }
            .highlight-box {
                background-color: #2c2c2c !important;
                border-color: #a8dadc !important;
            }
            .otp-code {
                color: #f1faee !important;
            }
            .footer {
                background-color: #1a1a1a !important;
                color: #a0a0a0 !important;
                border-top: 1px solid #333333 !important;
            }
            .footer a {
                color: #6C210A !important;
            }
        }
        
        /* Mobile Responsiveness */
        @media only screen and (max-width: 600px) {
            .wrapper {
                padding: 0 !important;
            }
            .container {
                margin: 0 !important;
                border-radius: 0 !important;
                width: 100% !important;
                box-shadow: none !important;
            }
            .content {
                padding: 30px 20px !important;
            }
            .header {
                padding: 25px 20px !important;
            }
            .header h1 {
                font-size: 24px !important;
            }
            .otp-code {
                font-size: 36px !important;
                letter-spacing: 6px !important;
            }
        }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>Daily Meat</h1>
            </div>
            <div class="content">
                <h2>${title}</h2>
                ${bodyContent}
            </div>
            <div class="footer">
                <p>We're here to deliver the freshest quality meat straight to your door.</p>
                <p>Need help? Contact our support team at <a href="mailto:support@dailymeat.in">support@dailymeat.in</a></p>
                <p>Visit us at <a href="https://dailymeat.in">dailymeat.in</a></p>
                <p>
                    <a href="https://dailymeat.in/terms-and-conditions">Terms & Conditions</a> | 
                    <a href="https://dailymeat.in/privacy-policy">Privacy Policy</a>
                </p>
                <p>&copy; ${new Date().getFullYear()} Daily Meat. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>
`;

/**
 * Helper function to send an OTP email with the Daily Meat branded template.
 * 
 * @param {string} to - Recipient email address
 * @param {string} otp - The OTP code
 * @returns {Promise<Object>} - Promise resolving to info object
 */
const sendOtpEmail = async (to, otp) => {
    const title = 'Secure Your Account';
    const bodyContent = `
        <p>Hello there,</p>
        <p>Welcome to <strong>Daily Meat</strong>! To ensure the security of your account and complete your login, please use the following One-Time Password (OTP):</p>
        <div class="highlight-box">
            <div class="otp-code">${otp}</div>
        </div>
        <p><em>Note: This code is valid for only <strong>5 minutes</strong>. Please do not share it with anyone.</em></p>
        <p>If you didn't request this code, you can safely ignore this email.</p>
        <p>Stay fresh,</p>
        <p><strong>The Daily Meat Team</strong></p>
    `;

    const html = generateEmailTemplate(title, bodyContent);
    const text = `Welcome to Daily Meat! Your login OTP is ${otp}. It is valid for 5 minutes. Please do not share it with anyone.`;

    return sendEmail({
        to,
        subject: 'Your Daily Meat Login OTP',
        text,
        html
    });
};

/**
 * Send an email using the configured transporter.
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text version of the email body
 * @param {string} [options.html] - HTML version of the email body
 * @returns {Promise<Object>} - Promise resolving to info object about the sent email
 */
const sendEmail = async ({ to, subject, text, html }) => {
    try {
        const mailOptions = {
            from: process.env.SMTP_FROM || '"Daily Meat" <noreply@dailymeat.in>',
            to,
            subject,
            text,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to}: ${info.messageId}`);
        return { success: true, info };
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendEmail,
    generateEmailTemplate,
    sendOtpEmail
};
