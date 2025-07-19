import React, { useRef, useEffect, useState } from 'react';
import { getStreamUrl } from '../services/api';

const AudioPreBuffer = ({ 
  currentSong, 
  queue, 
  isHost,
  onPreBufferReady,
  onPreBufferError 
}) => {
  const preBufferRef = useRef(null);
  const [preBufferedSong, setPreBufferedSong] = useState(null);
  const [isPreBuffering, setIsPreBuffering] = useState(false);
  const [preBufferError, setPreBufferError] = useState(null);
  
  // Track which songs have been pre-buffered to avoid duplicate pre-buffering
  const preBufferedSongsRef = useRef(new Set());
  
  // Get the next song in queue (first song in queue)
  const getNextSong = () => {
    if (!queue || queue.length === 0) return null;
    return queue[0];
  };

  // Check if we should pre-buffer
  const shouldPreBuffer = () => {
    // Only pre-buffer if we're a host and there's a current song playing
    if (!isHost || !currentSong) return false;
    
    const nextSong = getNextSong();
    if (!nextSong) return false;
    
    // Don't pre-buffer if it's the same song
    if (nextSong.id === currentSong.id) return false;
    
    // Don't pre-buffer if we're already pre-buffering this song
    if (preBufferedSong && preBufferedSong.id === nextSong.id) return false;
    
    // Don't pre-buffer if this song has already been pre-buffered
    if (preBufferedSongsRef.current.has(nextSong.id)) return false;
    
    return true;
  };

  // Pre-buffer the next song
  const preBufferNextSong = async () => {
    const nextSong = getNextSong();
    if (!nextSong || !preBufferRef.current) return;

    console.log('🎵 Pre-buffering next song:', nextSong.name);
    setIsPreBuffering(true);
    setPreBufferError(null);

    try {
      // Get the stream URL for the next song
      const streamData = await getStreamUrl(nextSong.id);
      console.log('🎵 Pre-buffer stream URL obtained:', streamData.url);

      // Set the audio source
      preBufferRef.current.src = streamData.url;
      preBufferRef.current.load();

      // The audio will start loading automatically
      // We'll handle the 'canplay' event to know when it's ready
      
    } catch (error) {
      console.error('❌ Pre-buffer failed:', error);
      setPreBufferError(`Failed to pre-buffer: ${error.message}`);
      onPreBufferError?.(`Failed to pre-buffer ${nextSong.name}: ${error.message}`);
      setIsPreBuffering(false);
    }
  };

  // Handle pre-buffer audio events
  const handlePreBufferCanPlay = () => {
    if (preBufferRef.current && preBufferedSong) {
      console.log('✅ Pre-buffer ready for:', preBufferedSong.name);
      setIsPreBuffering(false);
      // Mark this song as pre-buffered
      preBufferedSongsRef.current.add(preBufferedSong.id);
      onPreBufferReady?.(preBufferedSong);
    }
  };

  const handlePreBufferError = (e) => {
    console.error('❌ Pre-buffer audio error:', e);
    setPreBufferError('Pre-buffer failed to load');
    setIsPreBuffering(false);
    onPreBufferError?.('Pre-buffer failed to load');
  };

  // Start pre-buffering when conditions are met
  useEffect(() => {
    if (shouldPreBuffer()) {
      const nextSong = getNextSong();
      setPreBufferedSong(nextSong);
      preBufferNextSong();
    } else {
      // Clear pre-buffer if conditions aren't met
      if (preBufferRef.current) {
        preBufferRef.current.src = '';
        preBufferRef.current.load();
      }
      setPreBufferedSong(null);
      setIsPreBuffering(false);
      setPreBufferError(null);
    }
  }, [currentSong?.id, queue, isHost]);

  // Clear pre-buffered songs when queue changes significantly
  useEffect(() => {
    // Clear pre-buffered songs when queue length changes (songs added/removed)
    // This ensures we don't keep pre-buffered songs that are no longer in queue
    preBufferedSongsRef.current.clear();
    console.log('🔄 Queue changed - cleared pre-buffered songs cache');
  }, [queue.length]); // Only depend on queue length, not the entire queue object

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preBufferRef.current) {
        preBufferRef.current.src = '';
        preBufferRef.current.load();
      }
    };
  }, []);

  return (
    <audio
      ref={preBufferRef}
      onCanPlay={handlePreBufferCanPlay}
      onError={handlePreBufferError}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
};

export default AudioPreBuffer; 