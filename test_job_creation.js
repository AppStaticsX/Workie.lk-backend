const mongoose = require('mongoose');
const Job = require('./models/Job');

// Test data that matches what the Flutter client would send
const testJobData = {
  title: 'Test Construction Job',
  description: 'This is a test job description for construction work. It needs to be at least 20 characters long to pass validation.',
  category: 'carpentry',
  budget: {
    amount: 5000,
    currency: 'LKR',
    type: 'fixed'
  },
  location: {
    address: '123 Test Street, Colombo',
    city: 'Colombo'
  },
  contactInfo: {
    name: 'John Doe',
    phone: '0771234567',
    whatsapp: '0771234567',
    email: 'john@example.com'
  },
  requirements: ['Materials not provided - worker should arrange'],
  skills: ['Carpentry'],
  urgency: 'medium',
  experienceLevel: 'any',
  isRemote: false,
  maxApplicants: 50,
  duration: {
    estimated: '5 days',
    isFlexible: true
  },
  client: new mongoose.Types.ObjectId() // Mock client ID
};

// Connect to MongoDB and test job creation
async function testJobCreation() {
  try {
    console.log('Testing job creation with data:');
    console.log(JSON.stringify(testJobData, null, 2));
    
    // Validate the job data against the schema without saving
    const job = new Job(testJobData);
    const validationError = job.validateSync();
    
    if (validationError) {
      console.error('Validation failed:');
      Object.values(validationError.errors).forEach(err => {
        console.error(`- ${err.path}: ${err.message}`);
      });
    } else {
      console.log('✅ Job data validation passed!');
      console.log('Job would be created successfully with this data structure.');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

module.exports = { testJobCreation, testJobData };

// Run test if this file is executed directly
if (require.main === module) {
  testJobCreation();
}