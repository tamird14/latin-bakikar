// Simple Google Drive API mock for testing
// In a real implementation, this would integrate with Google Drive API

module.exports = function handler(req, res) {
  console.log('🔥 Drive API called:', req.method, req.url);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extract path from URL
  const path = req.url.replace('/api/drive', '');
  console.log('🔍 Drive API path:', path);

  if (path === '/files' || path.startsWith('/files/')) {
    // Mock file listing
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

    res.json({
      files: mockFiles,
      nextPageToken: null
    });
  } else if (path.startsWith('/stream/')) {
    // Mock stream URL
    const fileId = path.replace('/stream/', '');
    console.log('🎵 Getting stream URL for file:', fileId);
    
    // Return a mock stream URL (you'd replace this with actual Google Drive streaming)
    res.json({
      url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`,
      fileId: fileId
    });
  } else {
    res.status(404).json({ error: 'Drive API endpoint not found' });
  }
}; 