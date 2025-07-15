import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../services/SocketContext';
import { getSession } from '../services/api';
import MusicPlayer from './MusicPlayer';
import Queue from './Queue';
import FileBrowser from './FileBrowser';
import PersistentAudioPlayer from './PersistentAudioPlayer';
import AudioTest from './AudioTest';

const Session = () => {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { socket, sessionData } = useSocket();
  
  const [session, setSession] = useState(null);
  const [isHost, setIsHost] = useState(searchParams.get('host') === 'true'); // eslint-disable-line no-unused-vars
  const [originalSessionName, setOriginalSessionName] = useState(() => {
    // Try to get stored session name from localStorage
    return localStorage.getItem(`session_name_${sessionId}`) || null;
  });
  const originalSessionNameRef = useRef(localStorage.getItem(`session_name_${sessionId}`) || null);
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [activeTab, setActiveTab] = useState('player');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Audio state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState('');
  const [volume, setVolume] = useState(1);
  const [seekTime, setSeekTime] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [songDurations, setSongDurations] = useState({}); // Store durations for songs
  
  // Ref to track current song for socket comparisons
  const currentSongRef = useRef(null);
  const songDurationsRef = useRef({});
  const hostStateEstablishedRef = useRef(false);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isHostRef = useRef(false);

  // Update refs when values change
  useEffect(() => {
    currentSongRef.current = currentSong;
    originalSessionNameRef.current = originalSessionName;
    songDurationsRef.current = songDurations;
    queueRef.current = queue;
    isPlayingRef.current = isPlaying;
    isHostRef.current = isHost;
  }, [currentSong, originalSessionName, songDurations, queue, isPlaying, isHost]);

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        // For hosts: If this is a newly created session, start with local state
        if (isHostRef.current) {
          console.log('🏠 Host loading session - checking if newly created...');
          
          // Check if this is a newly created session (no backend data yet)
          const clientId = socket?.getClientId ? socket.getClientId() : null;
          let sessionData;
          
          try {
            sessionData = await getSession(sessionId, clientId);
            console.log('🔄 Session exists in backend:', sessionData);
          } catch (err) {
            console.log('🆕 New session detected - starting with local state');
            // This is a new session, start with local state
            sessionData = {
              id: sessionId,
              name: originalSessionNameRef.current || 'Music Session',
              currentSong: null,
              queue: [],
              isPlaying: false,
              clientCount: 1,
              lastUpdate: Date.now(),
              version: 0
            };
            
            // Save session to backend in background
            setTimeout(async () => {
              try {
                console.log('💾 Saving new session to backend...');
                const response = await fetch(`/api/sessions/${sessionId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'join',
                    clientId: clientId,
                    name: sessionData.name
                  })
                });
                if (response.ok) {
                  console.log('✅ Session saved to backend successfully');
                }
              } catch (saveErr) {
                console.log('⚠️ Failed to save session to backend:', saveErr);
              }
            }, 1000); // Small delay to ensure UI is ready
          }
          
          // Set session data
          setSession(sessionData);
          setCurrentSong(sessionData.currentSong);
          setQueue(sessionData.queue || []);
          setIsPlaying(sessionData.isPlaying || false);
          setClientCount(sessionData.clientCount || 1);
          
          // Mark host state as established
          hostStateEstablishedRef.current = true;
          
        } else {
          // For guests: Load from backend with retry
          console.log('👥 Guest loading session from backend...');
          const clientId = socket?.getClientId ? socket.getClientId() : null;
          
          // Retry loading session for guests (host might still be saving it)
          let sessionData = null;
          const maxRetries = 20; // More retries for guests (serverless instances)
          
          for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
            try {
              sessionData = await getSession(sessionId, clientId);
              console.log('🔄 Guest session data loaded:', sessionData);
              break; // Success, exit the loop
            } catch (err) {
              console.log(`⏳ Guest retry ${retryCount + 1}/${maxRetries} - session not ready yet...`);
              
              // Try to create session if it doesn't exist (for guests)
              if (retryCount === 0) {
                try {
                  console.log('🔄 Guest attempting to create session...');
                  const response = await fetch(`/api/sessions/${sessionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'join',
                      clientId: clientId,
                      name: 'Music Session'
                    })
                  });
                  if (response.ok) {
                    console.log('✅ Guest successfully created session');
                    continue; // Retry the GET request
                  }
                } catch (createErr) {
                  console.log('⚠️ Guest failed to create session:', createErr);
                }
              }
              
              if (retryCount < maxRetries - 1) {
                // Wait longer between retries for guests
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
              } else {
                throw new Error('Session not found after multiple attempts');
              }
            }
          }
          
          setSession(sessionData);
          setCurrentSong(sessionData.currentSong);
          
          // Apply stored durations to queue items
          const queueWithDurations = (sessionData.queue || []).map(song => 
            songDurationsRef.current[song.id] && !song.duration 
              ? { ...song, duration: songDurationsRef.current[song.id] }
              : song
          );
          setQueue(queueWithDurations);
          
          // Guests should always have isPlaying: false
          setIsPlaying(false);
          setClientCount(sessionData.clientCount);
        }
        
                setLoading(false);
      } catch (err) {
        console.log('❌ Failed to load session:', err.message);
        setError('Session not found');
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId, socket]); // Using refs for state values to prevent unnecessary re-renders

  // Store session name in a separate effect to avoid dependency issues
  useEffect(() => {
    if (session && session.name && session.name !== 'Music Session' && !originalSessionNameRef.current) {
      originalSessionNameRef.current = session.name;
      setOriginalSessionName(session.name);
      localStorage.setItem(`session_name_${sessionId}`, session.name);
    }
  }, [session, sessionId]);

  // Socket connection and sync - only run once per session
  useEffect(() => {
    if (socket && sessionId) {
      console.log('🔧 Setting up session sync for:', sessionId);
      console.log('🆔 Using client ID:', socket.getClientId?.());
      
      // Set session ID for socket sync
      socket.setSessionId(sessionId);
      
      // Join session with name preservation
      const joinData = { sessionId };
      if (originalSessionNameRef.current) {
        joinData.name = originalSessionNameRef.current;
      }
      socket.emit('joinSession', joinData);
      
      // Listen for sync events
      socket.on('queueUpdated', (newQueue) => {
        console.log('🔄 Queue updated from sync:', newQueue);
        console.log('🔄 User is host:', isHostRef.current, 'Current queue length:', queueRef.current.length);
        console.log('🔄 New queue length:', newQueue?.length || 0);
        
        // Guests should always get queue updates
        // Hosts should only get updates if they're different to prevent overwrites
        if (!isHostRef.current) {
          console.log('🔄 Guest applying queue update');
          setQueue(newQueue || []);
        } else if (hostStateEstablishedRef.current && JSON.stringify(newQueue) !== JSON.stringify(queueRef.current)) {
          console.log('🔄 Host applying queue update - different from current');
          setQueue(newQueue || []);
        } else {
          console.log('🔄 Skipping queue update for host - no change detected or state not established');
        }
      });
      
      socket.on('songChanged', (newSong) => {
        console.log('🔄 Song changed from sync:', newSong);
        console.log('🔄 User is host:', isHostRef.current, 'Current song:', currentSongRef.current);
        
        // Guests should always get song updates
        // Hosts should only get updates if they're different to prevent overwrites
        if (!isHostRef.current) {
          console.log('🔄 Guest applying song change');
          setCurrentSong(newSong);
        } else if (hostStateEstablishedRef.current && JSON.stringify(newSong) !== JSON.stringify(currentSongRef.current)) {
          console.log('🔄 Host applying song change - different from current');
          setCurrentSong(newSong);
        } else {
          console.log('🔄 Skipping song change for host - no change detected or state not established');
        }
      });
      
      socket.on('playbackStateChanged', (newPlayingState) => {
        console.log('🔄 Playback state changed from sync:', newPlayingState);
        console.log('🔄 User is host:', isHostRef.current, 'Current playing state:', isPlayingRef.current);
        
        // Only hosts should update their playing state from sync events
        // Guests should always have isPlaying: false locally
        if (isHostRef.current && newPlayingState !== isPlayingRef.current) {
          console.log('🔄 Host applying playback state change');
          setIsPlaying(newPlayingState);
        } else if (!isHostRef.current) {
          // Guests should always have isPlaying: false
          console.log('🔄 Guest keeping isPlaying: false');
          setIsPlaying(false);
        }
      });
      
      // New atomic state change handler
      socket.on('atomicStateChange', (stateData) => {
        console.log('🔄 Atomic state change from sync:', stateData);
        console.log('🔄 Changes:', stateData.changes);
        
        // Guests should always get atomic updates
        // Hosts should only get updates if they're different to prevent overwrites
        if (stateData.changes.song) {
          if (!isHostRef.current) {
            console.log('🔄 Guest applying song change in atomic update');
            setCurrentSong(stateData.currentSong);
          } else if (hostStateEstablishedRef.current && JSON.stringify(stateData.currentSong) !== JSON.stringify(currentSongRef.current)) {
            console.log('🔄 Host applying song change in atomic update - different from current');
            setCurrentSong(stateData.currentSong);
          } else {
            console.log('🔄 Skipping song change in atomic update for host - no change detected or state not established');
          }
        }
        if (stateData.changes.queue) {
          if (!isHostRef.current) {
            console.log('🔄 Guest applying queue change in atomic update');
            setQueue(stateData.queue || []);
          } else if (hostStateEstablishedRef.current && JSON.stringify(stateData.queue) !== JSON.stringify(queueRef.current)) {
            console.log('🔄 Host applying queue change in atomic update - different from current');
            setQueue(stateData.queue || []);
          } else {
            console.log('🔄 Skipping queue change in atomic update for host - no change detected or state not established');
          }
        }
        if (stateData.changes.playback && isHostRef.current) {
          // Only hosts should update their playing state from sync events
          if (stateData.isPlaying !== isPlayingRef.current) {
            console.log('🔄 Host applying playback change in atomic update');
            setIsPlaying(stateData.isPlaying);
          } else {
            console.log('🔄 Skipping playback change in atomic update for host - no change detected');
          }
        }
      });
      
      // For guests: Use a more robust sync approach that keeps them updated
      if (!isHostRef.current) {
        let syncAttempt = 0;
        const maxSyncAttempts = 5; // More attempts for better reliability
        const syncTimeouts = [];
        
        const attemptSync = async () => {
          try {
            syncAttempt++;
            console.log(`🔄 Guest sync attempt ${syncAttempt}/${maxSyncAttempts}...`);
            
            const clientId = socket?.getClientId ? socket.getClientId() : null;
            const freshSessionData = await getSession(sessionId, clientId);
            console.log('🔄 Fresh session data for guest:', freshSessionData);
            
            // Check if we got real session data (not just empty defaults)
            const hasRealData = freshSessionData && (
              freshSessionData.currentSong || 
              (freshSessionData.queue && freshSessionData.queue.length > 0) ||
              freshSessionData.needsSync // Backend flag indicating stale state
            );
            
            if (hasRealData) {
              console.log('✅ Updating guest state with real session data...');
              setCurrentSong(freshSessionData.currentSong);
              setQueue(freshSessionData.queue || []);
              // Guests should always have isPlaying: false locally
              // They don't control playback, only the host does
              setIsPlaying(false);
              
              // Continue syncing periodically to stay updated
              if (syncAttempt < maxSyncAttempts) {
                console.log(`⏳ Scheduling next sync in ${5000}ms to stay updated...`);
                const nextTimeout = setTimeout(attemptSync, 5000);
                syncTimeouts.push(nextTimeout);
              }
            } else if (syncAttempt < maxSyncAttempts) {
              console.log(`⏳ No real data yet, will retry in ${2000 * syncAttempt}ms...`);
              const nextTimeout = setTimeout(attemptSync, 2000 * syncAttempt);
              syncTimeouts.push(nextTimeout);
            } else {
              console.log('❌ Max sync attempts reached, giving up');
            }
          } catch (err) {
            console.error('❌ Failed to sync session:', err);
            if (syncAttempt < maxSyncAttempts) {
              console.log(`⏳ Retrying sync in ${2000 * syncAttempt}ms...`);
              const nextTimeout = setTimeout(attemptSync, 2000 * syncAttempt);
              syncTimeouts.push(nextTimeout);
            }
          }
        };
        
        // Start first sync attempt after 2 seconds (give host time to republish)
        const firstTimeout = setTimeout(attemptSync, 2000);
        syncTimeouts.push(firstTimeout);
        
        // Cleanup all timeouts
        return () => {
          syncTimeouts.forEach(timeout => clearTimeout(timeout));
          console.log('🧹 Cleaning up session sync for:', sessionId);
          socket.emit('leaveSession', { sessionId });
          socket.off('queueUpdated');
          socket.off('songChanged');
          socket.off('playbackStateChanged');
          socket.off('atomicStateChange');
        };
      }
      
      // Cleanup for hosts
      return () => {
        console.log('🧹 Cleaning up session sync for:', sessionId);
        socket.emit('leaveSession', { sessionId });
        socket.off('queueUpdated');
        socket.off('songChanged');
        socket.off('playbackStateChanged');
        socket.off('atomicStateChange');
      };
    }
  }, [sessionId, socket]);

  // Force republish current state - useful when guests join and might have stale data
  const republishCurrentState = useCallback(() => {
    if (isHost && socket && !loading) {
      console.log('📢 Host republishing current state...');
      console.log('📢 Current song:', currentSong);
      console.log('📢 Current queue:', queue);
      console.log('📢 Playing state:', isPlaying);
      
      // Use atomic update to prevent race conditions
      const stateUpdate = {};
      if (currentSong) stateUpdate.currentSong = currentSong;
      if (queue && queue.length > 0) stateUpdate.queue = queue;
      stateUpdate.isPlaying = isPlaying;
      
      if (Object.keys(stateUpdate).length > 0) {
        console.log('📢 Sending atomic state update');
        socket.emit('atomicUpdate', stateUpdate);
      }
    } else {
      console.log('📢 Not republishing - isHost:', isHost, 'socket:', !!socket, 'loading:', loading);
    }
  }, [isHost, socket, currentSong, queue, isPlaying, loading]);

  // Update client count from session data
  useEffect(() => {
    if (sessionData && sessionData.clientCount !== undefined) {
      console.log('👥 Updating client count from session data:', sessionData.clientCount);
      const previousCount = clientCount;
      setClientCount(sessionData.clientCount);
      
      // If we're the host and client count increased, republish state for new guests
      // But only if we have actual content to share and this isn't the initial load
      if (isHost && previousCount > 0 && sessionData.clientCount > previousCount && !loading) {
        const hasContent = currentSong || (queue && queue.length > 0);
        if (hasContent) {
          console.log('👥 New guest joined, republishing state...');
          // Longer delay to ensure guest is fully ready
          setTimeout(() => republishCurrentState(), 1000);
        } else {
          console.log('👥 New guest joined but no content to share');
        }
      }
    }
  }, [sessionData, clientCount, isHost, republishCurrentState, currentSong, queue, loading]);

  // Update queue items with stored durations when durations change
  useEffect(() => {
    if (Object.keys(songDurations).length > 0) {
      setQueue(prevQueue => 
        prevQueue.map(song => 
          songDurations[song.id] && !song.duration 
            ? { ...song, duration: songDurations[song.id] }
            : song
        )
      );
    }
  }, [songDurations]);

  // Backup host state to localStorage and mark state as established
  useEffect(() => {
    if (isHost && !loading) {
      const backupState = {
        currentSong,
        queue,
        isPlaying,
        timestamp: Date.now()
      };
      
      console.log('💾 Backing up host state to localStorage:', backupState);
      localStorage.setItem(`session_backup_${sessionId}`, JSON.stringify(backupState));
      
      // Mark host state as established when they have content
      if (currentSong || queue.length > 0 || isPlaying) {
        hostStateEstablishedRef.current = true;
      }
    }
  }, [isHost, currentSong, queue, isPlaying, sessionId, loading]);

  // Clean up old backup data on component mount
  useEffect(() => {
    // Clean up backups older than 24 hours
    const cleanupOldBackups = () => {
      const now = Date.now();
      const keys = Object.keys(localStorage);
      
      keys.forEach(key => {
        if (key.startsWith('session_backup_')) {
          try {
            const backup = JSON.parse(localStorage.getItem(key));
            if (backup && backup.timestamp && (now - backup.timestamp) > 24 * 60 * 60 * 1000) {
              console.log('🧹 Cleaning up old backup:', key);
              localStorage.removeItem(key);
            }
          } catch (err) {
            // Invalid backup data, remove it
            console.log('🧹 Removing invalid backup:', key);
            localStorage.removeItem(key);
          }
        }
      });
    };
    
    cleanupOldBackups();
  }, []);

  const handleAddToQueue = (song) => {
    console.log('🎵 Adding to queue:', song, 'isHost:', isHost);
    
    // Only hosts can add songs to the queue
    if (!isHost) {
      console.log('❌ Guest attempted to add song to queue - denied');
      setToastMessage('Only the host can add songs to the queue');
      setTimeout(() => setToastMessage(''), 2500);
      return;
    }
    
    // Check if we have stored duration for this song
    const songWithDuration = songDurationsRef.current[song.id] 
      ? { ...song, duration: songDurationsRef.current[song.id] }
      : song;
    
    const newQueue = [...queue, songWithDuration];
    setQueue(newQueue);
    
    // Show confirmation toast
    setToastMessage(`Host: "${song.name}" added to queue`);
    setTimeout(() => setToastMessage(''), 2500);
    
    // Sync updated queue to all clients
    if (socket) {
      console.log('🎵 Syncing updated queue to all clients');
      socket.emit('updateQueue', newQueue);
    }
  };

  const handleReorderQueue = (newQueue) => {
    console.log('🔄 Reordering queue:', newQueue);
    
    // Only hosts can reorder the queue
    if (!isHost) {
      console.log('❌ Guest attempted to reorder queue - denied');
      return;
    }
    
    setQueue(newQueue);
    
    // Sync to other devices
    if (socket) {
      socket.emit('updateQueue', newQueue);
    }
  };

  const handlePlayPause = (song = null) => {
    console.log('⏯️ Play/pause:', song);
    if (isHost) {
      // If no song is specified and no current song, play first song from queue
      if (!song && !currentSong && queue.length > 0) {
        const firstSong = queue[0];
        const newQueue = queue.slice(1);
        
        setCurrentSong(firstSong);
        setQueue(newQueue);
        setIsPlaying(true);
        
        // Use atomic update for song transition
        if (socket) {
          console.log('⏯️ Sending atomic song transition update');
          socket.emit('songTransition', {
            currentSong: firstSong,
            queue: newQueue,
            isPlaying: true
          });
        }
        return;
      }
      
      // If a specific song is provided (different from current), play it
      if (song && song !== currentSong) {
        setCurrentSong(song);
        setIsPlaying(true);
        
        // Use atomic update for song change
        if (socket) {
          console.log('⏯️ Sending atomic song change update');
          socket.emit('atomicUpdate', {
            currentSong: song,
            isPlaying: true
          });
        }
        return;
      }
      
      // Otherwise, just toggle play/pause for current song
      const newPlayingState = !isPlaying;
      setIsPlaying(newPlayingState);
      
      // Sync playback state
      if (socket) {
        socket.emit('updatePlaybackState', newPlayingState);
      }
    }
  };

  const handleNextSong = () => {
    console.log('⏭️ Next song');
    if (isHost) {
      if (queue.length > 0) {
        // Play next song from queue
        const nextSong = queue[0];
        const newQueue = queue.slice(1);
        
        setCurrentSong(nextSong);
        setQueue(newQueue);
        setIsPlaying(true);
        
        // Use atomic update for song transition
        if (socket) {
          console.log('⏭️ Sending atomic song transition update');
          socket.emit('songTransition', {
            currentSong: nextSong,
            queue: newQueue,
            isPlaying: true
          });
        }
      } else {
        // Queue is empty - stop playing and clear current song
        console.log('📭 Queue is empty - stopping playback');
        setCurrentSong(null);
        setIsPlaying(false);
        setCurrentTime(0);
        
        // Use atomic update for stopping
        if (socket) {
          console.log('⏭️ Sending atomic stop update');
          socket.emit('atomicUpdate', {
            currentSong: null,
            isPlaying: false
          });
        }
      }
    }
  };

  const handleStop = () => {
    console.log('⏹️ Stop');
    if (isHost) {
      setIsPlaying(false);
      setCurrentTime(0);
      
      // Sync to other devices
      if (socket) {
        socket.emit('updatePlaybackState', false);
      }
    }
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    // Could add a toast notification here
  };

  // Audio event handlers
  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
  };

  const handleDurationChange = (newDuration) => {
    setDuration(newDuration);
    
    // Store duration for future reference
    if (currentSong && newDuration > 0) {
      setSongDurations(prevDurations => ({
        ...prevDurations,
        [currentSong.id]: newDuration
      }));
      
      // Update the current song in the queue with the duration if it doesn't have one
      setQueue(prevQueue => 
        prevQueue.map(song => 
          song.id === currentSong.id && !song.duration 
            ? { ...song, duration: newDuration }
            : song
        )
      );
    }
  };

  const handleAudioError = (errorMessage) => {
    // Only set error if it's a meaningful message
    setAudioError(errorMessage && errorMessage.trim() ? errorMessage : '');
  };

  const handleVolumeChange = (newVolume) => {
    setVolume(newVolume);
  };

  const handleSeek = (newTime) => {
    if (!isHost) {
      setAudioError('Only the host can seek through the song');
      setTimeout(() => setAudioError(''), 3000);
      return;
    }
    
    setSeekTime(newTime);
    setCurrentTime(newTime);
    // Reset seekTime after a brief moment to avoid continuous seeking
    setTimeout(() => setSeekTime(null), 100);
  };

  const resetAudio = () => {
    setCurrentTime(0);
    setDuration(0);
    setAudioError('Audio reset by user');
    // Simply set a temporary error that will clear itself - this gives users feedback
    // without forcing a song reload, which could cause the infinite loop
    console.log('🔄 Audio reset requested by user');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Persistent Audio Player - always rendered */}
      <PersistentAudioPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTime}
        volume={volume}
        seekTime={seekTime}
        onNext={handleNextSong}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onError={handleAudioError}
      />

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{originalSessionName || session?.name}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                {clientCount} connected
              </span>
              <span className={`px-2 py-1 rounded text-xs ${isHost ? 'bg-purple-600' : 'bg-gray-600'}`}>
                {isHost ? 'HOST' : 'GUEST'}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={copySessionId}
              className="bg-gray-700 text-gray-300 px-3 py-1 rounded text-sm hover:bg-gray-600"
            >
              ID: {sessionId}
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex">
          {['player', 'queue'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
          {/* Browse tab only for hosts */}
          {isHost && (
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                activeTab === 'browse'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Browse
            </button>
          )}
          {/* Test tab only for hosts */}
          {isHost && (
            <button
              onClick={() => setActiveTab('test')}
              className={`flex-1 py-3 px-4 text-sm font-medium ${
                activeTab === 'test'
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🧪 Test
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {activeTab === 'player' && (
          <MusicPlayer
            currentSong={currentSong}
            isPlaying={isPlaying}
            isHost={isHost}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            error={audioError}
            queue={queue}
            onPlayPause={handlePlayPause}
            onNext={handleNextSong}
            onStop={handleStop}
            onVolumeChange={handleVolumeChange}
            onSeek={handleSeek}
          />
        )}
        
        {/* Show audio error across all tabs if present */}
        {audioError && audioError.trim() && (
          <div className="fixed bottom-4 left-4 right-4 bg-red-600 text-white p-3 rounded-lg shadow-lg z-50">
            <div className="flex items-center justify-between">
              <span>{audioError}</span>
              <div className="flex gap-2">
                <button 
                  onClick={resetAudio}
                  className="ml-3 px-3 py-1 bg-red-700 hover:bg-red-800 rounded text-sm"
                >
                  🔄 Reset
                </button>
                <button 
                  onClick={() => setAudioError('')}
                  className="ml-1 text-red-200 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Show toast message when song is added to queue */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-2 rounded-full shadow-xl z-50 flex items-center space-x-2 transform transition-all duration-300 ease-out scale-100 opacity-100 max-w-sm">
            <span className="text-sm">✅</span>
            <span className="text-sm truncate flex-1 font-medium">{toastMessage.replace('✅ ', '')}</span>
            <button 
              onClick={() => setToastMessage('')}
              className="text-green-200 hover:text-white text-xs ml-1 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}
        
        {activeTab === 'queue' && (
          <Queue
            queue={queue}
            currentSong={currentSong}
            isHost={isHost}
            onReorder={handleReorderQueue}
          />
        )}
        
        {activeTab === 'browse' && isHost && (
          <FileBrowser
            onAddToQueue={handleAddToQueue}
          />
        )}
        
        {activeTab === 'test' && isHost && (
          <AudioTest />
        )}
      </div>
    </div>
  );
};

export default Session; 