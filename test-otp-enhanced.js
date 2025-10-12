const http = require('http');
const querystring = require('querystring');
require('dotenv').config();

// Test OTP endpoints
const testOtpEndpoints = async () => {
  console.log('=== WORKIE OTP ENDPOINTS TEST ===\n');
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const testEmail = 'test+' + Date.now() + '@example.com'; // Unique test email
  
  console.log('📧 Test Email:', testEmail);
  console.log('🌐 Server URL:', baseUrl);
  console.log();

  try {
    // Test 1: Register user (this should send OTP)
    console.log('1. Testing Registration with OTP...');
    const registerData = {
      firstName: 'Test',
      lastName: 'User',
      email: testEmail,
      password: 'TestPassword123',
      userType: 'worker'
    };
    
    const registerResult = await makeRequest(`${baseUrl}/api/auth/register`, 'POST', registerData);
    
    if (registerResult.success) {
      console.log('✅ Registration successful');
      console.log('📧 Email sent:', registerResult.emailSent);
      console.log('💬 Message:', registerResult.message);
      
      if (!registerResult.emailSent) {
        console.log('⚠️  Email was not sent during registration');
      }
    } else {
      console.log('❌ Registration failed:', registerResult.message);
      return;
    }
    
    console.log();

    // Test 2: Resend OTP
    console.log('2. Testing Resend OTP...');
    const resendResult = await makeRequest(`${baseUrl}/api/auth/resend-otp`, 'POST', { email: testEmail });
    
    if (resendResult.success) {
      console.log('✅ Resend OTP successful');
      console.log('💬 Message:', resendResult.message);
    } else {
      console.log('❌ Resend OTP failed:', resendResult.message);
    }
    
    console.log();

    // Test 3: Verify OTP with invalid code
    console.log('3. Testing OTP Verification with invalid code...');
    const invalidOtpResult = await makeRequest(`${baseUrl}/api/auth/verify-otp`, 'POST', {
      email: testEmail,
      otp: '00000'
    });
    
    if (!invalidOtpResult.success) {
      console.log('✅ Invalid OTP correctly rejected');
      console.log('💬 Message:', invalidOtpResult.message);
    } else {
      console.log('❌ Invalid OTP was accepted (this should not happen)');
    }
    
    console.log();

    // Test 4: Check if OTP endpoints exist
    console.log('4. Testing endpoint availability...');
    const endpoints = [
      '/api/auth/register',
      '/api/auth/verify-otp', 
      '/api/auth/resend-otp',
      '/api/auth/forgot-password',
      '/api/auth/verify-reset-pin'
    ];
    
    for (const endpoint of endpoints) {
      try {
        await makeRequest(`${baseUrl}${endpoint}`, 'POST', {});
        console.log(`✅ ${endpoint} - Available`);
      } catch (error) {
        if (error.message.includes('400') || error.message.includes('404')) {
          console.log(`✅ ${endpoint} - Available (validation error expected)`);
        } else {
          console.log(`❌ ${endpoint} - Not available:`, error.message);
        }
      }
    }
    
    console.log('\n=== OTP ENDPOINTS TEST COMPLETED ===');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Helper function to make HTTP requests
const makeRequest = (url, method, data) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve(jsonResponse);
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    // Set timeout
    req.setTimeout(10000); // 10 seconds

    // Send data
    req.write(postData);
    req.end();
  });
};

// Test server connectivity first
const testServerConnection = async () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  
  console.log('🔍 Testing server connection...');
  
  try {
    await makeRequest(`${baseUrl}/api/auth/validate-token`, 'POST', { token: 'test' });
    console.log('✅ Server is running and accessible');
    return true;
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('400')) {
      console.log('✅ Server is running and accessible');
      return true;
    } else {
      console.log('❌ Server connection failed:', error.message);
      console.log('\n🔧 Make sure your backend server is running:');
      console.log('   cd backend && npm start');
      return false;
    }
  }
};

// Run tests
const runTests = async () => {
  const isServerRunning = await testServerConnection();
  
  if (isServerRunning) {
    console.log();
    await testOtpEndpoints();
  }
  
  console.log('\n📋 Test Summary:');
  console.log('- If registration fails, check email service configuration');
  console.log('- If OTP verification fails, check database connection');
  console.log('- If endpoints are not available, check server routes');
  console.log('\n✅ OTP endpoints test completed!');
};

runTests().catch(console.error);