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
  const [isHost, setIsHost] = useState(searchParams.get('host') === 'true'); // eslint-disable-line no-unused-vars
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

  // Socket connection disabled for serverless deployment
  useEffect(() => {
    console.log('Socket.io features disabled for serverless deployment');
    // Real-time features temporarily disabled
    // Session will work in basic mode with API calls only
  }, [socket, isConnected, sessionId, isHost]);

  const handleAddToQueue = (song) => {
    // Local mode - no socket connection needed
    console.log('🎵 Adding to queue (local mode):', song);
    setQueue(prev => [...prev, song]);
  };

  const handleReorderQueue = (newQueue) => {
    // Local mode - no socket connection needed  
    console.log('🔄 Reordering queue (local mode):', newQueue);
    if (isHost) {
      setQueue(newQueue);
    }
  };

  const handlePlayPause = (song = null) => {
    // Local mode - no socket connection needed
    console.log('⏯️ Play/pause (local mode):', song);
    if (isHost) {
      const songToPlay = song || currentSong;
      setIsPlaying(!isPlaying);
      if (songToPlay && songToPlay !== currentSong) {
        setCurrentSong(songToPlay);
      }
    }
  };

  const handleNextSong = () => {
    // Local mode - no socket connection needed
    console.log('⏭️ Next song (local mode)');
    if (isHost && queue.length > 0) {
      const nextSong = queue[0];
      setCurrentSong(nextSong);
      setQueue(prev => prev.slice(1));
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    // Local mode - no socket connection needed
    console.log('⏹️ Stop (local mode)');
    if (isHost) {
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