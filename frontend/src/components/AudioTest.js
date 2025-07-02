import React, { useState, useRef } from 'react';
import { getStreamUrl } from '../services/api';

const AudioTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  const addResult = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, { timestamp, message, type }]);
  };

  const testAudioStream = async () => {
    setIsLoading(true);
    setTestResults([]);
    addResult('🧪 Starting audio stream test...');

    try {
      // Test 1: Get files from backend
      addResult('📁 Fetching files from backend...');
      const response = await fetch('/api/drive/files');
      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        addResult(`✅ Found ${data.files.length} files`, 'success');
        
        // Test with first audio file
        const firstFile = data.files[0];
        addResult(`🎵 Testing with: ${firstFile.name}`);
        
        // Test 2: Get stream URL
        addResult('🔗 Getting stream URL...');
        const streamData = await getStreamUrl(firstFile.id);
        addResult(`✅ Stream URL: ${streamData.url}`, 'success');
        
        // Test 3: Load audio
        addResult('📻 Loading audio element...');
        if (audioRef.current) {
          audioRef.current.src = streamData.url;
          audioRef.current.load();
          
          // Test 4: Try to play
          setTimeout(() => {
            if (audioRef.current) {
              addResult('▶️ Attempting to play...');
              audioRef.current.play()
                .then(() => {
                  addResult('🎉 SUCCESS: Audio playing!', 'success');
                })
                .catch(err => {
                  addResult(`❌ FAILED: ${err.message}`, 'error');
                });
            }
          }, 1000);
        }
      } else {
        addResult('❌ No files found', 'error');
      }
    } catch (err) {
      addResult(`❌ Error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      addResult('⏹️ Audio stopped');
    }
  };

  return (
    <div className="p-6 bg-gray-800 text-white rounded-lg">
      <h2 className="text-xl font-bold mb-4">🧪 Audio Streaming Test</h2>
      
      <div className="flex gap-3 mb-4">
        <button
          onClick={testAudioStream}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded"
        >
          {isLoading ? 'Testing...' : 'Run Audio Test'}
        </button>
        
        <button
          onClick={stopAudio}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
        >
          Stop Audio
        </button>
        
        <button
          onClick={() => setTestResults([])}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
        >
          Clear Results
        </button>
      </div>

      <div className="bg-gray-900 p-4 rounded max-h-64 overflow-y-auto">
        {testResults.length === 0 ? (
          <p className="text-gray-400">Click "Run Audio Test" to start debugging...</p>
        ) : (
          testResults.map((result, index) => (
            <div
              key={index}
              className={`mb-2 font-mono text-sm ${
                result.type === 'success' ? 'text-green-400' :
                result.type === 'error' ? 'text-red-400' :
                'text-gray-300'
              }`}
            >
              <span className="text-gray-500">[{result.timestamp}]</span> {result.message}
            </div>
          ))
        )}
      </div>

      <audio
        ref={audioRef}
        onLoadedMetadata={() => addResult('📊 Audio metadata loaded')}
        onCanPlay={() => addResult('✅ Audio can play')}
        onError={(e) => addResult(`❌ Audio error: ${e.target.error?.message || 'Unknown error'}`, 'error')}
        onPlaying={() => addResult('▶️ Audio is playing', 'success')}
        onPause={() => addResult('⏸️ Audio paused')}
        onEnded={() => addResult('🏁 Audio ended')}
      />
    </div>
  );
};

export default AudioTest; 