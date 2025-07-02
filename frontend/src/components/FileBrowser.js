import React, { useState, useEffect, useCallback } from 'react';
import { getDriveFiles, searchMusicFiles, getFolderPath } from '../services/api';

const FileBrowser = ({ onAddToQueue }) => {
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('root');
  const [folderPath, setFolderPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [pageToken, setPageToken] = useState(null);
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');

  const loadFolderPath = useCallback(async () => {
    try {
      const pathResponse = await getFolderPath(currentFolder);
      setFolderPath(pathResponse.path);
    } catch (err) {
      console.error('Failed to load folder path:', err);
    }
  }, [currentFolder]);

  const loadFiles = useCallback(async (loadMore = false) => {
    setLoading(true);
    setError('');

    try {
      const token = loadMore ? pageToken : null;
      const response = await getDriveFiles(currentFolder, token);
      
      if (loadMore) {
        setFiles(prev => [...prev, ...response.files]);
      } else {
        setFiles(response.files);
      }
      
      setPageToken(response.nextPageToken);
      setHasMoreFiles(!!response.nextPageToken);
    } catch (err) {
      setError('Failed to load files from shared music folder.');
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFolder, pageToken]);

  useEffect(() => {
    // Check connection and load files automatically
    checkConnection();
  }, []);

  useEffect(() => {
    if (isConnected) {
      loadFiles();
    }
  }, [loadFiles, isConnected]);

  const checkConnection = async () => {
    try {
      // Test if the shared folder is accessible by trying to load files
      await getDriveFiles();
      setIsConnected(true);
      setConnectionError('');
    } catch (err) {
      setIsConnected(false);
      setConnectionError('Shared music folder not accessible. Please check server configuration.');
      console.error('Connection check failed:', err);
    }
  };

  useEffect(() => {
    if (currentFolder !== 'root') {
      loadFolderPath();
    } else {
      setFolderPath([{ id: 'root', name: 'My Drive' }]);
    }
  }, [currentFolder, loadFolderPath]);



  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      loadFiles();
      return;
    }

    setLoading(true);
    setIsSearching(true);
    setError('');

    try {
      const response = await searchMusicFiles(searchQuery, currentFolder);
      setFiles(response.files);
      setHasMoreFiles(false);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (folderId) => {
    setCurrentFolder(folderId);
    setSearchQuery('');
    setIsSearching(false);
    setPageToken(null);
  };

  const handleBreadcrumbClick = (folderId) => {
    handleFolderClick(folderId);
  };

  const handleAddToQueue = (file) => {
    const song = {
      id: file.id,
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
      artists: ['Unknown Artist'], // Could be parsed from filename or metadata
      duration: null, // Would need to be fetched from metadata
      fileId: file.id
    };
    
    onAddToQueue(song);
  };

  const isAudioFile = (file) => {
    const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    return audioExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      return '📁';
    } else if (isAudioFile(file)) {
      return '🎵';
    } else {
      return '📄';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Connection Status */}
      {!isConnected && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4 text-white">Shared Music Folder</h3>
          
          <div className="space-y-4">
            {connectionError ? (
              <div className="bg-red-900 border border-red-600 rounded p-3">
                <p className="text-red-300 text-sm">{connectionError}</p>
                <button
                  onClick={checkConnection}
                  className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                >
                  Retry Connection
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                <span className="text-gray-300">Connecting to shared music folder...</span>
              </div>
            )}
            
            <div className="text-sm text-gray-400">
              <p>🎵 Music files are loaded from a shared Google Drive folder</p>
              <p>📁 No individual login required - everyone shares the same music library</p>
              <p>🔧 If you see connection issues, the server needs to be configured</p>
            </div>
          </div>
        </div>
      )}

      {isConnected && (
        <div className="bg-green-900 border border-green-600 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
            <div>
              <h3 className="text-green-300 font-medium">Connected to Shared Music Folder</h3>
              <p className="text-green-400 text-sm">Browse and add music to the queue</p>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Search for songs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? '...' : '🔍'}
          </button>
        </div>
        
        {isSearching && (
          <button
            onClick={() => {
              setSearchQuery('');
              setIsSearching(false);
              loadFiles();
            }}
            className="mt-2 text-sm text-purple-400 hover:text-purple-300"
          >
            ← Back to folder view
          </button>
        )}
      </div>

      {/* Breadcrumb Navigation */}
      {!isSearching && folderPath.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center space-x-2 text-sm">
            {folderPath.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <button
                  onClick={() => handleBreadcrumbClick(folder.id)}
                  className={`hover:text-purple-400 ${
                    index === folderPath.length - 1 
                      ? 'text-white font-medium' 
                      : 'text-gray-400'
                  }`}
                >
                  {folder.name}
                </button>
                {index < folderPath.length - 1 && (
                  <span className="text-gray-500">{'>'}</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-500 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && files.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
            <p className="text-gray-400">Loading files...</p>
          </div>
        </div>
      )}

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-2xl">{getFileIcon(file)}</span>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{file.name}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      {file.size && (
                        <span>{formatFileSize(parseInt(file.size))}</span>
                      )}
                      {file.modifiedTime && (
                        <span>
                          {new Date(file.modifiedTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {file.mimeType === 'application/vnd.google-apps.folder' ? (
                    <button
                      onClick={() => handleFolderClick(file.id)}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                    >
                      Open
                    </button>
                  ) : isAudioFile(file) ? (
                    <button
                      onClick={() => handleAddToQueue(file)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition-colors"
                    >
                      Add to Queue
                    </button>
                  ) : (
                    <span className="text-gray-500 text-sm">Not playable</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMoreFiles && !loading && (
        <div className="mt-6 text-center">
          <button
            onClick={() => loadFiles(true)}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Load More Files
          </button>
        </div>
      )}

      {/* Empty State */}
      {files.length === 0 && !loading && (
        <div className="text-center h-64 flex items-center justify-center">
          <div>
            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📁</span>
            </div>
            <p className="text-lg text-gray-400 mb-2">
              {isSearching ? 'No files found' : 'No files in this folder'}
            </p>
            <p className="text-sm text-gray-500">
              {isSearching 
                ? 'Try a different search term'
                : 'Connect your Google Drive to browse music files'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileBrowser; 