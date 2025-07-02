#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 Google Drive Credentials Updater');
console.log('===================================\n');

console.log('📋 You need to provide your Google Cloud credentials:');
console.log('   • Client ID (ends with .apps.googleusercontent.com)');
console.log('   • Client Secret (starts with GOCSPX-)\n');

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function updateCredentials() {
  try {
    const clientId = await askQuestion('Enter your Google Client ID: ');
    const clientSecret = await askQuestion('Enter your Google Client Secret: ');
    
    if (!clientId || !clientSecret) {
      console.log('❌ Both Client ID and Client Secret are required');
      process.exit(1);
    }
    
    // Validate format
    if (!clientId.includes('.apps.googleusercontent.com')) {
      console.log('⚠️  Warning: Client ID doesn\'t look correct (should end with .apps.googleusercontent.com)');
    }
    
    if (!clientSecret.startsWith('GOCSPX-')) {
      console.log('⚠️  Warning: Client Secret doesn\'t look correct (should start with GOCSPX-)');
    }
    
    // Read current .env file
    const envPath = './backend/.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update credentials
    envContent = envContent.replace(
      /GOOGLE_CLIENT_ID=.*/,
      `GOOGLE_CLIENT_ID=${clientId}`
    );
    
    envContent = envContent.replace(
      /GOOGLE_CLIENT_SECRET=.*/,
      `GOOGLE_CLIENT_SECRET=${clientSecret}`
    );
    
    // Write updated file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Credentials updated successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start backend server: cd backend && npm start');
    console.log('2. Start frontend server: cd frontend && npm start');
    console.log('3. Visit: http://localhost:3000');
    console.log('4. Click "Connect with Google Drive"');
    
  } catch (error) {
    console.log('❌ Error updating credentials:', error.message);
  } finally {
    rl.close();
  }
}

updateCredentials(); 