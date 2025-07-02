const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

async function testDriveAccess() {
  console.log('🔍 Testing Google Drive API Access...\n');
  
  try {
    // Set up authentication
    const auth = new google.auth.GoogleAuth({
      keyFile: './service-account.json',
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const drive = google.drive({ version: 'v3', auth });
    
    console.log('✅ Authentication setup complete');
    
    // Test 1: Get folder info
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log(`📁 Testing access to folder: ${folderId}`);
    
    try {
      const folderInfo = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, mimeType, permissions'
      });
      
      console.log('✅ Folder accessible!');
      console.log(`   Name: ${folderInfo.data.name}`);
      console.log(`   Type: ${folderInfo.data.mimeType}`);
      
    } catch (folderError) {
      console.log('❌ Cannot access folder:');
      console.log(`   Error: ${folderError.message}`);
      console.log(`   Code: ${folderError.code}`);
      
      if (folderError.code === 404) {
        console.log('\n💡 This means the service account cannot see the folder.');
        console.log('   You need to share the folder with the service account email.');
      }
      return;
    }
    
    // Test 2: List files in folder
    console.log('\n📋 Testing file listing...');
    
    try {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 10
      });
      
      console.log('✅ File listing successful!');
      console.log(`   Found ${response.data.files.length} items`);
      
      if (response.data.files.length > 0) {
        console.log('\n📁 Items in folder:');
        response.data.files.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.name} (${file.mimeType})`);
        });
      } else {
        console.log('   (Folder is empty - try adding some music files)');
      }
      
    } catch (listError) {
      console.log('❌ Cannot list files:');
      console.log(`   Error: ${listError.message}`);
      console.log(`   Code: ${listError.code}`);
    }
    
  } catch (authError) {
    console.log('❌ Authentication failed:');
    console.log(`   Error: ${authError.message}`);
  }
}

// Run the test
testDriveAccess().then(() => {
  console.log('\n🎯 Debug complete!');
}).catch(error => {
  console.log('\n💥 Debug failed:', error.message);
}); 