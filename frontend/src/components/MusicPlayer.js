import React, { useState } from 'react';

const MusicPlayer = ({ 
  currentSong, 
  isPlaying, 
  isHost, 
  currentTime, 
  duration, 
  volume,
  error, 
  onPlayPause, 
  onNext,
  onStop,
  onVolumeChange,
  onSeek
}) => {

  // Audio is now handled by PersistentAudioPlayer component

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange(newVolume);
  };

  const handleSeek = (e) => {
    if (!isHost || !duration) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    onSeek(newTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!currentSong) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
        <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">🎵</span>
        </div>
        <p className="text-lg">No song playing</p>
        <p className="text-sm">Add songs to the queue to get started</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {/* Audio element */}


      {/* Album Art / Song Info */}
      <div className="text-center mb-6">
        <div className="w-64 h-64 bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-2xl">
          <span className="text-6xl">🎵</span>
        </div>
        
        <h2 className="text-xl font-bold mb-1 truncate">{currentSong.name}</h2>
        <p className="text-gray-400 text-sm truncate">
          {currentSong.artists?.join(', ') || 'Unknown Artist'}
        </p>
        
        {error && (
          <p className="text-red-400 text-sm mt-2">{error}</p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div 
          className={`w-full h-2 bg-gray-700 rounded-full ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-purple-500 rounded-full transition-all duration-200 pointer-events-none"
            style={{ 
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' 
            }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        <button
          onClick={onStop}
          disabled={!isHost}
          className="w-12 h-12 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-full flex items-center justify-center transition-colors"
          title="Stop (restart from beginning)"
        >
          ⏹️
        </button>
        
        <button
          onClick={() => onPlayPause(currentSong)}
          disabled={!isHost}
          className="w-16 h-16 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-full flex items-center justify-center text-2xl transition-colors"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        
        <button
          onClick={onNext}
          disabled={!isHost}
          className="w-12 h-12 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded-full flex items-center justify-center transition-colors"
          title="Next song"
        >
          ⏭️
        </button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-3">
        <span className="text-sm">🔊</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume || 1}
          onChange={handleVolumeChange}
          className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
        <span className="text-sm text-gray-400 w-8">
          {Math.round((volume || 1) * 100)}%
        </span>
      </div>

      {/* Host/Guest Info */}
      {!isHost && (
        <div className="mt-6 p-3 bg-gray-800 rounded-lg text-center">
          <p className="text-sm text-gray-400">
            Only the host can control playback
          </p>
        </div>
      )}
    </div>
  );
};

export default MusicPlayer; 