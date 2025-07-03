// Google Drive files API endpoint
module.exports = function handler(req, res) {
  console.log('🔥 Drive Files API called:', req.method, req.url);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      // Extract folder ID from URL path if present
      const urlParts = req.url.split('/');
      let folderId = 'root';
      
      // Check if folder ID is in URL path
      if (urlParts.length > 3 && urlParts[3] && urlParts[3] !== '') {
        folderId = urlParts[3];
      }
      
      console.log('📁 Getting files for folder:', folderId);
      
      // Mock file listing that mimics Google Drive structure
      let mockData;
      
      if (folderId === 'root') {
        mockData = {
          folders: [
            { id: 'music', name: 'Music', type: 'folder', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'albums', name: 'Albums', type: 'folder', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'playlists', name: 'Playlists', type: 'folder', mimeType: 'application/vnd.google-apps.folder' }
          ],
          files: [
            {
              id: 'root-song-1',
              name: 'Welcome Song.mp3',
              type: 'file',
              size: '5242880',
              mimeType: 'audio/mpeg',
              extension: '.mp3',
              modifiedTime: '2023-01-01T00:00:00.000Z'
            }
          ]
        };
      } else if (folderId === 'music') {
        mockData = {
          folders: [
            { id: 'rock', name: 'Rock', type: 'folder', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'pop', name: 'Pop', type: 'folder', mimeType: 'application/vnd.google-apps.folder' },
            { id: 'jazz', name: 'Jazz', type: 'folder', mimeType: 'application/vnd.google-apps.folder' }
          ],
          files: [
            {
              id: 'music-song-1',
              name: 'Great Song.mp3',
              type: 'file',
              size: '7340032',
              mimeType: 'audio/mpeg',
              extension: '.mp3',
              modifiedTime: '2023-02-15T00:00:00.000Z'
            },
            {
              id: 'music-song-2',
              name: 'Another Hit.mp3',
              type: 'file',
              size: '6291456',
              mimeType: 'audio/mpeg',
              extension: '.mp3',
              modifiedTime: '2023-03-20T00:00:00.000Z'
            }
          ]
        };
      } else {
        // Default for other folders
        mockData = {
          folders: [],
          files: [
            {
              id: `${folderId}-song-1`,
              name: `Song from ${folderId}.mp3`,
              type: 'file',
              size: '4194304',
              mimeType: 'audio/mpeg',
              extension: '.mp3',
              modifiedTime: '2023-01-15T00:00:00.000Z'
            }
          ]
        };
      }

      // Combine folders and files into a single array like the original API
      const allFiles = [...mockData.folders, ...mockData.files];

      console.log('✅ Returning files:', { folders: mockData.folders.length, files: mockData.files.length });
      res.json({
        files: allFiles,
        nextPageToken: null
      });
    } catch (error) {
      console.error('❌ Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files', details: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 