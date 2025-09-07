// Quick test to check current user data after upload
const http = require('http');

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
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

async function testLogin() {
  console.log('🔍 Testing with existing user...');
  const credentials = { 
    email: 'upload.test.1756015371549@example.com', 
    password: 'TestPassword123' 
  };

  try {
    const response = await makeRequest('POST', '/auth/login', credentials);
    
    if (response.statusCode === 200 && response.data.success) {
      console.log('✅ Login Successful!');
      const token = response.data.data.token;
      
      // Get current user data
      const userResponse = await makeRequest('GET', '/auth/me', null, {
        'Authorization': `Bearer ${token}`
      });
      
      console.log('👤 Current User Data:');
      console.log(JSON.stringify(userResponse.data.data, null, 2));
      
      return token;
    } else {
      console.log('❌ Login Failed:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

testLogin().catch(console.error);
