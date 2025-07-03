// Store active sessions (in a real app, you'd use a database)
const sessions = new Map();

// Simple ID generator (replacing uuid)
function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

module.exports = function handler(req, res) {
  console.log('🔥 API called:', req.method, req.url);
  console.log('🔥 Request body:', req.body);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      // Create new session
      console.log('📝 Creating session with body:', req.body);
      
      const sessionName = req.body?.name || 'Music Session';
      console.log('📝 Session name:', sessionName);
      
      const sessionId = generateSessionId();
      const session = {
        id: sessionId,
        hostId: null,
        name: sessionName,
        currentSong: null,
        queue: [],
        isPlaying: false,
        clients: new Set()
      };
      
      sessions.set(sessionId, session);
      console.log('✅ Session created successfully:', sessionId);
      res.json({ sessionId, message: 'Session created successfully' });
    } catch (error) {
      console.error('❌ Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session', details: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      // Get session info
      const sessionId = req.query.sessionId;
      console.log('🔍 Looking for session:', sessionId);
      
      const session = sessions.get(sessionId);
      
      if (!session) {
        console.log('❌ Session not found:', sessionId);
        return res.status(404).json({ error: 'Session not found' });
      }
      
      console.log('✅ Session found:', session.id);
      res.json({
        id: session.id,
        name: session.name,
        currentSong: session.currentSong,
        queue: session.queue,
        isPlaying: session.isPlaying,
        clientCount: session.clients.size
      });
    } catch (error) {
      console.error('❌ Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
