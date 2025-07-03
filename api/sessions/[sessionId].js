// Get session by ID API endpoint
module.exports = function handler(req, res) {
  console.log('🔥 Session ID API called:', req.method, req.url);
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
      const sessionId = req.query.sessionId;
      console.log('🔍 Looking for session:', sessionId);
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      // For demo purposes, return a mock session for any ID
      // In a real app, you'd check a database
      const mockSession = {
        id: sessionId,
        name: `Demo Session ${sessionId}`,
        currentSong: null,
        queue: [],
        isPlaying: false,
        clientCount: 1
      };
      
      console.log('✅ Returning mock session:', mockSession.id);
      res.json(mockSession);
    } catch (error) {
      console.error('❌ Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 