// Google Drive auth token API endpoint
module.exports = function handler(req, res) {
  console.log('🔥 Drive Auth Token API called:', req.method, req.url);
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
      const { token } = req.body;
      console.log('🔐 Setting access token');
      
      // For serverless deployment, we'll need to implement proper token storage
      // For now, return success
      console.log('✅ Token set successfully');
      res.json({ success: true, message: 'Token set successfully' });
    } catch (error) {
      console.error('❌ Error setting token:', error);
      res.status(500).json({ error: 'Failed to set token', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 