const nodemailer = require('nodemailer');
require('dotenv').config();

// Test email service
async function testEmailService() {
  console.log('🔍 Testing Email Service Configuration...\n');
  
  // Check environment variables
  console.log('📧 Environment Variables:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Missing');
  console.log('');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('❌ Email credentials missing in .env file');
    return;
  }
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: true,
    logger: true
  });
  
  try {
    console.log('🔗 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Send test email
    console.log('\n📤 Sending test email...');
    const testEmail = {
      from: `"Workie.lk Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to self for testing
      subject: 'Email Service Test - ' + new Date().toISOString(),
      text: 'This is a test email to verify the email service is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #3B82F6;">Email Service Test</h2>
          <p>This is a test email to verify the email service is working correctly.</p>
          <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
          <p>If you received this email, the email service is functioning properly!</p>
        </div>
      `
    };
    
    const result = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('\n🎉 Email service is working correctly!');
    
  } catch (error) {
    console.log('❌ Email service test failed:');
    console.log('Error:', error.message);
    
    if (error.code === 'EAUTH') {
      console.log('\n💡 Authentication Error Solutions:');
      console.log('1. Ensure 2-Factor Authentication is enabled on Gmail');
      console.log('2. Use an App Password (not your regular Gmail password)');
      console.log('3. Check that EMAIL_PASS in .env has no spaces');
      console.log('4. App password should be 16 characters: abcdabcdabcdabcd');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n💡 Connection Error Solutions:');
      console.log('1. Check internet connection');
      console.log('2. Firewall might be blocking SMTP (port 587)');
      console.log('3. Try using a different network');
    }
  }
}

// Run the test
testEmailService().catch(console.error);