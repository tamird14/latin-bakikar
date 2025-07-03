// Google Drive auth init API endpoint
module.exports = function handler(req, res) {
  console.log('🔥 Drive Auth Init API called:', req.method, req.url);
  console.log('🔥 Request body:', req.body);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { credentials } = req.body;
      console.log('🔐 Initializing Google Drive auth');
      
      // For serverless deployment, we'll need to implement proper OAuth flow
      // For now, return a mock auth URL
      const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?mock=true';
      
      console.log('✅ Returning auth URL');
      res.json({ authUrl: mockAuthUrl });
    } catch (error) {
      console.error('❌ Error initializing auth:', error);
      res.status(500).json({ error: 'Failed to initialize authentication', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 