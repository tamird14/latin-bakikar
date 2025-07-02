import React, { useRef, useEffect, useState } from 'react';
import { getStreamUrl } from '../services/api';

const PersistentAudioPlayer = ({ 
  currentSong, 
  isPlaying, 
  onPlayPause, 
  onNext, 
  onTimeUpdate, 
  onDurationChange,
  onError,
  currentTime,
  volume,
  seekTime
}) => {
  const audioRef = useRef(null);
  const [currentSrc, setCurrentSrc] = useState('');
  const [isReady, setIsReady] = useState(false);
  const lastPlayAttempt = useRef(0);
  const isSeekingRef = useRef(false);
  
  // Use refs to avoid stale closures
  const currentSongRef = useRef(currentSong);
  const isPlayingRef = useRef(isPlaying);
  const onErrorRef = useRef(onError);
  const onNextRef = useRef(onNext);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationChangeRef = useRef(onDurationChange);
  
  // Update refs when props change
  useEffect(() => {
    currentSongRef.current = currentSong;
    isPlayingRef.current = isPlaying;
    onErrorRef.current = onError;
    onNextRef.current = onNext;
    onTimeUpdateRef.current = onTimeUpdate;
    onDurationChangeRef.current = onDurationChange;
  });

  // Handle stop command (when currentTime is reset to 0)
  useEffect(() => {
    if (audioRef.current && currentTime === 0 && audioRef.current.currentTime > 0.1) {
      console.log('🛑 Stop command detected - pausing and resetting to beginning');
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Ensure we don't try to play after stopping
      setIsReady(prev => {
        if (prev) {
          console.log('🛑 Keeping audio ready but ensuring it stays paused');
        }
        return prev;
      });
    }
  }, [currentTime]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current && volume !== undefined) {
      audioRef.current.volume = volume;
      console.log('🔊 Volume set to:', Math.round(volume * 100) + '%');
    }
  }, [volume]);

  // Handle seek commands
  useEffect(() => {
    if (audioRef.current && seekTime !== undefined && seekTime !== null) {
      console.log('⏩ Seeking to:', seekTime + 's');
      // Don't set isSeekingRef here - let the native seeking events handle it
      audioRef.current.currentTime = seekTime;
    }
  }, [seekTime]);

  // Handle play/pause state changes
  useEffect(() => {
    if (!audioRef.current || !currentSrc || !currentSong) return;

    console.log('🎵 Play/pause effect triggered:', { 
      isPlaying, 
      isReady, 
      audioPaused: audioRef.current.paused,
      audioSrc: !!audioRef.current.src,
      currentTime
    });

    if (isPlaying && isReady && audioRef.current.paused && audioRef.current.src) {
      const now = Date.now();
      if (now - lastPlayAttempt.current > 500) { // Prevent rapid play attempts
        console.log('▶️ Attempting to play audio (ready and paused)');
        lastPlayAttempt.current = now;
        audioRef.current.play().catch(err => {
          console.error('Failed to play audio:', err);
          onErrorRef.current?.('Failed to play audio - ' + err.message);
        });
      } else {
        console.log('⏳ Skipping play attempt - too soon after last attempt');
      }
    } else if (!isPlaying && !audioRef.current.paused) {
      console.log('⏸️ Pausing audio via state change');
      audioRef.current.pause();
    } else if (isPlaying && isReady && !audioRef.current.paused) {
      console.log('✅ Audio already playing, no action needed');
    } else if (isPlaying && !isReady) {
      console.log('⏳ Audio not ready yet, waiting...');
    } else if (!isPlaying && audioRef.current.paused) {
      console.log('✅ Audio already paused, no action needed');
    }
  }, [isPlaying, isReady, currentSrc]); // Re-added isPlaying but kept it minimal

  // Handle song changes (only when song ID actually changes)
  const [lastLoadedSongId, setLastLoadedSongId] = useState(null);
  const loadingRef = useRef(false); // Prevent concurrent loading
  
  useEffect(() => {
    if (!currentSong || !audioRef.current) {
      if (currentSrc) {
        console.log('Clearing current song');
        setCurrentSrc('');
        setIsReady(false);
        setLastLoadedSongId(null);
        loadingRef.current = false;
        if (audioRef.current) {
          audioRef.current.src = '';
          audioRef.current.load();
        }
      }
      return;
    }

    // Only reload if it's actually a different song
    const currentSongId = currentSong.id;
    
    if (lastLoadedSongId === currentSongId) {
      console.log('Same song already loaded, no need to reload:', currentSong.name);
      return;
    }

    // Prevent concurrent loading
    if (loadingRef.current) {
      console.log('Song loading already in progress, skipping:', currentSong.name);
      return;
    }

    console.log('Loading NEW song:', currentSong.name, 'Previous ID:', lastLoadedSongId, 'New ID:', currentSongId);

    const loadSong = async () => {
      loadingRef.current = true; // Mark as loading
      
      try {
        // Immediately stop current playback and reset state
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.src = '';
        }
        
        setIsReady(false); // Reset ready state
        setCurrentSrc(''); // Clear current source
        onErrorRef.current?.(null); // Clear previous errors
        
        // Small delay to ensure audio element is fully reset
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Check if we're still supposed to load this song (component might have unmounted or song changed)
        if (!currentSong || currentSong.id !== currentSongId || !audioRef.current) {
          console.log('Song changed during loading delay, aborting');
          loadingRef.current = false;
          return;
        }
        
        const streamData = await getStreamUrl(currentSongId);
        console.log('Got stream URL:', streamData.url);
        console.log('Stream metadata:', streamData.metadata);
        
        // Final check before setting the audio source
        if (currentSong && currentSong.id === currentSongId && audioRef.current) {
          audioRef.current.src = streamData.url;
          setCurrentSrc(streamData.url);
          setLastLoadedSongId(currentSongId);
          audioRef.current.load();
        } else {
          console.log('Song changed during loading, skipping');
          console.log('Expected:', currentSongId, 'Current:', currentSong?.id);
        }
        
      } catch (err) {
        console.error('Failed to load song:', err);
        onErrorRef.current?.('Failed to load song: ' + err.message);
        setCurrentSrc('');
        setIsReady(false);
      } finally {
        loadingRef.current = false; // Always clear loading flag
      }
    };

    loadSong();

    // Cleanup function to handle component unmount or song change
    return () => {
      if (loadingRef.current) {
        console.log('Cancelling in-progress song load due to cleanup');
        loadingRef.current = false;
      }
    };
  }, [currentSong?.id]); // Only depend on song ID

  // Audio event handlers
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      console.log('Audio metadata loaded, duration:', audioRef.current.duration);
      onDurationChangeRef.current?.(audioRef.current.duration);
    }
  };

  const handleCanPlay = () => {
    console.log('Audio can play - ready to stream');
    
    // Don't pause if we're currently seeking - seeking should preserve playback state
    if (audioRef.current && !audioRef.current.paused && !isSeekingRef.current) {
      console.log('Pausing audio that started playing automatically');
      audioRef.current.pause();
    } else if (isSeekingRef.current) {
      console.log('Audio ready during seek operation - preserving playback state');
    }
    
    setIsReady(true);
    onErrorRef.current?.(null); // Clear any previous errors
    // Don't auto-play here, let the useEffect handle it
  };

  const handleError = (e) => {
    // Don't report errors if we're currently loading a new song (prevents false errors during transitions)
    if (loadingRef.current) {
      console.log('Audio error during loading (expected during song transitions):', e);
      return;
    }
    
    console.error('Audio error:', e);
    const errorMessage = e.target?.error ? 
      `Audio error: ${e.target.error.message || 'Unknown error'}` : 
      'Failed to load audio file';
    
    onErrorRef.current?.(errorMessage);
    setCurrentSrc('');
    setIsReady(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      onTimeUpdateRef.current?.(audioRef.current.currentTime);
    }
  };

  const handleSeeking = () => {
    console.log('🔍 Audio seeking started');
    isSeekingRef.current = true;
  };

  const handleSeeked = () => {
    console.log('✅ Audio seeking completed');
    // Small delay to ensure any canPlay events are handled properly
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  };

  const handleEnded = () => {
    console.log('🎵 Song ended, moving to next');
    // Immediately pause to prevent any restart
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsReady(false); // Prevent any play attempts during transition
    onNextRef.current?.();
  };

  return (
    <audio
      ref={audioRef}
      onLoadStart={() => console.log('🔄 Audio load started')}
      onLoadedMetadata={handleLoadedMetadata}
      onCanPlay={handleCanPlay}
      onError={handleError}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      onPlaying={() => console.log('▶️ Audio started playing')}
      onPause={() => console.log('⏸️ Audio paused')}
      onSeeking={handleSeeking}
      onSeeked={handleSeeked}
      preload="metadata"
    />
  );
};

export default PersistentAudioPlayer; 