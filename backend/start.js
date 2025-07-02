const fs = require('fs');
const path = require('path');

console.log('🎵 Latin BaKikar - Backend Server Starting...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ Missing .env file!');
  console.log('📝 Please create backend/.env with your Google Drive credentials');
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

// Check if Google Drive credentials are configured
if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id_here') {
  console.log('⚠️  Google Drive credentials not configured!');
  console.log('');
  console.log('📋 To complete setup:');
  console.log('1. Get credentials from: https://console.cloud.google.com/');
  console.log('2. Update backend/.env file with your real credentials');
  console.log('3. Restart the server');
  console.log('');
  console.log('🚀 Server will start anyway for testing...\n');
}

// Check port availability
const port = process.env.PORT || 5001;
const net = require('net');
const server = net.createServer();

server.listen(port, () => {
  server.close(() => {
    console.log(`✅ Port ${port} is available`);
    console.log('🔄 Starting main server...\n');
    
    // Start the main server
    require('./server.js');
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`❌ Port ${port} is already in use!`);
    console.log('💡 Try: pkill -f "node.*server.js" to stop other instances');
    process.exit(1);
  } else {
    console.error('❌ Port check failed:', err.message);
    process.exit(1);
  }
}); 