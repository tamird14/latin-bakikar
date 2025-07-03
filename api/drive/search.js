// Google Drive search API endpoint
const GoogleDriveService = require('../googleDriveService');

module.exports = async function handler(req, res) {
  console.log('🔥 Drive Search API called:', req.method, req.url);
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
      const { q: query, folderId } = req.query;
      console.log('🔍 Searching for:', query, 'in folder:', folderId || 'shared folder');
      
      if (!query || query.trim() === '') {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // Initialize Google Drive service
      const driveService = new GoogleDriveService();
      
      // Get real search results from Google Drive
      console.log('🔍 Starting search with query:', JSON.stringify(query));
      const searchResults = await driveService.searchMusicFiles(query, folderId);
      
      console.log('🔍 Search results found:', searchResults.length);
      if (searchResults.length > 0) {
        console.log('🔍 First few results:', searchResults.slice(0, 3).map(f => f.name));
      }
      
      console.log('✅ Returning search results:', searchResults.length);
      res.json({ files: searchResults });
    } catch (error) {
      console.error('❌ Error searching files:', error);
      res.status(500).json({ error: 'Failed to search files', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 