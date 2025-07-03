// Google Drive stream API endpoint
const GoogleDriveService = require('../../googleDriveService');

module.exports = async function handler(req, res) {
  console.log('🔥 Drive Stream API called:', req.method, req.url);
  console.log('🔥 Query params:', req.query);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      // Extract fileId from URL path: /api/drive/stream/[fileId]
      const urlParts = req.url.split('/');
      const fileId = urlParts[urlParts.length - 1];
      console.log('🎵 Getting stream URL for file:', fileId);
      
      if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
      }
      
      // Initialize Google Drive service
      const driveService = new GoogleDriveService();
      
      // Get real stream data from Google Drive
      const streamData = await driveService.getFileStreamUrl(fileId);
      
      // Return the streaming URL for the client
      console.log('✅ Returning stream data for:', fileId);
      res.json({
        url: `https://drive.google.com/uc?id=${fileId}&export=download`,
        fileId: fileId,
        name: streamData.name,
        mimeType: streamData.mimeType,
        size: streamData.size
      });
    } catch (error) {
      console.error('❌ Error getting stream URL:', error);
      res.status(500).json({ error: 'Failed to get stream URL', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 