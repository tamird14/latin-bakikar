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
    
    // Generate new client ID with better uniqueness
    const id = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 5)}`;
    sessionStorage.setItem('latin_bakikar_client_id', id);
    console.log('🆔 Generated new client ID:', id);
    return id;
  });
  
  const lastLocalUpdate = useRef(0);
  const isUpdating = useRef(false); // Track if we're currently making an update
  const updateQueue = useRef([]); // Queue for batching updates
  const updateTimeout = useRef(null);
  
  const pollInterval = useRef(null);
  const currentSessionId = useRef(null);
  const lastUpdate = useRef(0);
  const sessionDataRef = useRef(null);
  
  // Update sessionDataRef when sessionData changes
  useEffect(() => {
    sessionDataRef.current = sessionData;
  }, [sessionData]);
  
  const pollSession = useCallback(async (sessionId) => {
    // Don't poll if we're currently updating
    if (isUpdating.current) {
      console.log('📡 Skipping poll - update in progress');
      return;
    }
    
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
          
          // Only emit events if this update didn't originate from this client
          // Extended time window for complex operations
          const timeSinceLocalUpdate = Date.now() - lastLocalUpdate.current;
          const isRecentLocalUpdate = timeSinceLocalUpdate < 3000; // Increased to 3 seconds
          
          // Also check if the update ID matches this client (more reliable than timing)
          const isOurUpdate = data.updateId && data.updateId.startsWith(clientId);
          
          if (!isRecentLocalUpdate && !isOurUpdate && mockSocket.current) {
            console.log('📡 Emitting sync events (not a local update)');
            
            // Emit atomic state change to prevent partial updates
            const hasChanges = {
              song: data.currentSong !== currentData?.currentSong,
              queue: JSON.stringify(data.queue) !== JSON.stringify(currentData?.queue),
              playback: data.isPlaying !== currentData?.isPlaying
            };
            
            if (hasChanges.song || hasChanges.queue || hasChanges.playback) {
              console.log('📡 Emitting atomicStateChange event');
              mockSocket.current._emit('atomicStateChange', {
                currentSong: data.currentSong,
                queue: data.queue,
                isPlaying: data.isPlaying,
                changes: hasChanges
              });
            }
            
            // Still emit individual events for backward compatibility
            if (hasChanges.song) {
              console.log('📡 Emitting songChanged event');
              mockSocket.current._emit('songChanged', data.currentSong);
            }
            if (hasChanges.queue) {
              console.log('📡 Emitting queueUpdated event');
              mockSocket.current._emit('queueUpdated', data.queue);
            }
            if (hasChanges.playback) {
              console.log('📡 Emitting playbackStateChanged event');
              mockSocket.current._emit('playbackStateChanged', data.isPlaying);
            }
          } else if (isRecentLocalUpdate || isOurUpdate) {
            console.log('📡 Skipping event emission - this appears to be from a recent local update');
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
  }, [clientId]);
  
  // Batch and send updates atomically
  const batchedUpdateSession = useCallback(async (sessionId, updates) => {
    try {
      console.log('🔄 Batched update session:', sessionId, 'with updates:', updates);
      
      // Mark this as a local update with longer window for complex operations
      lastLocalUpdate.current = Date.now();
      isUpdating.current = true;
      
      // Pause polling during updates to prevent conflicts
      const wasPolling = !!pollInterval.current;
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
      
      // Add version/timestamp for optimistic locking
      const updatePayload = {
        ...updates,
        clientId,
        updateId: `${clientId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        expectedVersion: sessionDataRef.current?.version || 0
      };
      
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Session updated successfully, client count:', data.clientCount);
        setSessionData(data);
        lastUpdate.current = data.lastUpdate;
        
        // Resume polling after successful update
        if (wasPolling) {
          setTimeout(() => {
            if (!pollInterval.current) {
              pollInterval.current = setInterval(() => pollSession(sessionId), 1000);
            }
          }, 200); // Shorter delay for better responsiveness
        }
        
        return data;
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'version_conflict') {
          console.log('⚠️ Version conflict detected, forcing refresh...');
          // Force a poll to get latest data
          await pollSession(sessionId);
        }
        console.error('❌ Failed to update session:', response.status, response.statusText);
        
        // Resume polling even on failure
        if (wasPolling) {
          setTimeout(() => {
            if (!pollInterval.current) {
              pollInterval.current = setInterval(() => pollSession(sessionId), 1000);
            }
          }, 200);
        }
      }
    } catch (error) {
      console.error('Failed to update session:', error);
      
      // Resume polling on error
      const wasPolling = !!pollInterval.current;
      if (wasPolling) {
        setTimeout(() => {
          if (!pollInterval.current) {
            pollInterval.current = setInterval(() => pollSession(sessionId), 1000);
          }
        }, 200);
      }
    } finally {
      isUpdating.current = false;
    }
  }, [clientId, pollSession]);
  
  // Legacy single update function for backward compatibility
  const updateSession = useCallback(async (sessionId, updates) => {
    return batchedUpdateSession(sessionId, updates);
  }, [batchedUpdateSession]);
  
  // New atomic update function for complex operations
  const atomicUpdate = useCallback(async (sessionId, updates) => {
    console.log('🔄 Atomic update requested:', updates);
    
    // If already updating, queue this update
    if (isUpdating.current) {
      console.log('⏳ Update in progress, queueing...');
      updateQueue.current.push(updates);
      return;
    }
    
    // Clear any pending timeout
    if (updateTimeout.current) {
      clearTimeout(updateTimeout.current);
    }
    
    // Batch this update with any queued updates
    const allUpdates = [updates, ...updateQueue.current];
    updateQueue.current = [];
    
    // Merge all updates into one atomic operation
    const mergedUpdates = allUpdates.reduce((acc, update) => {
      return { ...acc, ...update };
    }, {});
    
    return batchedUpdateSession(sessionId, mergedUpdates);
  }, [batchedUpdateSession]);
  
  const mockSocket = useRef(null);
  
  useEffect(() => {
    // Capture ref values at the start of the effect for cleanup
    const currentUpdateTimeoutRef = updateTimeout.current;
    
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
              pollInterval.current = setInterval(() => pollSession(sessionId), 1000);
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
            console.log('🔄 Emitting queue update');
            updateSession(sessionId, { queue: data });
            break;
            
          case 'updateCurrentSong':
            console.log('🔄 Emitting current song update');
            updateSession(sessionId, { currentSong: data });
            break;
            
          case 'updatePlaybackState':
            console.log('🔄 Emitting playback state update');
            updateSession(sessionId, { isPlaying: data });
            break;
            
          // New atomic update for complex operations
          case 'atomicUpdate':
            console.log('🔄 Emitting atomic update');
            atomicUpdate(sessionId, data);
            break;
            
          // Song transition helper - updates song, queue, and playback atomically
          case 'songTransition':
            console.log('🔄 Emitting song transition update');
            atomicUpdate(sessionId, {
              currentSong: data.currentSong,
              queue: data.queue,
              isPlaying: data.isPlaying
            });
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
      
      // Use the captured ref value for cleanup
      if (currentUpdateTimeoutRef) {
        clearTimeout(currentUpdateTimeoutRef);
      }
      
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [updateSession, pollSession, atomicUpdate, clientId]);

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
