const { sendPasswordResetPin, sendOtpEmail } = require('./utils/emailService');
require('dotenv').config();

// Simulate production environment
process.env.NODE_ENV = 'production';

async function testProductionEmail() {
  console.log('🏭 Testing Email Service in PRODUCTION MODE...\n');
  
  // Display environment info
  console.log('🔍 Environment Variables:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`EMAIL_USER: ${process.env.EMAIL_USER ? '✅ Set' : '❌ Missing'}`);
  console.log(`EMAIL_PASS: ${process.env.EMAIL_PASS ? '✅ Set (length: ' + process.env.EMAIL_PASS.length + ')' : '❌ Missing'}`);
  console.log('');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('❌ Email credentials missing in .env file');
    return;
  }
  
  const testEmail = 'uanushka2001@gmail.com';  // Change this to your test email
  const testName = 'Test User';
  
  try {
    console.log('🧪 Test 1: Sending Password Reset PIN (Production Mode)...');
    const testPin = '12345';
    await sendPasswordResetPin(testEmail, testName, testPin);
    console.log('✅ Password reset PIN sent successfully!\n');
    
    console.log('🧪 Test 2: Sending OTP Email (Production Mode)...');
    const testOtp = '67890';
    await sendOtpEmail(testEmail, testOtp, testName);
    console.log('✅ OTP email sent successfully!\n');
    
    console.log('🎉 All production email tests passed!');
    console.log(`📬 Please check the inbox for ${testEmail}`);
    console.log('📧 Don\'t forget to check spam/junk folder if emails are not in inbox');
    
  } catch (error) {
    console.log('❌ Production email test failed:');
    console.log('Error:', error.message);
    
    // Production-specific debugging
    console.log('\n🔍 Production Debugging Information:');
    console.log('1. Check if Render/production server has correct environment variables');
    console.log('2. Verify EMAIL_USER and EMAIL_PASS are set in production environment');
    console.log('3. Ensure no extra spaces or characters in environment variables');
    console.log('4. Check if production server can access Gmail SMTP (port 587)');
    console.log('5. Verify App Password is still valid (they can expire)');
    console.log('6. Check production server\'s outbound network connectivity');
    
    if (error.message.includes('authentication')) {
      console.log('\n🔑 Authentication Error - Production Checklist:');
      console.log('✓ Gmail 2FA is enabled');
      console.log('✓ Using App Password (not regular Gmail password)');
      console.log('✓ App Password has no spaces: abcdabcdabcdabcd');
      console.log('✓ EMAIL_USER is the full Gmail address');
      console.log('✓ Environment variables are set in production (Render dashboard)');
    }
    
    if (error.message.includes('connection') || error.message.includes('timeout')) {
      console.log('\n🌐 Connection Error - Production Checklist:');
      console.log('✓ Production server has internet access');
      console.log('✓ Firewall allows outbound SMTP (port 587)');
      console.log('✓ No rate limiting by hosting provider');
      console.log('✓ Gmail SMTP is not blocked by hosting provider');
    }
  }
}

// Run the production test
testProductionEmail().catch(console.error);