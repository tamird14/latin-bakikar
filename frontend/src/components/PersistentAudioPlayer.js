/* eslint-disable react-hooks/exhaustive-deps */
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
  const progressCheckInterval = useRef(null);
  const lastKnownTime = useRef(0);
  const lastKnownDuration = useRef(0);
  
  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
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
        audioRef.current.play().then(() => {
          startProgressCheck(); // Start iOS backup check when playing
        }).catch(err => {
          console.error('Failed to play audio:', err);
          onErrorRef.current?.('Failed to play audio - ' + err.message);
        });
      } else {
        console.log('⏳ Skipping play attempt - too soon after last attempt');
      }
    } else if (!isPlaying && !audioRef.current.paused) {
      console.log('⏸️ Pausing audio via state change');
      audioRef.current.pause();
      stopProgressCheck(); // Stop iOS backup check when pausing
    } else if (isPlaying && isReady && !audioRef.current.paused) {
      console.log('✅ Audio already playing, no action needed');
      startProgressCheck(); // Ensure iOS backup check is running
    } else if (isPlaying && !isReady) {
      console.log('⏳ Audio not ready yet, waiting...');
    } else if (!isPlaying && audioRef.current.paused) {
      console.log('✅ Audio already paused, no action needed');
      stopProgressCheck(); // Ensure iOS backup check is stopped
    }
  }, [isPlaying, isReady, currentSrc, currentSong, currentTime]);

  // Handle song changes (only when song ID actually changes)
  const [lastLoadedSongId, setLastLoadedSongId] = useState(null);
  const loadingRef = useRef(false); // Prevent concurrent loading
  const loadingTimeoutRef = useRef(null); // Timeout for loading
  const retryCountRef = useRef(0); // Track retry attempts
  
  useEffect(() => {
    if (!currentSong || !audioRef.current) {
      if (currentSrc) {
        console.log('Clearing current song');
        stopProgressCheck(); // Stop iOS backup check when clearing song
        // Properly stop and clear audio element
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        }
        setCurrentSrc('');
        setIsReady(false);
        setLastLoadedSongId(null);
        loadingRef.current = false;
        // Clear any previous errors when successfully clearing audio
        onErrorRef.current?.(null);
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
      stopProgressCheck(); // Stop iOS backup check when loading new song
      retryCountRef.current = 0; // Reset retry count
      
      // Set a timeout to prevent infinite loading
      loadingTimeoutRef.current = setTimeout(() => {
        if (loadingRef.current) {
          console.log('⏰ Audio loading timeout - aborting');
          loadingRef.current = false;
          onErrorRef.current?.('Audio loading timeout - please try again');
          setCurrentSrc('');
          setIsReady(false);
        }
      }, 60000); // 60 second timeout (increased from 30)
      
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
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
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
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      }
    };

    loadSong();

    // Cleanup function to handle component unmount or song change
    return () => {
      if (loadingRef.current) {
        console.log('Cancelling in-progress song load due to cleanup');
        loadingRef.current = false;
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
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
    console.error('Audio error:', e);
    
    // Don't report "empty src" errors when we have no current song (expected when queue ends)
    if (!currentSongRef.current && e.target?.error?.message?.includes('Empty src')) {
      console.log('Audio empty src error when no current song (expected after queue ends)');
      return;
    }
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to load audio file';
    
    if (e.target?.error) {
      const error = e.target.error;
      console.log('Audio error details:', error);
      
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Audio loading was aborted';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error while loading audio';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'Audio format not supported or corrupted file';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          // Try to get more specific information about the unsupported format
          const fileName = currentSongRef.current?.name || '';
          const fileExtension = fileName.toLowerCase().split('.').pop();
          
          if (fileExtension) {
            errorMessage = `Audio format .${fileExtension} not supported by browser`;
          } else {
            errorMessage = 'Audio format not supported by browser';
          }
          break;
        default:
          errorMessage = `Audio error: ${error.message || 'Unknown error'}`;
      }
    }
    
    console.log('Setting error message:', errorMessage);
    onErrorRef.current?.(errorMessage);
    setCurrentSrc('');
    setIsReady(false);
    
    // Clear loading state if there was an error
    if (loadingRef.current) {
      console.log('Clearing loading state due to error');
      loadingRef.current = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      lastKnownTime.current = audioRef.current.currentTime;
      lastKnownDuration.current = audioRef.current.duration || 0;
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

  // iOS backup system for song progression
  const checkSongProgress = () => {
    if (!audioRef.current || !currentSongRef.current || !isPlayingRef.current) {
      return;
    }

    const currentTime = audioRef.current.currentTime;
    const duration = audioRef.current.duration;
    
    // If song should have ended (within 1 second of duration), trigger next song
    if (duration > 0 && currentTime >= duration - 1) {
      console.log('🍎 iOS: Song ending detected via backup timer');
      clearInterval(progressCheckInterval.current);
      progressCheckInterval.current = null;
      handleEnded();
    }
  };

  const startProgressCheck = () => {
    if (isIOS && !progressCheckInterval.current) {
      console.log('🍎 iOS: Starting backup progress check');
      progressCheckInterval.current = setInterval(checkSongProgress, 1000);
    }
  };

  const stopProgressCheck = () => {
    if (progressCheckInterval.current) {
      console.log('🍎 iOS: Stopping backup progress check');
      clearInterval(progressCheckInterval.current);
      progressCheckInterval.current = null;
    }
  };

  // Handle Page Visibility API for iOS background support
  useEffect(() => {
    if (!isIOS) return;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🍎 iOS: Page hidden, stopping progress check');
        stopProgressCheck();
      } else {
        console.log('🍎 iOS: Page visible, checking if should resume progress check');
        // Only restart if audio is playing
        if (audioRef.current && !audioRef.current.paused && isPlayingRef.current) {
          startProgressCheck();
          // Check immediately in case song ended while in background
          setTimeout(checkSongProgress, 100);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopProgressCheck(); // Cleanup on unmount
    };
  }, []);

  const handleEnded = () => {
    console.log('🎵 Song ended, moving to next');
    stopProgressCheck(); // Stop iOS backup check
    
    // Immediately pause to prevent any restart
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsReady(false); // Prevent any play attempts during transition
    
    // Small delay to ensure audio is fully stopped before triggering next
    setTimeout(() => {
      onNextRef.current?.();
    }, 100);
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