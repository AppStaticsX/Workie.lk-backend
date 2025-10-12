#!/usr/bin/env node

/**
 * Workie Email Fix Utility
 * This script helps diagnose and fix common email issues
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

const log = (color, message) => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Main email fix utility
const runEmailFix = async () => {
  console.clear();
  log('cyan', '='.repeat(50));
  log('cyan', '     WORKIE EMAIL SERVICE FIX UTILITY');
  log('cyan', '='.repeat(50));
  console.log();
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    log('red', '❌ .env file not found!');
    console.log();
    console.log('Creating .env file with email configuration...');
    
    const email = await askQuestion('Enter your Gmail address: ');
    const appPassword = await askQuestion('Enter your Gmail app password (16 digits): ');
    
    const envContent = `# Environment Variables
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d

# Email Configuration - Gmail
EMAIL_PROVIDER=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=${email}
EMAIL_PASS=${appPassword}
EMAIL_FROM=${email}

# Frontend URL
CLIENT_URL=http://localhost:5173
`;
    
    fs.writeFileSync(envPath, envContent);
    log('green', '✅ .env file created successfully!');
    console.log();
  }
  
  // Load and check environment variables
  require('dotenv').config();
  
  log('blue', '1. Checking Email Configuration...');
  console.log();
  
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  if (!emailUser || !emailPass) {
    log('red', '❌ Email credentials missing in .env file');
    console.log();
    
    const shouldFix = await askQuestion('Would you like to set up email credentials now? (y/n): ');
    if (shouldFix.toLowerCase() === 'y') {
      await setupEmailCredentials();
    }
    return;
  }
  
  log('green', `✅ EMAIL_USER: ${emailUser}`);
  log('green', `✅ EMAIL_PASS: ${emailPass.substring(0, 4)}${'*'.repeat(emailPass.length - 4)}`);
  console.log();
  
  // Test email service
  log('blue', '2. Testing Email Service...');
  console.log();
  
  const shouldTestEmail = await askQuestion('Run email service test? (y/n): ');
  if (shouldTestEmail.toLowerCase() === 'y') {
    await runEmailTest();
  }
  
  // Show common fixes
  console.log();
  log('yellow', '='.repeat(50));
  log('yellow', '     COMMON EMAIL ISSUES & FIXES');
  log('yellow', '='.repeat(50));
  console.log();
  
  console.log('🔧 If emails are not being sent, try these fixes:');
  console.log();
  console.log('1. Gmail App Password Issues:');
  console.log('   • Make sure 2-Factor Authentication is enabled');
  console.log('   • Generate a new app password: https://myaccount.google.com/apppasswords');
  console.log('   • Use the 16-digit app password, not your regular Gmail password');
  console.log();
  
  console.log('2. Gmail Security Settings:');
  console.log('   • Turn OFF "Less secure app access" (use app passwords instead)');
  console.log('   • Check if "Allow less secure apps" is disabled (recommended)');
  console.log();
  
  console.log('3. Network Issues:');
  console.log('   • Check if your firewall blocks port 587');
  console.log('   • Try a different network (some networks block SMTP)');
  console.log('   • Ensure your antivirus isn\'t blocking the connection');
  console.log();
  
  console.log('4. Quota Limits:');
  console.log('   • Gmail has sending limits (500 emails/day for regular accounts)');
  console.log('   • Wait if you\'ve exceeded daily limits');
  console.log();
  
  // Offer to run backend server test
  const shouldTestServer = await askQuestion('Test backend server and OTP endpoints? (y/n): ');
  if (shouldTestServer.toLowerCase() === 'y') {
    await runServerTest();
  }
  
  console.log();
  log('green', '✅ Email fix utility completed!');
  log('cyan', 'If you\'re still having issues, check the backend logs for detailed error messages.');
  
  rl.close();
};

// Helper function to ask questions
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Setup email credentials
const setupEmailCredentials = async () => {
  console.log();
  log('blue', 'Setting up Gmail credentials...');
  console.log();
  
  console.log('📋 Steps to get Gmail app password:');
  console.log('1. Go to https://myaccount.google.com/security');
  console.log('2. Enable 2-Step Verification');
  console.log('3. Go to https://myaccount.google.com/apppasswords');
  console.log('4. Select "Mail" and "Other (custom name)"');
  console.log('5. Enter "Workie App" as the name');
  console.log('6. Copy the 16-digit password');
  console.log();
  
  const email = await askQuestion('Enter your Gmail address: ');
  const appPassword = await askQuestion('Enter your Gmail app password (16 digits): ');
  
  // Update .env file
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update or add email configuration
  envContent = envContent.replace(/EMAIL_USER=.*/, `EMAIL_USER=${email}`);
  envContent = envContent.replace(/EMAIL_PASS=.*/, `EMAIL_PASS=${appPassword}`);
  envContent = envContent.replace(/EMAIL_FROM=.*/, `EMAIL_FROM=${email}`);
  
  // If not found, add them
  if (!envContent.includes('EMAIL_USER=')) {
    envContent += `\nEMAIL_USER=${email}`;
  }
  if (!envContent.includes('EMAIL_PASS=')) {
    envContent += `\nEMAIL_PASS=${appPassword}`;
  }
  if (!envContent.includes('EMAIL_FROM=')) {
    envContent += `\nEMAIL_FROM=${email}`;
  }
  
  fs.writeFileSync(envPath, envContent);
  log('green', '✅ Email credentials updated in .env file');
};

// Run email test
const runEmailTest = async () => {
  const { spawn } = require('child_process');
  
  console.log('Running email service test...');
  console.log();
  
  return new Promise((resolve) => {
    const testProcess = spawn('node', ['test-email-enhanced.js'], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    testProcess.on('close', (code) => {
      console.log();
      if (code === 0) {
        log('green', '✅ Email test completed successfully');
      } else {
        log('red', '❌ Email test failed');
      }
      resolve();
    });
    
    testProcess.on('error', (error) => {
      log('red', `❌ Failed to run email test: ${error.message}`);
      resolve();
    });
  });
};

// Run server test
const runServerTest = async () => {
  const { spawn } = require('child_process');
  
  console.log('Running server and OTP endpoints test...');
  console.log();
  
  return new Promise((resolve) => {
    const testProcess = spawn('node', ['test-otp-enhanced.js'], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    testProcess.on('close', (code) => {
      console.log();
      if (code === 0) {
        log('green', '✅ Server test completed successfully');
      } else {
        log('red', '❌ Server test failed');
      }
      resolve();
    });
    
    testProcess.on('error', (error) => {
      log('red', `❌ Failed to run server test: ${error.message}`);
      resolve();
    });
  });
};

// Error handling
process.on('uncaughtException', (error) => {
  log('red', `❌ Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('red', `❌ Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run the email fix utility
runEmailFix().catch((error) => {
  log('red', `❌ Email fix utility error: ${error.message}`);
  process.exit(1);
});