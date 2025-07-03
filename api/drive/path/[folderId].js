// Google Drive folder path API endpoint
module.exports = function handler(req, res) {
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
      
      // Mock folder path - we'll replace this with real Google Drive API
      let mockPath;
      
      if (folderId === 'root') {
        mockPath = [
          { id: 'root', name: 'My Drive' }
        ];
      } else if (folderId === 'music') {
        mockPath = [
          { id: 'root', name: 'My Drive' },
          { id: 'music', name: 'Music' }
        ];
      } else if (folderId === 'albums') {
        mockPath = [
          { id: 'root', name: 'My Drive' },
          { id: 'music', name: 'Music' },
          { id: 'albums', name: 'Albums' }
        ];
      } else {
        // Default path for any other folder
        mockPath = [
          { id: 'root', name: 'My Drive' },
          { id: folderId, name: `Folder ${folderId}` }
        ];
      }
      
      console.log('✅ Returning folder path:', mockPath);
      res.json({ path: mockPath });
    } catch (error) {
      console.error('❌ Error getting folder path:', error);
      res.status(500).json({ error: 'Failed to get folder path', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 