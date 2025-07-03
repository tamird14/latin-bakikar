import React, { useState, useEffect, useRef } from 'react';
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
  const { socket, isConnected } = useSocket();
  
  const [session, setSession] = useState(null);
  const [isHost, setIsHost] = useState(searchParams.get('host') === 'true');
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
  
  // Ref to track current song for socket comparisons
  const currentSongRef = useRef(null);

  // Update ref when currentSong changes
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // Load session data
  useEffect(() => {
    const loadSession = async () => {
      try {
        const sessionData = await getSession(sessionId);
        setSession(sessionData);
        setCurrentSong(sessionData.currentSong);
        setQueue(sessionData.queue || []);
        setIsPlaying(sessionData.isPlaying);
        setClientCount(sessionData.clientCount);
        setLoading(false);
      } catch (err) {
        setError('Session not found');
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  // Socket connection and event handlers
  useEffect(() => {
    if (!socket || !isConnected || !sessionId) return;

    // Join the session
    socket.emit('join-session', {
      sessionId,
      userType: isHost ? 'host' : 'guest'
    });

    // Socket event listeners
    socket.on('session-state', (data) => {
      console.log('📡 Socket: session-state received');
      if (data.currentSong?.id !== currentSongRef.current?.id) {
        setCurrentSong(data.currentSong);
      }
      setQueue(data.queue || []);
      setIsPlaying(data.isPlaying);
      setIsHost(data.isHost);
    });

    socket.on('host-status', (data) => {
      console.log('📡 Socket: host-status received');
      setIsHost(data.isHost);
    });

    socket.on('queue-updated', (newQueue) => {
      console.log('📡 Socket: queue-updated received', {
        queueLength: newQueue.length,
        firstSong: newQueue[0]?.name
      });
      setQueue(newQueue);
    });

    socket.on('playback-state', (data) => {
      console.log('📡 Socket: playback-state received', {
        isPlaying: data.isPlaying,
        newSong: data.currentSong?.name,
        newSongId: data.currentSong?.id,
        previousSong: currentSongRef.current?.name,
        previousSongId: currentSongRef.current?.id,
        willUpdateSong: data.currentSong && data.currentSong.id !== currentSongRef.current?.id
      });
      setIsPlaying(data.isPlaying);
      // Only update current song if it's actually different
      if (data.currentSong && data.currentSong.id !== currentSongRef.current?.id) {
        setCurrentSong(data.currentSong);
      }
    });

    socket.on('song-changed', (data) => {
      console.log('📡 Socket: song-changed received', {
        newSong: data.currentSong?.name,
        newSongId: data.currentSong?.id,
        previousSong: currentSongRef.current?.name,
        previousSongId: currentSongRef.current?.id,
        queueLength: data.queue?.length,
        isPlaying: data.isPlaying
      });
      if (data.currentSong?.id !== currentSongRef.current?.id) {
        setCurrentSong(data.currentSong);
      }
      setQueue(data.queue);
      setIsPlaying(data.isPlaying);
    });

    socket.on('client-count', (count) => {
      setClientCount(count);
    });

    socket.on('host-disconnected', () => {
      setIsHost(false);
      setIsPlaying(false);
    });

    socket.on('error', (data) => {
      setError(data.message);
    });

    socket.on('stop-song', () => {
      console.log('📡 Socket: stop-song received');
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      socket.off('session-state');
      socket.off('host-status');
      socket.off('queue-updated');
      socket.off('playback-state');
      socket.off('song-changed');
      socket.off('client-count');
      socket.off('host-disconnected');
      socket.off('error');
      socket.off('stop-song');
    };
  }, [socket, isConnected, sessionId, isHost]);

  const handleAddToQueue = (song) => {
    if (socket) {
      socket.emit('add-to-queue', { song });
    }
  };

  const handleReorderQueue = (newQueue) => {
    if (socket && isHost) {
      socket.emit('reorder-queue', { queue: newQueue });
    }
  };

  const handlePlayPause = (song = null) => {
    if (socket && isHost) {
      const songToPlay = song || currentSong;
      console.log('🎵 Frontend: Emitting play-pause', {
        isPlaying: !isPlaying,
        song: songToPlay?.name,
        songId: songToPlay?.id,
        isHost,
        socketConnected: socket.connected
      });
      socket.emit('play-pause', {
        isPlaying: !isPlaying,
        song: songToPlay
      });
    } else {
      console.log('❌ Cannot play-pause:', { socket: !!socket, isHost, isPlaying });
    }
  };

  const handleNextSong = () => {
    console.log('⏭️ Frontend: Next song requested', {
      socket: !!socket,
      isHost,
      socketConnected: socket?.connected,
      currentQueue: queue.length,
      currentSong: currentSong?.name
    });
    if (socket && isHost) {
      socket.emit('next-song');
    } else {
      console.log('❌ Cannot emit next-song:', { socket: !!socket, isHost });
    }
  };

  const handleStop = () => {
    if (socket && isHost) {
      socket.emit('stop-song');
      setIsPlaying(false);
      setCurrentTime(0);
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
            <h1 className="text-xl font-bold">{session?.name}</h1>
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
        
        {activeTab === 'queue' && (
          <Queue
            queue={queue}
            currentSong={currentSong}
            isHost={isHost}
            onReorder={handleReorderQueue}
            onPlayPause={handlePlayPause}
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