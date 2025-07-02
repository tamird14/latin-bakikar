const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleDriveService {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.musicFileExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.wma', '.aac'];
    this.isAuthenticated = false;
    this.sharedFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';
  }

  async authenticateWithCredentials(credentials) {
    try {
      const { client_id, client_secret, redirect_uri } = credentials.web || credentials.installed;
      
      this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
      this.drive = google.drive({ version: 'v3', auth: this.auth });
      
      return true;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  // New method for service account authentication
  async authenticateWithServiceAccount() {
    try {
      const serviceAccountPath = path.join(__dirname, 'service-account.json');
      
      if (!fs.existsSync(serviceAccountPath)) {
        console.log('⚠️  Service account file not found');
        return false;
      }

      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      
      // Use the same authentication method that works in debug
      this.auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: ['https://www.googleapis.com/auth/drive.readonly']
      });

      // Get an authenticated client
      const authClient = await this.auth.getClient();
      this.drive = google.drive({ version: 'v3', auth: authClient });
      this.isAuthenticated = true;
      
      console.log('✅ Google Drive authenticated with service account');
      console.log(`📧 Service account: ${serviceAccount.client_email}`);
      return true;
      
    } catch (error) {
      console.error('Service account authentication error:', error);
      return false;
    }
  }

  // Enhanced server-side authentication that tries both methods
  async authenticateServerSide() {
    try {
      // First try service account (preferred for shared folders)
      if (fs.existsSync(path.join(__dirname, 'service-account.json'))) {
        const success = await this.authenticateWithServiceAccount();
        if (success) return true;
      }

      // Fallback to OAuth with refresh token
      if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        this.auth = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
        );

        this.auth.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });

        this.drive = google.drive({ version: 'v3', auth: this.auth });
        this.isAuthenticated = true;
        
        console.log('✅ Google Drive authenticated with stored token');
        return true;
      } else {
        console.log('⚠️  No OAuth credentials found. Service account required.');
        return false;
      }
    } catch (error) {
      console.error('Server-side authentication error:', error);
      return false;
    }
  }

  // Initialize for shared folder access
  async initializeForSharedFolder() {
    const success = await this.authenticateServerSide();
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

  async authenticate(credentials) {
    return this.authenticateWithCredentials(credentials);
  }

  async setAccessToken(token) {
    if (!this.auth) {
      throw new Error('Authentication not initialized');
    }
    
    this.auth.setCredentials(token);
    this.isAuthenticated = true;
  }

  getAuthUrl() {
    if (!this.auth) {
      throw new Error('Authentication not initialized');
    }

    const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
    });
  }

  async getAccessToken(code) {
    if (!this.auth) {
      throw new Error('Authentication not initialized');
    }

    const { tokens } = await this.auth.getToken(code);
    return tokens;
  }

  isMusicFile(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    return this.musicFileExtensions.includes(ext);
  }

  async listFiles(folderId = null, pageToken = null) {
    try {
      // Use shared folder if no specific folder requested
      const targetFolderId = folderId || this.sharedFolderId;
      
      const response = await this.drive.files.list({
        q: `'${targetFolderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
        pageSize: 100,
        pageToken: pageToken,
        orderBy: 'name'
      });

      // Handle case where response might be null or malformed
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
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async searchMusicFiles(query, folderId = null) {
    try {
      const targetFolderId = folderId || this.sharedFolderId;
      let searchQuery = `name contains '${query}' and trashed=false`;
      
      if (targetFolderId && targetFolderId !== 'root') {
        searchQuery += ` and '${targetFolderId}' in parents`;
      }

      const response = await this.drive.files.list({
        q: searchQuery,
        fields: 'files(id, name, mimeType, size, parents)',
        pageSize: 50,
      });

      const files = response.data.files || [];
      const musicFiles = files.filter(file => this.isMusicFile(file.name));

      return musicFiles.map(file => ({
        id: file.id,
        name: file.name,
        type: 'file',
        size: file.size,
        mimeType: file.mimeType,
        extension: path.extname(file.name),
        parents: file.parents
      }));
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  async getFileStreamUrl(fileId) {
    try {
      // Get file metadata first
      const fileResponse = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size'
      });

      // Return our proxy streaming URL instead of direct Google Drive URL
      const streamUrl = `http://localhost:5001/api/drive/audio/${fileId}`;
      
      return {
        url: streamUrl,
        metadata: fileResponse.data
      };
    } catch (error) {
      console.error('Error getting file stream URL:', error);
      throw error;
    }
  }

  async getFolderPath(folderId) {
    try {
      if (folderId === 'root' || folderId === this.sharedFolderId) {
        return [{ id: this.sharedFolderId, name: 'Shared Music' }];
      }

      const path = [];
      let currentId = folderId;

      while (currentId && currentId !== 'root' && currentId !== this.sharedFolderId) {
        const response = await this.drive.files.get({
          fileId: currentId,
          fields: 'id, name, parents'
        });

        const folder = response.data;
        path.unshift({ id: folder.id, name: folder.name });

        currentId = folder.parents ? folder.parents[0] : null;
      }

      // Add shared music folder at the beginning
      path.unshift({ id: this.sharedFolderId, name: 'Shared Music' });
      
      return path;
    } catch (error) {
      console.error('Error getting folder path:', error);
      return [{ id: this.sharedFolderId, name: 'Shared Music' }];
    }
  }

  // Get shareable link for the music folder
  async getSharedFolderLink() {
    try {
      if (this.sharedFolderId === 'root') {
        return null;
      }

      const response = await this.drive.files.get({
        fileId: this.sharedFolderId,
        fields: 'webViewLink, name'
      });

      return {
        folderId: this.sharedFolderId,
        name: response.data.name,
        link: response.data.webViewLink
      };
    } catch (error) {
      console.error('Error getting shared folder link:', error);
      return null;
    }
  }
}

module.exports = GoogleDriveService;
