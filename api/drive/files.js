// Google Drive files API endpoint
const GoogleDriveService = require('../googleDriveService');

module.exports = async function handler(req, res) {
  console.log('🔥 Drive Files API called:', req.method, req.url);
  
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
      // Extract folder ID from URL path if present
      const urlParts = req.url.split('/');
      let folderId = null; // Use null to default to shared folder
      
      console.log('🔍 URL parts:', urlParts);
      console.log('🔍 Full URL:', req.url);
      
      // Check if folder ID is in URL path (/api/drive/files/folderId)
      // URL structure: ['', 'api', 'drive', 'files', 'folderId']
      if (urlParts.length >= 5 && urlParts[4] && urlParts[4] !== '') {
        folderId = urlParts[4];
      }
      // Also check query parameter for backward compatibility
      if (req.query && req.query.folderId) {
        folderId = req.query.folderId;
      }
      
      console.log('📁 Getting files for folder:', folderId || 'shared folder');
      
      // Initialize Google Drive service
      const driveService = new GoogleDriveService();
      
      // Get real files from Google Drive
      const result = await driveService.listFiles(folderId);
      
      // Combine folders and files into a single array like the original API
      const allFiles = [...result.folders, ...result.files];

      console.log('✅ Returning files:', { folders: result.folders.length, files: result.files.length });
      res.json({
        files: allFiles,
        nextPageToken: result.nextPageToken
      });
    } catch (error) {
      console.error('❌ Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 