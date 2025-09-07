const mongoose = require('mongoose');
require('dotenv').config();

async function testMongoConnection() {
  try {
    console.log('🔌 Testing MongoDB Atlas connection...');
    console.log('Connection String (censored):', process.env.MONGODB_URI.replace(/:[^:]*@/, ':***@'));
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ MongoDB Atlas connected successfully!');
    
    // Test database operations
    const db = mongoose.connection.db;
    const admin = db.admin();
    const result = await admin.ping();
    console.log('📊 Database ping result:', result);
    
    // List available databases
    const databases = await admin.listDatabases();
    console.log('📋 Available databases:', databases.databases.map(db => db.name));
    
    await mongoose.connection.close();
    console.log('🔌 Connection closed successfully.');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    if (error.code === 8000) {
      console.log('\n🔧 Troubleshooting steps:');
      console.log('1. Check if your username and password are correct');
      console.log('2. Ensure your IP address is whitelisted in MongoDB Atlas');
      console.log('3. Verify the cluster is running and accessible');
      console.log('4. Check if special characters in password are URL-encoded');
    }
    process.exit(1);
  }
}

testMongoConnection();
