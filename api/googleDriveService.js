const { google } = require('googleapis');
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.musicFileExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.wma', '.aac'];
    this.isAuthenticated = false;
    this.sharedFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
    
    console.log('🔧 GoogleDriveService constructor');
    console.log('🔧 GOOGLE_DRIVE_FOLDER_ID:', this.sharedFolderId);
    console.log('🔧 Environment variables available:', Object.keys(process.env).filter(key => key.startsWith('GOOGLE')));
  }

  async authenticate() {
    try {
      console.log('🔑 Starting authentication...');
      
      // Get service account from environment variable
      const serviceAccountString = process.env.GOOGLE_SERVICE_ACCOUNT;
      console.log('🔑 Service account env var exists:', !!serviceAccountString);
      console.log('🔑 Service account length:', serviceAccountString?.length);
      
      if (!serviceAccountString) {
        console.log('❌ GOOGLE_SERVICE_ACCOUNT environment variable not set');
        throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable not set');
      }

      console.log('🔑 Parsing service account JSON...');
      const serviceAccount = JSON.parse(serviceAccountString);
      console.log('🔑 Service account parsed successfully, project_id:', serviceAccount.project_id);
      
      // Create auth client from service account
      this.auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });

      // Get an authenticated client
      const authClient = await this.auth.getClient();
      this.drive = google.drive({ version: 'v3', auth: authClient });
      this.isAuthenticated = true;
      
      console.log('✅ Google Drive authenticated with service account');
      return true;
      
    } catch (error) {
      console.error('❌ Google Drive authentication error:', error);
      return false;
    }
  }

  async initializeForSharedFolder() {
    const success = await this.authenticate();
    if (success && this.sharedFolderId !== 'root') {
      try {
        // Test access to the shared folder
        await this.drive.files.get({
          fileId: this.sharedFolderId,
          fields: 'id, name, mimeType'
        });
        console.log(`✅ Connected to shared music folder: ${this.sharedFolderId}`);
        return true;
      } catch (error) {
        console.error('❌ Cannot access shared folder:', error.message);
        return false;
      }
    }
    return success;
  }

  isMusicFile(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return this.musicFileExtensions.includes(ext);
  }

  async listFiles(folderId = null, pageToken = null) {
    try {
      if (!this.isAuthenticated) {
        await this.initializeForSharedFolder();
      }

      // Use shared folder if no specific folder requested
      const targetFolderId = folderId || this.sharedFolderId;
      
      const response = await this.drive.files.list({
        q: `'${targetFolderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        pageSize: 100,
        pageToken: pageToken,
        orderBy: 'name'
      });

      if (!response || !response.data) {
        console.error('Invalid response from Google Drive API:', response);
        return { folders: [], files: [], nextPageToken: null };
      }

      const allFiles = response.data.files || [];
      
      // Separate folders and music files
      const folders = allFiles.filter(file => 
        file.mimeType === 'application/vnd.google-apps.folder'
      );
      
      const musicFiles = allFiles.filter(file => 
        file.mimeType !== 'application/vnd.google-apps.folder' && 
        this.isMusicFile(file.name)
      );

      return {
        folders: folders.map(folder => ({
          id: folder.id,
          name: folder.name,
          type: 'folder',
          mimeType: folder.mimeType
        })),
        files: musicFiles.map(file => ({
          id: file.id,
          name: file.name,
          type: 'file',
          size: file.size,
          mimeType: file.mimeType,
          extension: path.extname(file.name),
          modifiedTime: file.modifiedTime
        })),
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw error;
    }
  }

  async searchMusicFiles(query, folderId = null) {
    try {
      console.log('🔍 searchMusicFiles called with query:', query, 'folderId:', folderId);
      
      if (!this.isAuthenticated) {
        console.log('🔍 Not authenticated, initializing...');
        const authResult = await this.initializeForSharedFolder();
        console.log('🔍 Auth result:', authResult);
        if (!authResult) {
          throw new Error('Failed to authenticate with Google Drive');
        }
      }

      const targetFolderId = folderId || this.sharedFolderId;
      console.log('🔍 Using target folder:', targetFolderId);
      
      // Use simplified approach - just get all files and filter client-side
      // This is more reliable than Google Drive's search which can be finicky
      console.log('🔍 Getting all files and filtering client-side...');
      
      const allFilesResponse = await this.drive.files.list({
        q: `'${targetFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        pageSize: 100,
        orderBy: 'name'
      });
      
      console.log('🔍 Total files retrieved:', allFilesResponse.data.files?.length || 0);
      
      const allFiles = allFilesResponse.data.files || [];
      const allMusicFiles = allFiles.filter(file => 
        file.mimeType !== 'application/vnd.google-apps.folder' && 
        this.isMusicFile(file.name)
      );
      
      console.log('🔍 Total music files:', allMusicFiles.length);
      
      // Client-side filtering with case-insensitive partial match
      const queryLower = query.toLowerCase();
      const musicFiles = allMusicFiles.filter(file => 
        file.name.toLowerCase().includes(queryLower)
      );
      
      console.log('🔍 Music files matching query:', musicFiles.length);
      
      if (musicFiles.length > 0) {
        console.log('🔍 Sample matches:', musicFiles.slice(0, 3).map(f => f.name));
      }

      return musicFiles.map(file => ({
        id: file.id,
        name: file.name,
        type: 'file',
        size: file.size,
        mimeType: file.mimeType,
        extension: path.extname(file.name),
        modifiedTime: file.modifiedTime
      }));
    } catch (error) {
      console.error('❌ Error searching files:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  async getFileStreamUrl(fileId) {
    try {
      console.log('🎵 GoogleDriveService.getFileStreamUrl called with fileId:', fileId);
      console.log('🎵 Current authentication status:', this.isAuthenticated);
      
      if (!this.isAuthenticated) {
        console.log('🎵 Not authenticated, initializing...');
        const authSuccess = await this.initializeForSharedFolder();
        console.log('🎵 Authentication result:', authSuccess);
        if (!authSuccess) {
          throw new Error('Failed to authenticate with Google Drive');
        }
      }

      console.log('🎵 Getting file metadata for fileId:', fileId);
      
      // Get file metadata
      const fileResponse = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size'
      });
      
      console.log('🎵 File metadata retrieved:', fileResponse.data);

      // For audio files, we need to use the webContentLink or generate a direct download URL
      // Since we can't stream directly due to CORS, we return the file ID for client-side handling
      return {
        fileId: fileId,
        name: fileResponse.data.name,
        mimeType: fileResponse.data.mimeType,
        size: fileResponse.data.size,
        // In a real implementation, you'd handle streaming differently
        // For now, we return the file ID so client can request it
        streamUrl: `/api/drive/stream/${fileId}`
      };
    } catch (error) {
      console.error('❌ Error getting file stream URL:', error);
      throw error;
    }
  }

  async getFolderPath(folderId) {
    try {
      if (!this.isAuthenticated) {
        await this.initializeForSharedFolder();
      }

      const path = [];
      let currentFolderId = folderId;

      while (currentFolderId && currentFolderId !== 'root' && currentFolderId !== this.sharedFolderId) {
        const folderResponse = await this.drive.files.get({
          fileId: currentFolderId,
          fields: 'id, name, parents'
        });

        const folder = folderResponse.data;
        path.unshift({
          id: folder.id,
          name: folder.name
        });

        // Get parent folder ID
        currentFolderId = folder.parents ? folder.parents[0] : null;
      }

      // Add the shared folder as root if we're not already there
      if (folderId !== this.sharedFolderId) {
        path.unshift({
          id: this.sharedFolderId,
          name: 'My Drive'
        });
      }

      return path;
    } catch (error) {
      console.error('❌ Error getting folder path:', error);
      throw error;
    }
  }
}

module.exports = GoogleDriveService; 