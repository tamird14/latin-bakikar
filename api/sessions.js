const { v4: uuidv4 } = require('uuid');

// Store active sessions (in a real app, you'd use a database)
const sessions = new Map();

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    // Create new session
    const sessionId = uuidv4().substring(0, 8);
    const session = {
      id: sessionId,
      hostId: null,
      name: req.body.name || 'Music Session',
      currentSong: null,
      queue: [],
      isPlaying: false,
      clients: new Set()
    };
    
    sessions.set(sessionId, session);
    res.json({ sessionId, message: 'Session created successfully' });
  } else if (req.method === 'GET') {
    // Get session info
    const sessionId = req.query.sessionId;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      id: session.id,
      name: session.name,
      currentSong: session.currentSong,
      queue: session.queue,
      isPlaying: session.isPlaying,
      clientCount: session.clients.size
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
