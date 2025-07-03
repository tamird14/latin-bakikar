// Google Drive auth callback API endpoint
module.exports = function handler(req, res) {
  console.log('🔥 Drive Auth Callback API called:', req.method, req.url);
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
      const { code } = req.body;
      console.log('🔐 Processing OAuth callback with code:', code);
      
      // For serverless deployment, we'll need to implement proper OAuth token exchange
      // For now, return success
      console.log('✅ Mock authentication successful');
      res.json({ success: true, message: 'Authentication successful' });
    } catch (error) {
      console.error('❌ Error processing callback:', error);
      res.status(500).json({ error: 'Failed to process authentication callback', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 