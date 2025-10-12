const { sendOtpEmail, sendPasswordResetPin } = require('./utils/emailService');
require('dotenv').config();

async function sendTestEmails() {
  console.log('📧 Sending test emails to uanushka2001@gmail.com...\n');
  
  const testEmail = 'uanushka2001@gmail.com';
  const testName = 'Anushka';
  
  try {
    // Test 1: Send OTP Email (like registration)
    console.log('🔐 Sending OTP verification email...');
    const testOtp = '12345';
    await sendOtpEmail(testEmail, testOtp, testName);
    console.log('✅ OTP email sent successfully!\n');
    
    // Test 2: Send Password Reset PIN (like forgot password)
    console.log('🔑 Sending password reset PIN email...');
    const testPin = '67890';
    await sendPasswordResetPin(testEmail, testName, testPin);
    console.log('✅ Password reset email sent successfully!\n');
    
    console.log('🎉 All test emails sent successfully!');
    console.log('📬 Please check the inbox for uanushka2001@gmail.com');
    console.log('📧 Don\'t forget to check spam/junk folder if emails are not in inbox');
    
  } catch (error) {
    console.log('❌ Failed to send test emails:');
    console.log('Error:', error.message);
    
    if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication Error - Check:');
      console.log('1. Gmail 2FA is enabled');
      console.log('2. Using correct app password (no spaces)');
      console.log('3. EMAIL_USER and EMAIL_PASS in .env are correct');
    }
  }
}

// Run the test
sendTestEmails().catch(console.error);