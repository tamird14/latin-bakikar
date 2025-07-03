// Store active sessions (in a real app, you'd use a database)
const sessions = new Map();

// Store client connections for each session
const sessionClients = new Map();

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

  // Check if this is a request for a specific session ID
  const urlParts = req.url.split('/');
  const isSessionIdRequest = urlParts.length > 3 && urlParts[3] && urlParts[3] !== '';
  
  if (req.method === 'GET' && isSessionIdRequest) {
    // Handle GET /api/sessions/{sessionId}
    try {
      const sessionId = urlParts[3];
      console.log('🔍 GET request for session:', sessionId);
      
      // Check if session exists in memory first
      const existingSession = sessions.get(sessionId);
      if (existingSession) {
        console.log('✅ Found existing session in memory:', existingSession.name);
        
        // Update client count from active connections
        const clients = sessionClients.get(sessionId) || new Set();
        
        res.json({
          id: existingSession.id,
          name: existingSession.name,
          currentSong: existingSession.currentSong,
          queue: existingSession.queue || [],
          isPlaying: existingSession.isPlaying || false,
          clientCount: clients.size,
          lastUpdate: existingSession.lastUpdate || Date.now()
        });
        return;
      }
      
      // If not in memory, create a default session with a better name
      // In production, this would query a database
      const defaultSession = {
        id: sessionId,
        name: `Session ${sessionId}`, // Better default name
        currentSong: null,
        queue: [],
        isPlaying: false,
        clientCount: 1,
        lastUpdate: Date.now()
      };
      
      console.log('✅ Returning default session for:', sessionId);
      res.json(defaultSession);
      return;
    } catch (error) {
      console.error('❌ Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session', details: error.message });
      return;
    }
  }

  if (req.method === 'POST') {
    // Check if this is an update request
    const isUpdateRequest = isSessionIdRequest && req.body && (req.body.action || req.body.queue !== undefined || req.body.currentSong !== undefined);
    
    if (isUpdateRequest) {
      // Handle session updates (queue, playback state, etc.)
      try {
        const sessionId = urlParts[3];
        console.log('🔄 Updating session:', sessionId, 'with:', req.body);
        
        let session = sessions.get(sessionId);
        if (!session) {
          // Create session if it doesn't exist
          session = {
            id: sessionId,
            name: `Session ${sessionId}`,
            currentSong: null,
            queue: [],
            isPlaying: false,
            lastUpdate: Date.now()
          };
        }
        
        // Update session data based on request
        if (req.body.action === 'join') {
          // Handle client joining
          const clientId = req.body.clientId || `client_${Date.now()}`;
          let clients = sessionClients.get(sessionId) || new Set();
          clients.add(clientId);
          sessionClients.set(sessionId, clients);
          console.log('👤 Client joined session:', sessionId, 'Total clients:', clients.size);
        }
        
        if (req.body.action === 'leave') {
          // Handle client leaving
          const clientId = req.body.clientId;
          if (clientId) {
            let clients = sessionClients.get(sessionId) || new Set();
            clients.delete(clientId);
            sessionClients.set(sessionId, clients);
            console.log('👤 Client left session:', sessionId, 'Total clients:', clients.size);
          }
        }
        
        if (req.body.queue !== undefined) {
          session.queue = req.body.queue;
          console.log('🎵 Updated queue, now has:', session.queue.length, 'songs');
        }
        
        if (req.body.currentSong !== undefined) {
          session.currentSong = req.body.currentSong;
          console.log('🎵 Updated current song:', session.currentSong?.name || 'none');
        }
        
        if (req.body.isPlaying !== undefined) {
          session.isPlaying = req.body.isPlaying;
          console.log('🎵 Updated playing state:', session.isPlaying);
        }
        
        session.lastUpdate = Date.now();
        sessions.set(sessionId, session);
        
        const clients = sessionClients.get(sessionId) || new Set();
        
        res.json({
          id: session.id,
          name: session.name,
          currentSong: session.currentSong,
          queue: session.queue,
          isPlaying: session.isPlaying,
          clientCount: clients.size,
          lastUpdate: session.lastUpdate
        });
      } catch (error) {
        console.error('❌ Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session', details: error.message });
      }
    } else {
      // Create new session
      try {
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
          lastUpdate: Date.now()
        };
        
        sessions.set(sessionId, session);
        console.log('✅ Session created successfully:', sessionId);
        res.json({ sessionId, message: 'Session created successfully' });
      } catch (error) {
        console.error('❌ Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session', details: error.message });
      }
    }
  } else if (req.method === 'GET') {
    // This is a GET request to /api/sessions (without session ID)
    res.status(400).json({ error: 'Session ID is required in URL path: /api/sessions/{sessionId}' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
