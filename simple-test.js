const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

// Simple test to check if cover photo endpoints are working
async function simpleTest() {
  console.log('🧪 Simple Cover Photo Test...\n');

  try {
    // Test 1: API Health
    console.log('1. Testing API Health...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ API Health:', healthResponse.data.status);

    // Test 2: Check if auth endpoint responds correctly
    console.log('\n2. Testing Auth Endpoint Structure...');
    try {
      const authResponse = await axios.get(`${API_BASE_URL}/auth/me`);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Auth endpoint working (requires authentication)');
      } else {
        console.log('❌ Unexpected auth endpoint error:', error.response?.status);
      }
    }

    // Test 3: Check media endpoints
    console.log('\n3. Testing Media Endpoints...');
    try {
      const mediaResponse = await axios.post(`${API_BASE_URL}/media/cover-photo`, {});
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Cover photo endpoint working (requires authentication)');
      } else if (error.response?.status === 400) {
        console.log('✅ Cover photo endpoint working (validation active)');
      } else {
        console.log('❌ Unexpected media endpoint error:', error.response?.status);
      }
    }

    console.log('\n📋 Quick Fix Suggestions:');
    console.log('1. Open your browser to http://localhost:5173/');
    console.log('2. Go to the profile page');
    console.log('3. Open browser developer tools (F12)');
    console.log('4. Check the Console tab for any errors');
    console.log('5. Look for the debug logs from ProfileHeader component');
    console.log('6. Try uploading a new cover photo to see if it updates');
    
    console.log('\n🔍 Frontend Debug Info:');
    console.log('- The ProfileHeader component now has debug logs');
    console.log('- Check console.log outputs for "ProfileHeader profileData"');
    console.log('- Check console.log outputs for "Cover photo URL being used"');
    console.log('- Fixed cover photo mapping from user.coverPhoto in ClientProfile');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the simple test
simpleTest();
