#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🔍 Music Stream App - Setup Checker\n');

let allGood = true;

// Check if we're in the right directory
if (!fs.existsSync('./backend') || !fs.existsSync('./frontend')) {
  console.log('❌ Please run this from the music-stream-app root directory');
  process.exit(1);
}

// Check backend dependencies
console.log('📦 Checking backend dependencies...');
if (fs.existsSync('./backend/node_modules')) {
  console.log('✅ Backend dependencies installed');
} else {
  console.log('❌ Backend dependencies missing');
  console.log('   Run: cd backend && npm install');
  allGood = false;
}

// Check frontend dependencies
console.log('📦 Checking frontend dependencies...');
if (fs.existsSync('./frontend/node_modules')) {
  console.log('✅ Frontend dependencies installed');
} else {
  console.log('❌ Frontend dependencies missing');
  console.log('   Run: cd frontend && npm install');
  allGood = false;
}

// Check .env file
console.log('⚙️  Checking environment configuration...');
const envPath = './backend/.env';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('your_google_client_id_here')) {
    console.log('⚠️  .env file exists but Google Drive credentials need to be updated');
    console.log('   Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env');
  } else {
    console.log('✅ Environment file configured');
  }
} else {
  console.log('❌ Missing .env file');
  console.log('   Create backend/.env with your Google Drive credentials');
  allGood = false;
}

// Check if servers are running
console.log('🌐 Checking if servers are running...');
exec('curl -s http://localhost:5001/api/health', (error, stdout) => {
  if (stdout && stdout.includes('ok')) {
    console.log('✅ Backend server is running');
  } else {
    console.log('⚠️  Backend server not running');
    console.log('   Start with: cd backend && npm start');
  }
});

exec('curl -s http://localhost:3000', (error, stdout) => {
  if (!error) {
    console.log('✅ Frontend server is running');
  } else {
    console.log('⚠️  Frontend server not running');
    console.log('   Start with: cd frontend && npm start');
  }
});

console.log('\n🎯 Summary:');
if (allGood) {
  console.log('✅ Basic setup looks good!');
  console.log('🚀 Ready to start the servers');
} else {
  console.log('⚠️  Some setup steps are needed (see above)');
}

console.log('\n📋 Quick Start Commands:');
console.log('Backend:  cd backend && npm start');
console.log('Frontend: cd frontend && npm start');
console.log('Browser:  http://localhost:3000');
console.log('\n💡 Run this checker anytime with: node check-setup.js'); 