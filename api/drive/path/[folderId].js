// Google Drive folder path API endpoint
const GoogleDriveService = require('../../googleDriveService');

module.exports = async function handler(req, res) {
  console.log('🔥 Drive Path API called:', req.method, req.url);
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
      const folderId = req.query.folderId;
      console.log('🔍 Getting path for folder:', folderId);
      
      if (!folderId) {
        return res.status(400).json({ error: 'Folder ID is required' });
      }
      
      // Initialize Google Drive service
      const driveService = new GoogleDriveService();
      
      // Get real folder path from Google Drive
      const folderPath = await driveService.getFolderPath(folderId);
      
      console.log('✅ Returning folder path:', folderPath);
      res.json({ path: folderPath });
    } catch (error) {
      console.error('❌ Error getting folder path:', error);
      res.status(500).json({ error: 'Failed to get folder path', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 