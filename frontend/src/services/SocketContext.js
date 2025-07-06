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
  const [clientId] = useState(() => {
    // Try to get existing client ID from sessionStorage first
    const existingId = sessionStorage.getItem('latin_bakikar_client_id');
    if (existingId) {
      console.log('🔄 Reusing existing client ID:', existingId);
      return existingId;
    }
    
    // Generate new client ID and store it
    const id = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('latin_bakikar_client_id', id);
    console.log('🆔 Generated new client ID:', id);
    return id;
  });
  
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
      console.log('🔄 Updating session:', sessionId, 'with updates:', updates);
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Session updated successfully, client count:', data.clientCount);
        setSessionData(data);
        lastUpdate.current = data.lastUpdate;
        return data;
      } else {
        console.error('❌ Failed to update session:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  }, []);
  
  const pollSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}?clientId=${encodeURIComponent(clientId)}`);
      if (response.ok) {
        const data = await response.json();
        
        console.log('📡 Poll response - lastUpdate:', data.lastUpdate, 'current:', lastUpdate.current, 'newer:', data.lastUpdate > lastUpdate.current);
        console.log('📡 Poll response - currentSong:', data.currentSong, 'queue length:', data.queue?.length);
        
        // Only update if the data is newer than what we have
        if (data.lastUpdate > lastUpdate.current) {
          const currentData = sessionDataRef.current;
          console.log('📡 Updating session data with newer data');
          setSessionData(data);
          lastUpdate.current = data.lastUpdate;
          
          // Emit events for compatibility with existing code
          if (mockSocket.current) {
            if (data.currentSong !== currentData?.currentSong) {
              console.log('📡 Emitting songChanged event');
              mockSocket.current._emit('songChanged', data.currentSong);
            }
            if (JSON.stringify(data.queue) !== JSON.stringify(currentData?.queue)) {
              console.log('📡 Emitting queueUpdated event');
              mockSocket.current._emit('queueUpdated', data.queue);
            }
            if (data.isPlaying !== currentData?.isPlaying) {
              console.log('📡 Emitting playbackStateChanged event');
              mockSocket.current._emit('playbackStateChanged', data.isPlaying);
            }
          }
        } else {
          console.log('📡 No update needed - data is not newer');
        }
      } else {
        console.error('❌ Poll failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to poll session:', error);
    }
  }, [clientId]); // Add clientId dependency
  
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
            console.log('🏠 Client joining session:', sessionId, 'with client ID:', clientId);
            const joinUpdate = { action: 'join', clientId };
            if (data.name) {
              joinUpdate.name = data.name;
              console.log('📝 Preserving session name:', data.name);
            }
            updateSession(sessionId, joinUpdate);
            // Start polling only if not already polling
            if (!pollInterval.current) {
              pollInterval.current = setInterval(() => pollSession(sessionId), 2000);
            }
            break;
            
          case 'leaveSession':
            console.log('🚪 Client leaving session:', sessionId, 'with client ID:', clientId);
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
      
      getSessionData: () => sessionDataRef.current,
      
      getClientId: () => clientId
    };
    
    // Handle page unload to clean up clients
    const handleBeforeUnload = () => {
      const sessionId = currentSessionId.current;
      if (sessionId && clientId) {
        console.log('🚪 Page unloading, cleaning up client:', clientId);
        // Clear the client ID from sessionStorage
        sessionStorage.removeItem('latin_bakikar_client_id');
        // Send synchronous request to clean up the client
        navigator.sendBeacon(`/api/sessions/${sessionId}`, JSON.stringify({ action: 'leave', clientId }));
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    mockSocket.current = socket;
    setSocket(socket);
    setIsConnected(true);
    
    // Cleanup on unmount
    return () => {
      // Clean up the current session if any
      const sessionId = currentSessionId.current;
      if (sessionId && clientId) {
        console.log('🚪 Component cleanup, leaving session:', sessionId, 'with client ID:', clientId);
        updateSession(sessionId, { action: 'leave', clientId });
      }
      
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
