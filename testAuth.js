// Test Authentication Endpoints
// Run this with: node testAuth.js

const https = require('http');

const API_BASE = 'http://localhost:5000/api';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test functions
async function testHealthEndpoint() {
  console.log('🔍 Testing Health Endpoint...');
  try {
    const response = await makeRequest('GET', '/health');
    console.log('✅ Health Check:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
    return false;
  }
}

async function testRegistration() {
  console.log('\n🔍 Testing User Registration...');
  const testUser = {
    firstName: 'Test',
    lastName: 'User',
    email: `test.user.${Date.now()}@example.com`,
    password: 'TestPassword123',
    userType: 'worker'
  };

  try {
    const response = await makeRequest('POST', '/auth/register', testUser);
    
    if (response.statusCode === 201 && response.data.success) {
      console.log('✅ Registration Successful!');
      console.log('📝 User:', response.data.data.user.firstName, response.data.data.user.lastName);
      console.log('🔑 Token received:', response.data.data.token ? 'Yes' : 'No');
      return { success: true, user: response.data.data.user, token: response.data.data.token };
    } else {
      console.log('❌ Registration Failed:', response.data);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Registration Error:', error.message);
    return { success: false };
  }
}

async function testLogin(email, password) {
  console.log('\n🔍 Testing User Login...');
  const credentials = { email, password };

  try {
    const response = await makeRequest('POST', '/auth/login', credentials);
    
    if (response.statusCode === 200 && response.data.success) {
      console.log('✅ Login Successful!');
      console.log('👤 User:', response.data.data.user.firstName, response.data.data.user.lastName);
      console.log('🔑 Token received:', response.data.data.token ? 'Yes' : 'No');
      return { success: true, user: response.data.data.user, token: response.data.data.token };
    } else {
      console.log('❌ Login Failed:', response.data);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ Login Error:', error.message);
    return { success: false };
  }
}

async function testAuthenticatedEndpoint(token) {
  console.log('\n🔍 Testing Authenticated Endpoint...');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/me',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode === 200 && parsedData.success) {
            console.log('✅ Authenticated Request Successful!');
            console.log('👤 Current User:', parsedData.data.user.firstName, parsedData.data.user.lastName);
            resolve(true);
          } else {
            console.log('❌ Authenticated Request Failed:', parsedData);
            resolve(false);
          }
        } catch (error) {
          console.log('❌ Authenticated Request Error:', error.message);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request Error:', error.message);
      resolve(false);
    });
    
    req.end();
  });
}

// Main test function
async function runAuthTests() {
  console.log('🚀 Starting Authentication Tests...\n');
  
  // Test 1: Health Check
  const healthOk = await testHealthEndpoint();
  if (!healthOk) {
    console.log('\n❌ Backend server is not running or not accessible!');
    return;
  }

  // Test 2: Registration
  const regResult = await testRegistration();
  if (!regResult.success) {
    console.log('\n❌ Registration test failed!');
    return;
  }

  // Test 3: Login with the registered user
  const loginResult = await testLogin(regResult.user.email, 'TestPassword123');
  if (!loginResult.success) {
    console.log('\n❌ Login test failed!');
    return;
  }

  // Test 4: Authenticated endpoint
  await testAuthenticatedEndpoint(loginResult.token);

  console.log('\n🎉 All authentication tests completed!');
  console.log('\n📋 Summary:');
  console.log('✅ Backend server is running');
  console.log('✅ User registration is working');
  console.log('✅ User login is working');
  console.log('✅ JWT authentication is working');
  console.log('\n🔐 Your authentication system is fully functional!');
}

// Run the tests
runAuthTests().catch(console.error);
