const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const createDriveRoutes = require('./routes');
const GoogleDriveService = require('./googleDrive');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
// Configure CORS for both development and production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, /\.vercel\.app$/] 
    : "http://localhost:3000",
  methods: ["GET", "POST"],
  credentials: true
};

const io = socketIo(server, {
  cors: corsOptions
});

app.use(cors(corsOptions));
app.use(express.json());

// Initialize shared Google Drive connection
const driveService = new GoogleDriveService();
let driveInitialized = false;

// Try to initialize Google Drive with shared folder
driveService.initializeForSharedFolder().then(success => {
  driveInitialized = success;
  if (success) {
    console.log('🎵 Shared music folder ready!');
    
    // Create and use Google Drive routes with authenticated service
    const driveRoutes = createDriveRoutes(driveService);
    app.use('/api/drive', driveRoutes);
  } else {
    console.log('⚠️  Google Drive setup needed for shared folder access');
  }
}).catch(err => {
  console.error('Google Drive initialization failed:', err.message);
});

// Store active sessions
const sessions = new Map();

// Session structure:
// {
//   id: string,
//   hostId: string,
//   name: string,
//   currentSong: object | null,
//   queue: array,
//   isPlaying: boolean,
//   clients: Set
// }

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Latin BaKikar API is running' });
});

// Session endpoints
app.post('/api/sessions', (req, res) => {
  console.log('🔥 POST /api/sessions - Creating new session');
  const sessionId = uuidv4().substring(0, 8);
  const session = {
    id: sessionId,
    hostId: null,
    name: req.body.name || 'Music Session',
    currentSong: null,
    queue: [],
    isPlaying: false,
    clients: new Set(),
    lastUpdate: Date.now()
  };
  
  sessions.set(sessionId, session);
  console.log('✅ Created session:', sessionId);
  res.json({ sessionId, message: 'Session created successfully' });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  console.log('🔥 GET /api/sessions/:sessionId - Getting session:', req.params.sessionId);
  const sessionId = req.params.sessionId;
  const clientId = req.query.clientId;
  
  let session = sessions.get(sessionId);
  if (!session) {
    console.log('📝 Creating new session for GET request:', sessionId);
    session = {
      id: sessionId,
      hostId: null,
      name: `Session ${sessionId}`,
      currentSong: null,
      queue: [],
      isPlaying: false,
      clients: new Set(),
      lastUpdate: Date.now()
    };
    sessions.set(sessionId, session);
  }
  
  // Add client if provided (heartbeat)
  if (clientId) {
    session.clients.add(clientId);
    console.log('💓 Client heartbeat via GET:', clientId, 'Total clients:', session.clients.size);
  }
  
  res.json({
    id: session.id,
    name: session.name,
    currentSong: session.currentSong,
    queue: session.queue,
    isPlaying: session.isPlaying,
    clientCount: session.clients.size,
    lastUpdate: session.lastUpdate
  });
});

