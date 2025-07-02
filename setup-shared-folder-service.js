#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🎵 Shared Music Folder Setup (Service Account)');
console.log('===============================================\n');

console.log('🔐 This method uses a Google Service Account to avoid OAuth issues.');
console.log('   Service accounts don\'t need user consent and work automatically.\n');

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function setupWithServiceAccount() {
  try {
    console.log('📋 STEP 1: Create Google Service Account');
    console.log('========================================');
    console.log('1. Go to: https://console.cloud.google.com/');
    console.log('2. Select your project');
    console.log('3. Navigate to: APIs & Services → Credentials');
    console.log('4. Click: + CREATE CREDENTIALS → Service account');
    console.log('5. Enter name: "Music Stream Service"');
    console.log('6. Click CREATE AND CONTINUE');
    console.log('7. Skip role assignment → Click CONTINUE → DONE');
    console.log('8. Click on the created service account');
    console.log('9. Go to Keys tab → ADD KEY → Create new key');
    console.log('10. Choose JSON → Click CREATE');
    console.log('11. Save the downloaded JSON file\n');

    const continueSetup = await askQuestion('Have you downloaded the service account JSON file? (y/n): ');
    if (continueSetup.toLowerCase() !== 'y') {
      console.log('⏸️  Please complete the service account setup first.');
      process.exit(0);
    }

    console.log('\n📁 STEP 2: Create Shared Music Folder');
    console.log('=====================================');
    console.log('1. Go to Google Drive (drive.google.com)');
    console.log('2. Create a new folder (e.g., "Music Stream Shared")');
    console.log('3. Right-click folder → Share');
    console.log('4. Add the service account email as an editor');
    console.log('   (Find the email in the downloaded JSON file - it ends with .iam.gserviceaccount.com)');
    console.log('5. Set sharing to "Anyone with link can view" (optional, for easier music uploads)');
    console.log('6. Copy the folder ID from the URL\n');

    const folderId = await askQuestion('Enter the shared folder ID: ');
    if (!folderId) {
      console.log('❌ Folder ID is required');
      process.exit(1);
    }

    console.log('\n📝 STEP 3: Configure Service Account');
    console.log('====================================');
    
    const jsonPath = await askQuestion('Enter the path to your service account JSON file: ');
    if (!fs.existsSync(jsonPath)) {
      console.log('❌ JSON file not found. Please check the path.');
      process.exit(1);
    }

    // Read and validate the service account file
    const serviceAccountData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    if (!serviceAccountData.client_email || !serviceAccountData.private_key) {
      console.log('❌ Invalid service account file');
      process.exit(1);
    }

    console.log(`✅ Service account email: ${serviceAccountData.client_email}`);

    // Copy the service account file to the backend directory
    const targetPath = path.join(__dirname, 'backend', 'service-account.json');
    fs.copyFileSync(jsonPath, targetPath);

    // Update .env file
    const envPath = './backend/.env';
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update configuration for service account
    envContent = envContent.replace(/GOOGLE_CLIENT_ID=.*/, `GOOGLE_CLIENT_ID=${serviceAccountData.client_id}`);
    envContent = envContent.replace(/GOOGLE_CLIENT_SECRET=.*/, `GOOGLE_CLIENT_SECRET=service_account`);
    envContent = envContent.replace(/GOOGLE_DRIVE_FOLDER_ID=.*/, `GOOGLE_DRIVE_FOLDER_ID=${folderId}`);
    envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json`);
    
    // Add service account configuration
    if (!envContent.includes('GOOGLE_SERVICE_ACCOUNT_PATH')) {
      envContent += '\n# Service Account Configuration\n';
      envContent += 'GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json\n';
    }

    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Setup Complete!');
    console.log('\n📋 What was configured:');
    console.log(`   • Service account: ${serviceAccountData.client_email}`);
    console.log(`   • Shared folder ID: ${folderId}`);
    console.log(`   • Authentication: Service Account (no OAuth required)`);
    
    console.log('\n🚀 Next steps:');
    console.log('1. Add music files to your shared Google Drive folder');
    console.log('2. Start the servers:');
    console.log('   - Backend: cd backend && npm start');
    console.log('   - Frontend: cd frontend && npm start');
    console.log('3. Visit: http://localhost:3000');
    console.log('4. Music files will be automatically available!');
    
    console.log('\n📤 Share with friends:');
    console.log('   • Give them the Google Drive folder link to add music');
    console.log('   • Share session IDs to listen together');
    console.log('   • No authentication required for users!');
    
    console.log('\n🔗 Shared folder link for adding music:');
    console.log(`   https://drive.google.com/drive/folders/${folderId}`);
    
  } catch (error) {
    console.log('\n❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

setupWithServiceAccount(); 