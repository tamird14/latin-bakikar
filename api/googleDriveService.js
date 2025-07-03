const { google } = require('googleapis');
const path = require('path');

class GoogleDriveService {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.musicFileExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.wma', '.aac'];
    this.isAuthenticated = false;
    this.sharedFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
  }

  async authenticate() {
    try {
      // Get service account from environment variable
      const serviceAccountString = process.env.GOOGLE_SERVICE_ACCOUNT;
      if (!serviceAccountString) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable not set');
      }

      const serviceAccount = JSON.parse(serviceAccountString);
      
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
      if (!this.isAuthenticated) {
        await this.initializeForSharedFolder();
      }

      const targetFolderId = folderId || this.sharedFolderId;
      const searchQuery = `'${targetFolderId}' in parents and trashed=false and name contains '${query}'`;

      const response = await this.drive.files.list({
        q: searchQuery,
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        pageSize: 50,
        orderBy: 'name'
      });

      const allFiles = response.data.files || [];
      const musicFiles = allFiles.filter(file => 
        file.mimeType !== 'application/vnd.google-apps.folder' && 
        this.isMusicFile(file.name)
      );

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
      throw error;
    }
  }

  async getFileStreamUrl(fileId) {
    try {
      if (!this.isAuthenticated) {
        await this.initializeForSharedFolder();
      }

      // Get file metadata
      const fileResponse = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size'
      });

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