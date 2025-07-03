// Google Drive files API endpoint
module.exports = function handler(req, res) {
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
    // Mock file listing for testing
    const mockFiles = [
      {
        id: 'mock-file-1',
        name: 'Sample Song 1.mp3',
        mimeType: 'audio/mpeg',
        size: '5242880',
        modifiedTime: '2023-01-01T00:00:00.000Z'
      },
      {
        id: 'mock-file-2', 
        name: 'Sample Song 2.mp3',
        mimeType: 'audio/mpeg',
        size: '4194304',
        modifiedTime: '2023-01-02T00:00:00.000Z'
      }
    ];

    console.log('✅ Returning mock files');
    res.json({
      files: mockFiles,
      nextPageToken: null
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 