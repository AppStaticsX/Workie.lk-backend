const nodemailer = require('nodemailer');
require('dotenv').config();

// Enhanced email service test with detailed diagnostics
const testEmailService = async () => {
  console.log('=== WORKIE EMAIL SERVICE DIAGNOSTICS ===\n');
  
  // 1. Check environment variables
  console.log('1. Environment Variables Check:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? `✓ Set (${process.env.EMAIL_USER})` : '❌ MISSING');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? `✓ Set (${process.env.EMAIL_PASS.substring(0, 4)}...)` : '❌ MISSING');
  console.log('CLIENT_URL:', process.env.CLIENT_URL || 'Not set');
  console.log();
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email configuration missing!');
    console.log('\nTo fix this:');
    console.log('1. Make sure you have a Gmail account');
    console.log('2. Enable 2-Factor Authentication on your Gmail account');
    console.log('3. Generate an App Password: https://myaccount.google.com/apppasswords');
    console.log('4. Add EMAIL_USER=youremail@gmail.com to .env');
    console.log('5. Add EMAIL_PASS=your-16-digit-app-password to .env');
    return;
  }

  try {
    // 2. Create and test transporter
    console.log('2. Creating SMTP Transporter...');
    const transporter = nodemailer.createTransporter({
      service: 'gmail', // Use service instead of manual config
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Additional options for better reliability
      pool: true,
      maxConnections: 1,
      maxMessages: 3,
    });

    console.log('✓ Transporter created successfully');
    console.log();

    // 3. Verify SMTP connection
    console.log('3. Testing SMTP Connection...');
    
    await new Promise((resolve, reject) => {
      transporter.verify(function (error, success) {
        if (error) {
          console.error('❌ SMTP Connection failed:', error.message);
          
          // Provide specific error guidance
          if (error.code === 'EAUTH') {
            console.log('\n🔧 Authentication Error - Try these fixes:');
            console.log('1. Check if your Gmail app password is correct');
            console.log('2. Make sure 2-Factor Authentication is enabled');
            console.log('3. Generate a new app password: https://myaccount.google.com/apppasswords');
            console.log('4. Make sure "Less secure app access" is OFF (use app passwords instead)');
          } else if (error.code === 'ECONNECTION') {
            console.log('\n🔧 Connection Error - Try these fixes:');
            console.log('1. Check your internet connection');
            console.log('2. Try a different network (some networks block SMTP)');
            console.log('3. Check if your firewall/antivirus is blocking port 587');
          }
          
          reject(error);
        } else {
          console.log('✅ SMTP server is ready to send messages');
          resolve(success);
        }
      });
    });

    // 4. Send a test email
    console.log('\n4. Sending Test Email...');
    
    const testOtp = '12345';
    const testEmail = process.env.EMAIL_USER; // Send to self for testing
    
    const mailOptions = {
      from: `"Workie.lk Test" <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: '✅ Email Service Test - Workie.lk',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #3B82F6; margin: 0;">Workie.lk</h1>
            <h2 style="color: #6c67f0; margin: 0;">Email Service Test</h2>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
            <h3 style="color: #333; margin-bottom: 20px;">🎉 Success!</h3>
            <p style="color: #666; margin-bottom: 30px;">Your email service is working correctly.</p>
            
            <div style="background-color: #3B82F6; color: white; padding: 15px 30px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 30px 0;">
              ${testOtp}
            </div>
            
            <p style="color: #666; margin-bottom: 20px;">This is a sample OTP code format.</p>
            <p style="color: #666; font-size: 14px;">If you received this email, your email configuration is working perfectly!</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              Test sent at: ${new Date().toLocaleString()}<br>
              © 2025 Workie.lk. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Test email sent successfully!');
    console.log('📩 Message ID:', result.messageId);
    console.log('📤 Response:', result.response);
    console.log(`📧 Check your inbox: ${testEmail}`);
    
    // 5. Test OTP email format
    console.log('\n5. Testing OTP Email Template...');
    await testOtpTemplate(transporter, testEmail);
    
    console.log('\n=== EMAIL SERVICE STATUS: ✅ WORKING ===');
    console.log('Your email service is configured correctly and ready to use!');
    
  } catch (error) {
    console.error('\n❌ Email test failed:', error.message);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Double-check your Gmail credentials in .env file');
    console.log('2. Make sure you\'re using an App Password, not your regular Gmail password');
    console.log('3. Verify 2-Factor Authentication is enabled on your Gmail account');
    console.log('4. Try generating a new App Password');
    console.log('5. Check if your network allows SMTP connections on port 587');
    
    console.log('\n📋 App Password Setup Guide:');
    console.log('1. Go to https://myaccount.google.com/security');
    console.log('2. Click "2-Step Verification" and make sure it\'s ON');
    console.log('3. Go back and click "App passwords"');
    console.log('4. Select "Mail" and "Other (custom name)"');
    console.log('5. Enter "Workie App" as the name');
    console.log('6. Copy the 16-digit password and use it as EMAIL_PASS');
  }
};

// Test OTP email template specifically
const testOtpTemplate = async (transporter, email) => {
  const otpCode = '54321';
  const firstName = 'Test User';
  
  const otpMailOptions = {
    from: `"Workie.lk" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Verification Code - Workie.lk',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #3B82F6; margin: 0;">Workie.lk</h1>
          <h2 style="color: #6c67f0; margin: 0;">Welcome to Our Community</h2>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
          <h3 style="color: #333; margin-bottom: 20px;">Email Verification</h3>
          <p style="color: #666; margin-bottom: 30px;">Hi ${firstName},</p>
          <p style="color: #666; margin-bottom: 30px;">Please use the following verification code to verify your email address:</p>
          
          <div style="background-color: #3B82F6; color: white; padding: 15px 30px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 30px 0;">
            ${otpCode}
          </div>
          
          <p style="color: #666; margin-bottom: 20px;">This code will expire in <strong>10 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            This email was sent by Workie.lk<br>
            © 2025 Workie.lk. All rights reserved.
          </p>
        </div>
      </div>
    `
  };

  try {
    const result = await transporter.sendMail(otpMailOptions);
    console.log('✅ OTP template test email sent successfully!');
    console.log('📩 Message ID:', result.messageId);
  } catch (error) {
    console.error('❌ OTP template test failed:', error.message);
  }
};

// Run the test
testEmailService().then(() => {
  console.log('\n✅ Email diagnostics completed!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Email diagnostics failed:', error.message);
  process.exit(1);
});