// Google Drive search API endpoint
module.exports = function handler(req, res) {
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
      console.log('🔍 Searching for:', query, 'in folder:', folderId);
      
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // Mock search results for now - we'll replace this with real Google Drive API
      const mockResults = [
        {
          id: 'search-result-1',
          name: `${query} - Artist 1.mp3`,
          type: 'file',
          size: '5242880',
          mimeType: 'audio/mpeg',
          extension: '.mp3',
          parents: [folderId || 'root']
        },
        {
          id: 'search-result-2', 
          name: `Best of ${query}.mp3`,
          type: 'file',
          size: '7340032',
          mimeType: 'audio/mpeg',
          extension: '.mp3',
          parents: [folderId || 'root']
        }
      ];
      
      console.log('✅ Returning search results:', mockResults.length);
      res.json({ files: mockResults });
    } catch (error) {
      console.error('❌ Error searching files:', error);
      res.status(500).json({ error: 'Failed to search files', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 