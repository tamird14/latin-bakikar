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

  // Update refs when values change
  useEffect(() => {
    currentSongRef.current = currentSong;
    originalSessionNameRef.current = originalSessionName;
    songDurationsRef.current = songDurations;
  }, [currentSong, originalSessionName, songDurations]);

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        // Get client ID from socket for heartbeat tracking
        const clientId = socket?.getClientId ? socket.getClientId() : null;
        const sessionData = await getSession(sessionId, clientId);
        console.log('🔄 Initial session data loaded:', sessionData);
        console.log('👥 Initial client count:', sessionData.clientCount);
        setSession(sessionData);
        setCurrentSong(sessionData.currentSong);
        
        // Apply stored durations to queue items
        const queueWithDurations = (sessionData.queue || []).map(song => 
          songDurationsRef.current[song.id] && !song.duration 
            ? { ...song, duration: songDurationsRef.current[song.id] }
            : song
        );
        setQueue(queueWithDurations);
        
        setIsPlaying(sessionData.isPlaying);
        setClientCount(sessionData.clientCount);
        
        // Store the original session name if this is the first load
        if (sessionData.name && sessionData.name !== 'Music Session') {
          if (!originalSessionNameRef.current) {
            setOriginalSessionName(sessionData.name);
            localStorage.setItem(`session_name_${sessionId}`, sessionData.name);
          }
          // Always use the stored original name if available
          if (originalSessionNameRef.current && sessionData.name === 'Music Session') {
            sessionData.name = originalSessionNameRef.current;
          }
        }
        
        setLoading(false);
      } catch (err) {
        setError('Session not found');
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId, socket]); // Add socket dependency to get client ID

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
        console.log('🔄 Guest is host:', isHost, 'Current queue:', queue);
        setQueue(newQueue || []);
      });
      
      socket.on('songChanged', (newSong) => {
        console.log('🔄 Song changed from sync:', newSong);
        console.log('🔄 Guest is host:', isHost, 'Current song:', currentSong);
        setCurrentSong(newSong);
      });
      
      socket.on('playbackStateChanged', (newPlayingState) => {
        console.log('🔄 Playback state changed from sync:', newPlayingState);
        console.log('🔄 Guest is host:', isHost, 'Current playing state:', isPlaying);
        setIsPlaying(newPlayingState);
      });
      
      // For guests: Force a session reload after a short delay to get the real state
      // This helps when the backend's in-memory session state was lost
      if (!isHost) {
        const forceSync = setTimeout(async () => {
          try {
            console.log('🔄 Guest forcing session sync...');
            console.log('🔄 Current local state - currentSong:', currentSong, 'queue:', queue);
            
            const clientId = socket?.getClientId ? socket.getClientId() : null;
            const freshSessionData = await getSession(sessionId, clientId);
            console.log('🔄 Fresh session data for guest:', freshSessionData);
            
            // Always update if we have fresh data, even if our local state is empty
            if (freshSessionData) {
              console.log('✅ Updating guest state with fresh data...');
              setCurrentSong(freshSessionData.currentSong);
              setQueue(freshSessionData.queue || []);
              setIsPlaying(freshSessionData.isPlaying);
            }
          } catch (err) {
            console.error('❌ Failed to force sync session:', err);
          }
        }, 1000); // Wait 1 second after joining
        
        // Cleanup timeout
        return () => {
          clearTimeout(forceSync);
          console.log('🧹 Cleaning up session sync for:', sessionId);
          socket.emit('leaveSession', { sessionId });
          socket.off('queueUpdated');
          socket.off('songChanged');
          socket.off('playbackStateChanged');
        };
      }
      
      // Cleanup for hosts
      return () => {
        console.log('🧹 Cleaning up session sync for:', sessionId);
        socket.emit('leaveSession', { sessionId });
        socket.off('queueUpdated');
        socket.off('songChanged');
        socket.off('playbackStateChanged');
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isHost]); // Add isHost dependency for the guest-specific logic

  // Force republish current state - useful when guests join and might have stale data
  const republishCurrentState = useCallback(() => {
    if (isHost && socket) {
      console.log('📢 Host republishing current state...');
      console.log('📢 Current song:', currentSong);
      console.log('📢 Current queue:', queue);
      console.log('📢 Playing state:', isPlaying);
      
      if (currentSong) {
        console.log('📢 Sending updateCurrentSong event');
        socket.emit('updateCurrentSong', currentSong);
      }
      if (queue && queue.length > 0) {
        console.log('📢 Sending updateQueue event with', queue.length, 'songs');
        socket.emit('updateQueue', queue);
      }
      console.log('📢 Sending updatePlaybackState event');
      socket.emit('updatePlaybackState', isPlaying);
    } else {
      console.log('📢 Not republishing - isHost:', isHost, 'socket:', !!socket);
    }
  }, [isHost, socket, currentSong, queue, isPlaying]);

  // Update client count from session data
  useEffect(() => {
    if (sessionData && sessionData.clientCount !== undefined) {
      console.log('👥 Updating client count from session data:', sessionData.clientCount);
      const previousCount = clientCount;
      setClientCount(sessionData.clientCount);
      
      // If we're the host and client count increased, republish state for new guests
      if (isHost && previousCount > 0 && sessionData.clientCount > previousCount) {
        console.log('👥 New guest joined, republishing state...');
        setTimeout(() => republishCurrentState(), 500); // Small delay to ensure guest is ready
      }
    }
  }, [sessionData, clientCount, isHost, republishCurrentState]);

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

  const handleAddToQueue = (song) => {
    console.log('🎵 Adding to queue:', song);
    
    // Check if we have stored duration for this song
    const songWithDuration = songDurationsRef.current[song.id] 
      ? { ...song, duration: songDurationsRef.current[song.id] }
      : song;
    
    const newQueue = [...queue, songWithDuration];
    setQueue(newQueue);
    
    // Show confirmation toast
    setToastMessage(`"${song.name}" added to queue`);
    setTimeout(() => setToastMessage(''), 2500);
    
    // Sync to other devices
    if (socket) {
      socket.emit('updateQueue', newQueue);
    }
  };

  const handleReorderQueue = (newQueue) => {
    console.log('🔄 Reordering queue:', newQueue);
    if (isHost) {
      setQueue(newQueue);
      
      // Sync to other devices
      if (socket) {
        socket.emit('updateQueue', newQueue);
      }
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
        
        // Sync to other devices
        if (socket) {
          socket.emit('updateCurrentSong', firstSong);
          socket.emit('updateQueue', newQueue);
          socket.emit('updatePlaybackState', true);
        }
        return;
      }
      
      // If a specific song is provided (different from current), play it
      if (song && song !== currentSong) {
        setCurrentSong(song);
        setIsPlaying(true);
        
        // Sync current song
        if (socket) {
          socket.emit('updateCurrentSong', song);
          socket.emit('updatePlaybackState', true);
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
        
        // Sync to other devices
        if (socket) {
          socket.emit('updateCurrentSong', nextSong);
          socket.emit('updateQueue', newQueue);
          socket.emit('updatePlaybackState', true);
        }
      } else {
        // Queue is empty - stop playing and clear current song
        console.log('📭 Queue is empty - stopping playback');
        setCurrentSong(null);
        setIsPlaying(false);
        setCurrentTime(0);
        
        // Sync to other devices
        if (socket) {
          socket.emit('updateCurrentSong', null);
          socket.emit('updatePlaybackState', false);
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
          {['player', 'queue', 'browse', 'test'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 text-sm font-medium capitalize ${
                activeTab === tab
                  ? 'text-purple-400 border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'test' ? '🧪 Test' : tab}
            </button>
          ))}
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
        
        {activeTab === 'browse' && (
          <FileBrowser
            onAddToQueue={handleAddToQueue}
          />
        )}
        
        {activeTab === 'test' && (
          <AudioTest />
        )}
      </div>
    </div>
  );
};

export default Session; 