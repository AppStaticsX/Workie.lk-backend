const axios = require('axios');

// Test OTP endpoints
const testOtpEndpoints = async () => {
  const baseUrl = 'http://localhost:5000/api/auth';
  const testEmail = 'test@example.com';

  console.log('Testing OTP endpoints...');

  try {
    // Test 1: Register a user (this should send an OTP)
    console.log('\n1. Testing user registration (should send OTP)...');
    
    const registerResponse = await axios.post(`${baseUrl}/register`, {
      firstName: 'Test',
      lastName: 'User',
      email: testEmail,
      password: 'testpassword123',
      userType: 'worker'
    });

    console.log('✅ Registration response:', registerResponse.data);
    
    if (registerResponse.data.emailSent === false) {
      console.log('⚠️  Email was not sent during registration');
    }

    // Test 2: Resend OTP
    console.log('\n2. Testing OTP resend...');
    
    const resendResponse = await axios.post(`${baseUrl}/resend-otp`, {
      email: testEmail
    });

    console.log('✅ Resend OTP response:', resendResponse.data);

    // Test 3: Verify OTP (with dummy code)
    console.log('\n3. Testing OTP verification (with dummy code)...');
    
    try {
      const verifyResponse = await axios.post(`${baseUrl}/verify-otp`, {
        email: testEmail,
        otp: '12345'
      });
      console.log('✅ Verify OTP response:', verifyResponse.data);
    } catch (verifyError) {
      console.log('⚠️  Expected error for dummy OTP:', verifyError.response?.data?.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
};

// Run the test
testOtpEndpoints();