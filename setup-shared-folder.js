#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const GoogleDriveService = require('./backend/googleDrive');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🎵 Shared Music Folder Setup');
console.log('============================\n');

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupSharedFolder() {
  try {
    console.log('📋 This will set up a shared Google Drive folder for music that everyone can access.');
    console.log('   No individual Google Drive authentication will be required for users.\n');

    // Step 1: Get Google Drive credentials
    console.log('🔐 STEP 1: Google Drive API Credentials');
    const clientId = await askQuestion('Enter your Google Client ID: ');
    const clientSecret = await askQuestion('Enter your Google Client Secret: ');
    
    if (!clientId || !clientSecret) {
      console.log('❌ Both Client ID and Client Secret are required');
      process.exit(1);
    }

    // Step 2: Get folder ID
    console.log('\n📁 STEP 2: Shared Music Folder');
    console.log('   You need to create a shared Google Drive folder for music files.');
    console.log('   1. Go to Google Drive (drive.google.com)');
    console.log('   2. Create a new folder (e.g., "Music Stream Shared")');
    console.log('   3. Right-click folder → Share → Anyone with link can view');
    console.log('   4. Copy the folder ID from the URL');
    console.log('   5. URL format: https://drive.google.com/drive/folders/FOLDER_ID_HERE');
    console.log('');
    
    const folderId = await askQuestion('Enter the shared folder ID: ');
    
    if (!folderId) {
      console.log('❌ Folder ID is required');
      process.exit(1);
    }

    // Step 3: Generate OAuth URL for one-time authentication
    console.log('\n🔗 STEP 3: One-Time Authentication');
    console.log('   We need to authenticate once to get a refresh token...');
    
    const driveService = new GoogleDriveService();
    const credentials = {
      web: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: 'http://localhost:3000/auth/callback'
      }
    };
    
    await driveService.authenticate(credentials);
    const authUrl = driveService.getAuthUrl();
    
    console.log('\n🌐 Please visit this URL to authorize the app:');
    console.log(authUrl);
    console.log('\nAfter authorization, you\'ll be redirected to a page with an authorization code.');
    
    const authCode = await askQuestion('\nEnter the authorization code from the redirect URL: ');
    
    if (!authCode) {
      console.log('❌ Authorization code is required');
      process.exit(1);
    }

    // Get tokens
    const tokens = await driveService.getAccessToken(authCode);
    
    // Step 4: Update .env file
    console.log('\n📝 STEP 4: Updating Configuration');
    
    const envPath = './backend/.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update all credentials
    envContent = envContent.replace(/GOOGLE_CLIENT_ID=.*/, `GOOGLE_CLIENT_ID=${clientId}`);
    envContent = envContent.replace(/GOOGLE_CLIENT_SECRET=.*/, `GOOGLE_CLIENT_SECRET=${clientSecret}`);
    envContent = envContent.replace(/GOOGLE_DRIVE_FOLDER_ID=.*/, `GOOGLE_DRIVE_FOLDER_ID=${folderId}`);
    envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Setup Complete!');
    console.log('\n📋 What was configured:');
    console.log(`   • Shared folder ID: ${folderId}`);
    console.log(`   • Server-side authentication: Enabled`);
    console.log(`   • User authentication: Disabled (no login required)`);
    
    console.log('\n🚀 Next steps:');
    console.log('1. Add music files to your shared Google Drive folder');
    console.log('2. Start the servers:');
    console.log('   - Backend: cd backend && npm start');
    console.log('   - Frontend: cd frontend && npm start');
    console.log('3. Visit: http://localhost:3000');
    console.log('4. Music files will be automatically available!');
    
    console.log('\n📤 Share with friends:');
    console.log('   • Send them the session ID to join');
    console.log('   • They can add music to the shared folder');
    console.log('   • No Google Drive login required for them!');
    
  } catch (error) {
    console.log('\n❌ Setup failed:', error.message);
    if (error.message.includes('invalid_grant')) {
      console.log('💡 Try generating a new authorization code (the old one may have expired)');
    }
  } finally {
    rl.close();
  }
}

setupSharedFolder(); 