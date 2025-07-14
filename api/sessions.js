// Store active sessions (in a real app, you'd use a database)
// Updated: Force rebuild to fix session name issue
const sessions = new Map();

// Store client connections for each session with timestamps
const sessionClients = new Map();

// Store session names persistently using a simpler approach
// We'll encode the session name in the session updates to preserve it

// Client heartbeat timeout (if no activity for 10 seconds, remove client)
const CLIENT_TIMEOUT = 10000;

// Simple ID generator (replacing uuid)
function generateSessionId() {
  return Math.random().toString(36).substring(2, 10);
}

// Clean up stale clients
function cleanupStaleClients() {
  const now = Date.now();
  
  for (const [sessionId, clients] of sessionClients) {
    const activeClients = new Map();
    let removedCount = 0;
    
    for (const [clientId, timestamp] of clients) {
      if (now - timestamp < CLIENT_TIMEOUT) {
        activeClients.set(clientId, timestamp);
      } else {
        console.log('🕐 Removing stale client:', clientId, 'from session:', sessionId);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      sessionClients.set(sessionId, activeClients);
      console.log(`🧹 Cleaned up ${removedCount} stale clients from session ${sessionId}. Active: ${activeClients.size}`);
    }
  }
}

// Run cleanup every 3 seconds
setInterval(cleanupStaleClients, 3000);

module.exports = function handler(req, res) {
  console.log('🔥 API called:', req.method, req.url);
  console.log('🔥 Request body:', req.body);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, text/plain');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Handle sendBeacon requests which might have different content-type
  if (req.method === 'POST' && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      console.log('Failed to parse body as JSON:', req.body);
    }
  }

  // Check if this is a request for a specific session ID
  const urlParts = req.url.split('/');
  const sessionIdFromUrl = urlParts.length > 3 && urlParts[3] && urlParts[3] !== '' ? urlParts[3] : null;
  const sessionIdFromQuery = req.query?.sessionId;
  const sessionId = sessionIdFromQuery || sessionIdFromUrl; // Prefer query param for Vercel routing
  const isSessionIdRequest = !!sessionId;
  
  if (req.method === 'GET' && isSessionIdRequest) {
    // Handle GET /api/sessions/{sessionId}
    try {
      const clientId = req.query?.clientId; // Get client ID from query parameter
      console.log('🔍 GET request for session:', sessionId, 'Client ID:', clientId);
      
      // Update client heartbeat if clientId is provided
      if (clientId) {
        let clients = sessionClients.get(sessionId) || new Map();
        if (clients.has(clientId)) {
          clients.set(clientId, Date.now());
          console.log('💓 Client heartbeat via GET:', sessionId, 'Client ID:', clientId);
        } else {
          // Client not in session, add them
          clients.set(clientId, Date.now());
          sessionClients.set(sessionId, clients);
          console.log('👤 Client auto-joined via GET:', sessionId, 'Client ID:', clientId);
        }
      }
      
      // Check if session exists in memory first
      console.log('🔍 Looking for session:', sessionId);
      console.log('🔍 Total sessions in memory:', sessions.size);
      console.log('🔍 Available session IDs:', Array.from(sessions.keys()));
      const existingSession = sessions.get(sessionId);
      if (existingSession) {
        console.log('✅ Found existing session in memory:', existingSession.name);
        console.log('✅ Session current song:', existingSession.currentSong?.name || 'none');
        console.log('✅ Session queue length:', existingSession.queue?.length || 0);
        console.log('✅ Session playing state:', existingSession.isPlaying);
        
        // Update client count from active connections
        const clients = sessionClients.get(sessionId) || new Map();
        
        const responseData = {
          id: existingSession.id,
          name: existingSession.name,
          currentSong: existingSession.currentSong,
          queue: existingSession.queue || [],
          isPlaying: existingSession.isPlaying || false,
          clientCount: clients.size,
          lastUpdate: existingSession.lastUpdate || Date.now(),
          version: existingSession.version || 0,
          updateId: req.body?.updateId || null
        };
        
        console.log('✅ Returning session data - queue length:', responseData.queue.length);
        res.json(responseData);
        return;
      }
      
      // If not in memory, check if we have clients for this session
      // This might indicate an active session that lost its state
      const clients = sessionClients.get(sessionId) || new Map();
      const hasActiveClients = clients.size > 0;
      
      if (hasActiveClients) {
        console.log('⚠️  Session not in memory but has active clients:', clients.size);
        console.log('📱 This suggests the session state was lost, returning minimal session for sync');
        
        // Return a minimal session that indicates it might need sync
        const minimalSession = {
          id: sessionId,
          name: 'Music Session',
          currentSong: null,
          queue: [],
          isPlaying: false,
          clientCount: clients.size,
          lastUpdate: Date.now(),
          version: 0,
          needsSync: true, // Flag to indicate this might be a stale state
          updateId: req.body?.updateId || null
        };
        
        res.json(minimalSession);
        return;
      }
      
      // If not in memory and no active clients, session doesn't exist
      console.log('❌ Session not found:', sessionId);
      res.status(404).json({ 
        error: 'session_not_found', 
        message: 'Session does not exist',
        sessionId: sessionId
      });
      return;
    } catch (error) {
      console.error('❌ Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session', details: error.message });
      return;
    }
  }

  if (req.method === 'POST') {
    // Check if this is an update request
    const isUpdateRequest = isSessionIdRequest && req.body && (req.body.action || req.body.queue !== undefined || req.body.currentSong !== undefined || req.body.isPlaying !== undefined);
    
    if (isUpdateRequest) {
      // Handle session updates (queue, playback state, etc.)
      try {
        console.log('🔄 Updating session:', sessionId, 'with:', req.body);
        
        let session = sessions.get(sessionId);
        if (!session) {
          // Create session if it doesn't exist
          session = {
            id: sessionId,
            name: req.body.name || 'Music Session', // Use provided name or default
            currentSong: null,
            queue: [],
            isPlaying: false,
            lastUpdate: Date.now(),
            version: 0
          };
        }
        
        // Check for version conflicts (optimistic locking)
        const expectedVersion = req.body.expectedVersion || 0;
        if (session.version !== expectedVersion) {
          console.log('⚠️ Version conflict detected:', 'expected:', expectedVersion, 'actual:', session.version);
          res.status(409).json({ 
            error: 'version_conflict', 
            message: 'Session was updated by another client',
            currentVersion: session.version
          });
          return;
        }
        
        // Update session data based on request
        if (req.body.action === 'join') {
          // Handle client joining
          const clientId = req.body.clientId || `client_${Date.now()}`;
          let clients = sessionClients.get(sessionId) || new Map();
          
          // Add or update client timestamp
          if (!clients.has(clientId)) {
            clients.set(clientId, Date.now());
            sessionClients.set(sessionId, clients);
            console.log('👤 Client joined session:', sessionId, 'Client ID:', clientId, 'Total clients:', clients.size);
          } else {
            // Update timestamp for existing client (heartbeat)
            clients.set(clientId, Date.now());
            console.log('💓 Client heartbeat:', sessionId, 'Client ID:', clientId);
          }
        }
        
        if (req.body.action === 'leave') {
          // Handle client leaving
          const clientId = req.body.clientId;
          if (clientId) {
            let clients = sessionClients.get(sessionId) || new Map();
            if (clients.has(clientId)) {
              clients.delete(clientId);
              sessionClients.set(sessionId, clients);
              console.log('👤 Client left session:', sessionId, 'Client ID:', clientId, 'Total clients:', clients.size);
            }
          }
        }
        
        // Handle atomic updates (multiple fields at once)
        let hasUpdates = false;
        
        if (req.body.queue !== undefined) {
          session.queue = req.body.queue;
          console.log('🎵 Updated queue, now has:', session.queue.length, 'songs');
          console.log('🎵 Queue songs:', session.queue.map(s => s.name).join(', '));
          hasUpdates = true;
        }
        
        if (req.body.currentSong !== undefined) {
          session.currentSong = req.body.currentSong;
          console.log('🎵 Updated current song:', session.currentSong?.name || 'none');
          hasUpdates = true;
        }
        
        if (req.body.isPlaying !== undefined) {
          session.isPlaying = req.body.isPlaying;
          console.log('🎵 Updated playing state:', session.isPlaying);
          hasUpdates = true;
        }
        
        if (req.body.name !== undefined) {
          session.name = req.body.name;
          console.log('📝 Updated session name:', session.name);
          hasUpdates = true;
        }
        
        // Update version and timestamp only if there were actual changes
        if (hasUpdates) {
          session.version = (session.version || 0) + 1;
          session.lastUpdate = Date.now();
        }
        
        sessions.set(sessionId, session);
        
        const clients = sessionClients.get(sessionId) || new Map();
        
        res.json({
          id: session.id,
          name: session.name,
          currentSong: session.currentSong,
          queue: session.queue,
          isPlaying: session.isPlaying,
          clientCount: clients.size,
          lastUpdate: session.lastUpdate,
          version: session.version,
          updateId: req.body.updateId || null
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
          lastUpdate: Date.now(),
          version: 0
        };
        
        sessions.set(sessionId, session);
        console.log('✅ Session created successfully:', sessionId, 'with name:', sessionName);
        console.log('✅ Total sessions in memory:', sessions.size);
        console.log('✅ Session stored:', sessions.has(sessionId));
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
