import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  
  // Track which songs have been pre-buffered to avoid duplicate pre-buffering
  const preBufferedSongsRef = useRef(new Set());
  
  // Get the next song in queue (first song in queue)
  const getNextSong = useCallback(() => {
    if (!queue || queue.length === 0) return null;
    return queue[0];
  }, [queue]);

  // Check if we should pre-buffer
  const shouldPreBuffer = useCallback(() => {
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
  }, [isHost, currentSong, preBufferedSong, getNextSong]);

  // Pre-buffer the next song
  const preBufferNextSong = useCallback(async () => {
    const nextSong = getNextSong();
    if (!nextSong || !preBufferRef.current) return;

    console.log('🎵 Pre-buffering next song:', nextSong.name);

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
      onPreBufferError?.(`Failed to pre-buffer ${nextSong.name}: ${error.message}`);
    }
  }, [getNextSong, onPreBufferError]);

  // Handle pre-buffer audio events
  const handlePreBufferCanPlay = () => {
    if (preBufferRef.current && preBufferedSong) {
      console.log('✅ Pre-buffer ready for:', preBufferedSong.name);
      // Mark this song as pre-buffered
      preBufferedSongsRef.current.add(preBufferedSong.id);
      onPreBufferReady?.(preBufferedSong);
    }
  };

  const handlePreBufferError = (e) => {
    console.error('❌ Pre-buffer audio error:', e);
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
      const audioElement = preBufferRef.current;
      if (audioElement) {
        audioElement.src = '';
        audioElement.load();
      }
      setPreBufferedSong(null);
    }
  }, [currentSong?.id, queue, isHost, getNextSong, preBufferNextSong, shouldPreBuffer]);

  // Track the first song in queue to detect when it changes
  const firstSongRef = useRef(null);
  
  // Clear pre-buffered songs when the first song in queue changes
  useEffect(() => {
    const firstSong = getNextSong();
    const firstSongId = firstSong?.id;
    
    // If the first song has changed, clear the cache
    if (firstSongId !== firstSongRef.current) {
      if (firstSongRef.current) {
        console.log('🔄 First song in queue changed - cleared pre-buffered songs cache');
        preBufferedSongsRef.current.clear();
      }
      firstSongRef.current = firstSongId;
    }
  }, [queue, getNextSong]); // Depend on the entire queue to detect first song changes

  // Cleanup on unmount
  useEffect(() => {
    const audioElement = preBufferRef.current;
    return () => {
      if (audioElement) {
        audioElement.src = '';
        audioElement.load();
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