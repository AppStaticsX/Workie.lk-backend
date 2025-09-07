const mongoose = require('mongoose');
const User = require('./models/User');
const Profile = require('./models/Profile');

// Test database connectivity and create sample data
async function setupTestData() {
  try {
    console.log('🔍 Checking database connection and data...');
    
    // Check users count
    const userCount = await User.countDocuments();
    console.log(`📊 Users in database: ${userCount}`);
    
    // Check profiles count
    const profileCount = await Profile.countDocuments();
    console.log(`📊 Profiles in database: ${profileCount}`);
    
    if (userCount === 0) {
      console.log('📝 Creating sample users and profiles...');
      
      // Create sample users
      const sampleUsers = [
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@test.com',
          password: 'password123',
          userType: 'worker',
          isActive: true,
          isEmailVerified: true
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@test.com',
          password: 'password123',
          userType: 'worker',
          isActive: true,
          isEmailVerified: true
        },
        {
          firstName: 'Mike',
          lastName: 'Johnson',
          email: 'mike.johnson@test.com',
          password: 'password123',
          userType: 'client',
          isActive: true,
          isEmailVerified: true
        }
      ];
      
      for (const userData of sampleUsers) {
        const user = await User.create(userData);
        
        // Create profile for each user
        await Profile.create({
          user: user._id,
          bio: `I am a professional ${userData.userType}`,
          skills: userData.userType === 'worker' ? [
            { name: 'General Work', level: 'intermediate', yearsOfExperience: 3 }
          ] : [],
          availability: {
            status: 'available',
            hoursPerWeek: 40
          }
        });
        
        console.log(`✅ Created user: ${userData.firstName} ${userData.lastName}`);
      }
      
      console.log('🎉 Sample data created successfully!');
    } else {
      console.log('✅ Database already has data');
    }
    
    // Test the connections endpoint data
    console.log('\n🧪 Testing connections data...');
    const workers = await User.find({ userType: 'worker' }).limit(5);
    console.log(`👷 Workers found: ${workers.length}`);
    
    console.log('\n📊 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error);
  }
}

module.exports = { setupTestData };
