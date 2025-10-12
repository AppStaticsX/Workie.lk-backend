const nodemailer = require('nodemailer');
require('dotenv').config();

// Test email configuration
const testEmailService = async () => {
  console.log('Testing email service configuration...');
  
  // Check environment variables
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'configured' : 'MISSING');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'configured' : 'MISSING');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email configuration missing!');
    return;
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransporter({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    console.log('Testing SMTP connection...');
    
    // Verify connection
    await new Promise((resolve, reject) => {
      transporter.verify(function (error, success) {
        if (error) {
          console.error('❌ SMTP Connection failed:', error.message);
          console.error('Error code:', error.code);
          console.error('Error command:', error.command);
          reject(error);
        } else {
          console.log('✅ SMTP server is ready to send messages');
          resolve(success);
        }
      });
    });

    // Send a test email
    console.log('Sending test email...');
    
    const testOtp = '12345';
    const testEmail = process.env.EMAIL_USER; // Send to self for testing
    
    const mailOptions = {
      from: `"Workie.lk Test" <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: 'Test Email - Workie.lk Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3B82F6;">Email Service Test</h2>
          <p>This is a test email to verify that the email service is working correctly.</p>
          <div style="background-color: #3B82F6; color: white; padding: 15px 30px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 30px 0; text-align: center;">
            ${testOtp}
          </div>
          <p>If you received this email, the email service is working correctly!</p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.command) {
      console.error('Error command:', error.command);
    }
  }
};

// Run the test
testEmailService();