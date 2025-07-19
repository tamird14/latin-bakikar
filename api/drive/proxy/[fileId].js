// Google Drive streaming proxy endpoint
const GoogleDriveService = require('../../googleDriveService');

module.exports = async function handler(req, res) {
  console.log('🎵 Drive Proxy API called:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      // Extract fileId from URL path
      const urlParts = req.url.split('/');
      const fileId = urlParts[urlParts.length - 1];
      
      console.log('🎵 Proxying stream for file:', fileId);
      
      if (!fileId || fileId.trim() === '') {
        return res.status(400).json({ error: 'File ID is required' });
      }
      
      // Initialize Google Drive service
      const driveService = new GoogleDriveService();
      if (!driveService.isAuthenticated) {
        await driveService.initializeForSharedFolder();
      }
      
      // Get file metadata
      const fileResponse = await driveService.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size'
      });
      
      const file = fileResponse.data;
      console.log('🎵 File metadata:', file);
      
      // Handle range requests for audio scrubbing
      const range = req.headers.range;
      console.log('🎵 Range request:', range);
      
      let streamOptions = {
        responseType: 'stream'
      };
      
      // Set proper headers for audio streaming
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Detect and set proper MIME type based on file extension
      let contentType = file.mimeType || 'audio/mpeg';
      const fileName = file.name || '';
      const fileExtension = fileName.toLowerCase().split('.').pop();
      
      // Map file extensions to proper MIME types
      const mimeTypeMap = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'wma': 'audio/x-ms-wma'
      };
      
      if (mimeTypeMap[fileExtension]) {
        contentType = mimeTypeMap[fileExtension];
        console.log(`🎵 Mapped ${fileExtension} to ${contentType}`);
      } else {
        console.log(`🎵 Using original MIME type: ${contentType}`);
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      
      if (range && file.size) {
        // Parse range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : parseInt(file.size) - 1;
        const chunksize = (end - start) + 1;
        
        console.log(`🎵 Range request: ${start}-${end}/${file.size} (${chunksize} bytes)`);
        
        // Pass range to Google Drive
        streamOptions.headers = {
          'Range': `bytes=${start}-${end}`
        };
        
        res.setHeader('Content-Range', `bytes ${start}-${end}/${file.size}`);
        res.setHeader('Content-Length', chunksize);
        res.status(206); // Partial Content
      } else {
        // No range request, return full file
        if (file.size) {
          res.setHeader('Content-Length', file.size);
        }
      }
      
      // Get the file content stream from Google Drive with range support
      const streamResponse = await driveService.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, streamOptions);
      
      console.log('🎵 Streaming file:', file.name);
      
      // Pipe the Google Drive stream to the response
      streamResponse.data.pipe(res);
      
      streamResponse.data.on('error', (error) => {
        console.error('❌ Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Streaming failed' });
        }
      });
      
    } catch (error) {
      console.error('❌ Error proxying stream:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to proxy stream', details: error.message });
      }
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 