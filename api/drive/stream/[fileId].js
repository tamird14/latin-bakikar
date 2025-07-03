// Google Drive stream API endpoint
module.exports = function handler(req, res) {
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
    const fileId = req.query.fileId;
    console.log('🎵 Getting stream URL for file:', fileId);
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    // Return a mock stream URL for testing
    // In production, this would return actual Google Drive streaming URLs
    const streamUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    
    console.log('✅ Returning stream URL:', streamUrl);
    res.json({
      url: streamUrl,
      fileId: fileId
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 