app.post('/api/sessions/:sessionId', (req, res) => {
  console.log('🔥 POST /api/sessions/:sessionId - Update session:', req.params.sessionId, 'Body:', req.body);
  const sessionId = req.params.sessionId;
  let session = sessions.get(sessionId);
  
  if (!session) {
    console.log('📝 Creating new session for POST request:', sessionId);
    session = {
      id: sessionId,
      hostId: null,
      name: `Session ${sessionId}`,
      currentSong: null,
      queue: [],
      isPlaying: false,
      clients: new Set(),
      lastUpdate: Date.now()
    };
    sessions.set(sessionId, session);
  }
  
  // Handle client actions
  if (req.body.action === 'join') {
    const clientId = req.body.clientId || `client_${Date.now()}`;
    session.clients.add(clientId);
    console.log('👤 Client joined session:', sessionId, 'Client ID:', clientId, 'Total clients:', session.clients.size);
  }
  
  if (req.body.action === 'leave') {
    const clientId = req.body.clientId;
    if (clientId) {
      session.clients.delete(clientId);
      console.log('👤 Client left session:', sessionId, 'Client ID:', clientId, 'Total clients:', session.clients.size);
    }
  }
  
  // Handle other updates
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
  
  res.json({
    id: session.id,
    name: session.name,
    currentSong: session.currentSong,
    queue: session.queue,
    isPlaying: session.isPlaying,
    clientCount: session.clients.size,
    lastUpdate: session.lastUpdate
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-session', (data) => {
    const { sessionId, userType } = data;
    const session = sessions.get(sessionId);
    
    if (!session) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }
    
    // Set host if this is the first host joining
    if (userType === 'host' && !session.hostId) {
      session.hostId = socket.id;
      socket.emit('host-status', { isHost: true });
    } else if (userType === 'host' && session.hostId && session.hostId !== socket.id) {
      socket.emit('error', { message: 'Session already has a host' });
      return;
    }
    
    session.clients.add(socket.id);
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.isHost = (socket.id === session.hostId);
    
    // Send current session state to the new client
    socket.emit('session-state', {
      currentSong: session.currentSong,
      queue: session.queue,
      isPlaying: session.isPlaying,
      isHost: socket.isHost
    });
    
    // Notify all clients about client count update
    io.to(sessionId).emit('client-count', session.clients.size);
    
    console.log(`Client ${socket.id} joined session ${sessionId} as ${userType}`);
  });
  
  socket.on('add-to-queue', (data) => {
    const session = sessions.get(socket.sessionId);
    if (!session) return;
    
    session.queue.push(data.song);
    io.to(socket.sessionId).emit('queue-updated', session.queue);
    console.log('Song added to queue:', data.song.name);
  });
  
  socket.on('reorder-queue', (data) => {
    const session = sessions.get(socket.sessionId);
    if (!session) return;
    
    session.queue = data.queue;
    io.to(socket.sessionId).emit('queue-updated', session.queue);
    console.log('Queue reordered');
  });
  
  socket.on('play-pause', (data) => {
    const session = sessions.get(socket.sessionId);
    if (!session || !socket.isHost) return;
    
    session.isPlaying = data.isPlaying;
    if (data.song) {
      console.log('🎵 Backend: play-pause received', {
        songName: data.song.name,
        songId: data.song.id,
        queueLength: session.queue.length,
        queueSongs: session.queue.map(s => ({ name: s.name, id: s.id })),
        isPlaying: data.isPlaying
      });
      
      // If this song is anywhere in the queue, remove it since we're now playing it
      const songIndex = session.queue.findIndex(queueSong => queueSong.id === data.song.id);
      console.log('🔍 Backend: Looking for song in queue, index found:', songIndex);
      
      if (songIndex !== -1) {
        console.log('✅ Backend: Starting song from queue, removing from queue:', data.song.name);
        session.queue.splice(songIndex, 1);
        console.log('📤 Backend: Emitting queue-updated, new length:', session.queue.length);
        // Notify all clients about queue update
        io.to(socket.sessionId).emit('queue-updated', session.queue);
      } else {
        console.log('❌ Backend: Song not found in queue - ID mismatch or not queued?');
        console.log('🔍 Backend: Queue IDs:', session.queue.map(s => s.id));
        console.log('🔍 Backend: Looking for ID:', data.song.id);
      }
      session.currentSong = data.song;
    }
    
    io.to(socket.sessionId).emit('playback-state', {
      isPlaying: session.isPlaying,
      currentSong: session.currentSong
    });
    
    console.log('Playback state changed:', { isPlaying: session.isPlaying, song: session.currentSong?.name });
  });
  
  socket.on('next-song', () => {
    const session = sessions.get(socket.sessionId);
    if (!session || !socket.isHost) {
      console.log('❌ Next song request denied: invalid session or not host');
      return;
    }
    
    console.log('⏭️ Backend: Next song requested', {
      currentSong: session.currentSong?.name,
      currentSongId: session.currentSong?.id,
      queueLength: session.queue.length,
      queueSongs: session.queue.map(s => ({ name: s.name, id: s.id }))
    });
    
    if (session.queue.length === 0) {
      console.log('🛑 Next song request: queue is empty, stopping playback');
      session.currentSong = null;
      session.isPlaying = false;
      
      io.to(socket.sessionId).emit('song-changed', {
        currentSong: null,
        queue: session.queue,
        isPlaying: false
      });
      return;
    }
    
    const nextSong = session.queue.shift();
    console.log('🎵 Backend: Shifting to next song', {
      nextSongName: nextSong.name,
      nextSongId: nextSong.id,
      remainingQueueLength: session.queue.length
    });
    
    session.currentSong = nextSong;
    session.isPlaying = true;
    
    io.to(socket.sessionId).emit('song-changed', {
      currentSong: session.currentSong,
      queue: session.queue,
      isPlaying: session.isPlaying
    });
    
    console.log('✅ Next song playing:', session.currentSong?.name, '| Queue length:', session.queue.length);
  });

  socket.on('stop-song', () => {
    const session = sessions.get(socket.sessionId);
    if (!session || !socket.isHost) return;
    
    session.isPlaying = false;
    
    io.to(socket.sessionId).emit('stop-song');
    
    console.log('Song stopped:', session.currentSong?.name);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    if (socket.sessionId) {
      const session = sessions.get(socket.sessionId);
      if (session) {
        session.clients.delete(socket.id);
        
        // If host disconnected, clear host status
        if (socket.id === session.hostId) {
          session.hostId = null;
          session.isPlaying = false;
          io.to(socket.sessionId).emit('host-disconnected');
        }
        
        // Clean up empty sessions
        if (session.clients.size === 0) {
          sessions.delete(socket.sessionId);
          console.log('Session cleaned up:', socket.sessionId);
        } else {
          io.to(socket.sessionId).emit('client-count', session.clients.size);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 5001;

// Export for Vercel serverless functions
module.exports = app;

// Start server only if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
