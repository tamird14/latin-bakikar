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
  seekTime,
  queue // Add queue prop for pre-buffering
}) => {
  const audioRef = useRef(null);
  const hiddenAudioRef = useRef(null); // Hidden audio for pre-buffering
  const [currentSrc, setCurrentSrc] = useState('');
  const [isReady, setIsReady] = useState(false);
  const lastPlayAttempt = useRef(0);
  const isSeekingRef = useRef(false);
  const progressCheckInterval = useRef(null);
  const lastKnownTime = useRef(0);
  const lastKnownDuration = useRef(0);
  const errorTimeoutRef = useRef(null); // Timeout for error reporting
  const isLoadingRef = useRef(false); // Track if we're in initial loading phase
  
  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  // Use refs to avoid stale closures
  const currentSongRef = useRef(currentSong);
  const isPlayingRef = useRef(isPlaying);
  const onErrorRef = useRef(onError);
  const onNextRef = useRef(onNext);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onDurationChangeRef = useRef(onDurationChange);
  const queueRef = useRef(queue);
  
  // Update refs when props change
  useEffect(() => {
    currentSongRef.current = currentSong;
    isPlayingRef.current = isPlaying;
    onErrorRef.current = onError;
    onNextRef.current = onNext;
    onTimeUpdateRef.current = onTimeUpdate;
    onDurationChangeRef.current = onDurationChange;
    queueRef.current = queue;
  });

  // Simple pre-buffering: when a song starts playing, pre-buffer the next song
  useEffect(() => {
    if (!isPlaying || !currentSong || !queue || queue.length === 0) {
      // Clean up hidden audio if no next song
      if (hiddenAudioRef.current) {
        hiddenAudioRef.current.src = '';
        hiddenAudioRef.current = null;
      }
      return;
    }

    // Get the next song from queue
    const nextSong = queue[0];
    if (!nextSong || nextSong.id === currentSong.id) {
      return; // No next song or same song
    }

    // Pre-buffer the next song silently
    const preBufferNextSong = async () => {
      try {
        console.log('🎵 Pre-buffering next song:', nextSong.name);
        const streamData = await getStreamUrl(nextSong.id);
        
        // Create hidden audio element and start loading
        hiddenAudioRef.current = new Audio(streamData.url);
        hiddenAudioRef.current.preload = 'auto';
        
        // Don't handle errors - if pre-buffering fails, it's invisible to user
        hiddenAudioRef.current.onerror = () => {
          console.log('Pre-buffering failed for:', nextSong.name, '(this is OK)');
          hiddenAudioRef.current = null;
        };
        
        console.log('✅ Pre-buffering started for:', nextSong.name);
      } catch (err) {
        console.log('Pre-buffering failed:', err.message, '(this is OK)');
        hiddenAudioRef.current = null;
      }
    };

    preBufferNextSong();
  }, [isPlaying, currentSong?.id, queue]);

  // Handle stop command (when currentTime is reset to 0)
  useEffect(() => {
    if (audioRef.current && currentTime === 0 && audioRef.current.currentTime > 0.1) {
      console.log('🛑 Stop command detected - pausing and resetting to beginning');
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
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

    if (isPlaying && audioRef.current.paused && audioRef.current.src) {
      const now = Date.now();
      if (now - lastPlayAttempt.current > 500) { // Prevent rapid play attempts
        console.log('▶️ Attempting to play audio (user wants to play)');
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
    } else if (isPlaying && !audioRef.current.paused) {
      console.log('✅ Audio already playing, no action needed');
      startProgressCheck(); // Ensure iOS backup check is running
    } else if (isPlaying && audioRef.current.paused) {
      console.log('⏳ User wants to play but audio is paused - waiting for canplay event');
    } else if (!isPlaying && audioRef.current.paused) {
      console.log('✅ Audio already paused, no action needed');
      stopProgressCheck(); // Ensure iOS backup check is stopped
    }
  }, [isPlaying, isReady, currentSrc, currentSong, currentTime]);

  // Handle song changes (only when song ID actually changes)
  const [lastLoadedSongId, setLastLoadedSongId] = useState(null);
  
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

    console.log('Loading NEW song:', currentSong.name, 'Previous ID:', lastLoadedSongId, 'New ID:', currentSongId);

    const loadSong = async () => {
      stopProgressCheck(); // Stop iOS backup check when loading new song
      
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
        isLoadingRef.current = true; // Mark as loading
        
        // Small delay to ensure audio element is fully reset
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Check if we're still supposed to load this song (component might have unmounted or song changed)
        if (!currentSong || currentSong.id !== currentSongId || !audioRef.current) {
          console.log('Song changed during loading delay, aborting');
          isLoadingRef.current = false;
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
          isLoadingRef.current = false;
        }
        
      } catch (err) {
        console.error('Failed to load song:', err);
        onErrorRef.current?.('Failed to load song: ' + err.message);
        setCurrentSrc('');
        setIsReady(false);
        isLoadingRef.current = false;
      }
    };

    loadSong();

    // Cleanup function to handle component unmount or song change
    return () => {
      // Clear any pending error timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
      // Reset loading flag
      isLoadingRef.current = false;
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
    
    // Clear any pending error timeout since audio is now ready
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    
    // Mark as no longer loading
    isLoadingRef.current = false;
    
    // Allow progressive streaming - don't pause if user wants to play
    if (audioRef.current && !audioRef.current.paused && !isSeekingRef.current) {
      if (isPlayingRef.current) {
        console.log('✅ Progressive streaming - audio started playing automatically and user wants to play');
        // Let it continue playing - this is what we want for progressive streaming
      } else {
        console.log('⏸️ Pausing audio that started playing automatically (user doesn\'t want to play)');
        audioRef.current.pause();
      }
    } else if (isSeekingRef.current) {
      console.log('Audio ready during seek operation - preserving playback state');
    }
    
    setIsReady(true);
    onErrorRef.current?.(null); // Clear any previous errors
    // Don't auto-play here, let the useEffect handle it
  };

  const handleError = (e) => {
    console.log('🎵 Audio error triggered:', {
      error: e.target?.error?.message,
      isReady,
      isLoading: isLoadingRef.current,
      hasCurrentSong: !!currentSongRef.current,
      currentSong: currentSongRef.current?.name
    });
    
    // Don't report "empty src" errors when we have no current song (expected when queue ends)
    if (!currentSongRef.current && e.target?.error?.message?.includes('Empty src')) {
      console.log('Audio empty src error when no current song (expected after queue ends)');
      return;
    }
    
    // Clear any existing error timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    
    // Completely suppress all errors during initial loading phase
    if (!isReady || isLoadingRef.current) {
      console.log('Audio error during initial loading - completely ignoring:', e.target?.error?.message);
      
      // Only report error after 5 seconds if still not working
      errorTimeoutRef.current = setTimeout(() => {
        if (!isReady) {
          console.error('Audio still not ready after 5 seconds - reporting error');
          const finalErrorMessage = e.target?.error ? 
            `Audio error: ${e.target.error.message || 'Unknown error'}` : 
            'Failed to load audio file';
          
          onErrorRef.current?.(finalErrorMessage);
          setCurrentSrc('');
          setIsReady(false);
        }
      }, 5000);
      
      return;
    }
    
    // Additional protection: if we have a current song but audio isn't ready, suppress errors
    if (currentSongRef.current && !isReady) {
      console.log('Audio error while song exists but not ready - suppressing:', e.target?.error?.message);
      
      // Only report error after 3 seconds if still not working
      errorTimeoutRef.current = setTimeout(() => {
        if (!isReady) {
          console.error('Audio still not ready after 3 seconds - reporting error');
          const finalErrorMessage = e.target?.error ? 
            `Audio error: ${e.target.error.message || 'Unknown error'}` : 
            'Failed to load audio file';
          
          onErrorRef.current?.(finalErrorMessage);
          setCurrentSrc('');
          setIsReady(false);
        }
      }, 3000);
      
      return;
    }
    
    // Only report errors if audio was previously ready and now fails
    console.error('Audio error after being ready:', e);
    const finalErrorMessage = e.target?.error ? 
      `Audio error: ${e.target.error.message || 'Unknown error'}` : 
      'Failed to load audio file';
    
    onErrorRef.current?.(finalErrorMessage);
    setCurrentSrc('');
    setIsReady(false);
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
      onCanPlayThrough={() => console.log('🎵 Audio can play through entire file')}
      onProgress={() => {
        if (audioRef.current) {
          const buffered = audioRef.current.buffered;
          if (buffered.length > 0) {
            const bufferedEnd = buffered.end(buffered.length - 1);
            const duration = audioRef.current.duration || 0;
            if (duration > 0) {
              const bufferedPercent = (bufferedEnd / duration) * 100;
              console.log(`📊 Buffering progress: ${bufferedPercent.toFixed(1)}%`);
            }
          }
        }
      }}
      onError={handleError}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      onPlaying={() => {
        console.log('▶️ Audio started playing');
        // Clear any error messages when audio actually starts playing
        onErrorRef.current?.(null);
      }}
      onPause={() => console.log('⏸️ Audio paused')}
      onSeeking={handleSeeking}
      onSeeked={handleSeeked}
      preload="metadata"
    />
  );
};

export default PersistentAudioPlayer; 