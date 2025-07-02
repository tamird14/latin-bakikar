const express = require('express');
const GoogleDriveService = require('./googleDrive');

// Factory function that creates routes with an authenticated driveService
function createDriveRoutes(driveService) {
  const router = express.Router();

// Initialize Google Drive authentication
router.post('/auth/init', async (req, res) => {
  try {
    const { credentials } = req.body;
    const success = await driveService.authenticate(credentials);
    
    if (success) {
      const authUrl = driveService.getAuthUrl();
      res.json({ authUrl });
    } else {
      res.status(400).json({ error: 'Failed to initialize authentication' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Handle OAuth callback
router.post('/auth/callback', async (req, res) => {
  try {
    const { code } = req.body;
    const tokens = await driveService.getAccessToken(code);
    await driveService.setAccessToken(tokens);
    
    res.json({ success: true, message: 'Authentication successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set access token directly (for testing or pre-authenticated users)
router.post('/auth/token', async (req, res) => {
  try {
    const { token } = req.body;
    await driveService.setAccessToken(token);
    res.json({ success: true, message: 'Token set successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List files in a folder
router.get('/files/:folderId?', async (req, res) => {
  try {
    const folderId = req.params.folderId || 'root';
    const { pageToken } = req.query;
    
    const result = await driveService.listFiles(folderId === 'root' ? null : folderId, pageToken);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search for music files
router.get('/search', async (req, res) => {
  try {
    const { q: query, folderId } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const results = await driveService.searchMusicFiles(query, folderId);
    res.json({ files: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get streaming URL for a file
router.get('/stream/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const result = await driveService.getFileStreamUrl(fileId);
    console.log(`🎵 Stream URL requested for file ${fileId}: ${result.url}`);
    res.json(result);
  } catch (error) {
    console.error(`❌ Failed to get stream URL for ${fileId}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Stream audio file directly (proxy endpoint)
router.get('/audio/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Set CORS headers for audio streaming
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    
    // Get file metadata
    const fileResponse = await driveService.drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size'
    });
    
    const file = fileResponse.data;
    console.log(`Streaming audio: ${file.name} (${file.mimeType}, ${file.size} bytes)`);
    
    // Set proper headers for audio streaming
    res.setHeader('Content-Type', file.mimeType || 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Properly encode filename for Content-Disposition header
    const encodedFilename = Buffer.from(file.name, 'utf8').toString('ascii', 0, Math.min(file.name.length, 100)).replace(/[^\x20-\x7E]/g, '?');
    res.setHeader('Content-Disposition', `inline; filename="${encodedFilename}"`);
    
    // Handle range requests for audio seeking
    const range = req.headers.range;
    if (range && file.size) {
      const fileSize = parseInt(file.size);
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);
      
      // Get file content with range
      const stream = await driveService.drive.files.get({
        fileId: fileId,
        alt: 'media',
        headers: {
          'Range': `bytes=${start}-${end}`
        }
      }, { responseType: 'stream' });
      
      stream.data.pipe(res);
    } else {
      // Full file download
      if (file.size) {
        res.setHeader('Content-Length', file.size);
      }
      
      const stream = await driveService.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });
      
      stream.data.pipe(res);
    }
  } catch (error) {
    console.error('Audio streaming error:', error);
    res.status(500).json({ error: 'Failed to stream audio file' });
  }
});

// Get folder breadcrumb path
router.get('/path/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const path = await driveService.getFolderPath(folderId);
    res.json({ path });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

  return router;
}

module.exports = createDriveRoutes;
