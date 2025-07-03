import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
// import io from 'socket.io-client'; // Disabled for serverless deployment

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(true); // Always connected for polling
  const [sessionData, setSessionData] = useState(null);
  const [clientId] = useState(() => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  const pollInterval = useRef(null);
  const currentSessionId = useRef(null);
  const lastUpdate = useRef(0);
  const sessionDataRef = useRef(null);
  
  // Update sessionDataRef when sessionData changes
  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);
  
  // API functions for session management
  const updateSession = useCallback(async (sessionId, updates) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessionData(data);
        lastUpdate.current = data.lastUpdate;
        return data;
      }
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  }, []);
  
  const pollSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Only update if the data is newer than what we have
        if (data.lastUpdate > lastUpdate.current) {
          const currentData = sessionDataRef.current;
          setSessionData(data);
          lastUpdate.current = data.lastUpdate;
          
          // Emit events for compatibility with existing code
          if (mockSocket.current) {
            if (data.currentSong !== currentData?.currentSong) {
              mockSocket.current._emit('songChanged', data.currentSong);
            }
            if (JSON.stringify(data.queue) !== JSON.stringify(currentData?.queue)) {
              mockSocket.current._emit('queueUpdated', data.queue);
            }
            if (data.isPlaying !== currentData?.isPlaying) {
              mockSocket.current._emit('playbackStateChanged', data.isPlaying);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to poll session:', error);
    }
  }, []); // Remove sessionData dependency to prevent circular updates
  
  const mockSocket = useRef(null);
  
  useEffect(() => {
    // Create a mock socket that uses our session API
    const socket = {
      emit: (event, data) => {
        console.log('Session sync emit:', event, data);
        
        const sessionId = currentSessionId.current;
        if (!sessionId) return;
        
        switch (event) {
          case 'joinSession':
            updateSession(sessionId, { action: 'join', clientId });
            // Start polling only if not already polling
            if (!pollInterval.current) {
              pollInterval.current = setInterval(() => pollSession(sessionId), 2000);
            }
            break;
            
          case 'leaveSession':
            updateSession(sessionId, { action: 'leave', clientId });
            // Stop polling
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
              pollInterval.current = null;
            }
            break;
            
          case 'updateQueue':
            updateSession(sessionId, { queue: data });
            break;
            
          case 'updateCurrentSong':
            updateSession(sessionId, { currentSong: data });
            break;
            
          case 'updatePlaybackState':
            updateSession(sessionId, { isPlaying: data });
            break;
            
          default:
            console.log('Unhandled socket event:', event, data);
        }
      },
      
      on: (event, callback) => {
        console.log('Session sync on:', event);
        socket._listeners = socket._listeners || {};
        socket._listeners[event] = callback;
      },
      
      off: (event) => {
        console.log('Session sync off:', event);
        if (socket._listeners) {
          delete socket._listeners[event];
        }
      },
      
      // Internal method to emit events to listeners
      _emit: (event, data) => {
        if (socket._listeners && socket._listeners[event]) {
          socket._listeners[event](data);
        }
      },
      
      connected: true,
      
      // Add session management methods
      setSessionId: (sessionId) => {
        currentSessionId.current = sessionId;
      },
      
      getSessionData: () => sessionDataRef.current
    };
    
    mockSocket.current = socket;
    setSocket(socket);
    setIsConnected(true);
    
    // Cleanup on unmount
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    };
  }, [updateSession, pollSession, clientId]); // Removed sessionData dependency

  const value = {
    socket,
    isConnected,
    sessionData
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
