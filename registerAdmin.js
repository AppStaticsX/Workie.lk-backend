const https = require('https');
const http = require('http');

// Admin registration function
async function registerAdmin() {
  try {
    const adminData = {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@workie.lk',
      password: 'SuperAdmin123!',
      userType: 'admin',
      phone: '+94771234567'
    };

    console.log('🔧 Registering admin user...');
    console.log('Email:', adminData.email);
    console.log('Password:', adminData.password);

    const postData = JSON.stringify(adminData);

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          if (result.success) {
            console.log('✅ Admin user registered successfully!');
            console.log('User ID:', result.data.user._id);
            console.log('User Type:', result.data.user.userType);
            console.log('\n🔐 Login credentials:');
            console.log('Email:', adminData.email);
            console.log('Password:', adminData.password);
            console.log('\n🌐 Login at: http://localhost:5173/loginpage');
          } else {
            console.log('❌ Registration failed:', result.message);
            if (result.message.includes('already exists')) {
              console.log('\n💡 User already exists. Try logging in with:');
              console.log('Email:', adminData.email);
              console.log('Password:', adminData.password);
            }
          }
        } catch (parseError) {
          console.log('❌ Error parsing response:', parseError.message);
          console.log('Raw response:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      console.log('\n💡 Make sure the backend server is running on port 5000');
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

registerAdmin();
