import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Session management
export const createSession = async (name) => {
  const response = await api.post('/sessions', { name });
  return response.data;
};

export const getSession = async (sessionId, clientId = null) => {
  try {
    const params = clientId ? { clientId } : {};
    const response = await api.get(`/sessions/${sessionId}`, { params });
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    throw error;
  }
};

// Google Drive integration
export const initiateGoogleAuth = async (credentials) => {
  const response = await api.post('/drive/auth/init', { credentials });
  return response.data;
};

export const handleAuthCallback = async (code) => {
  const response = await api.post('/drive/auth/callback', { code });
  return response.data;
};

export const setGoogleToken = async (token) => {
  const response = await api.post('/drive/auth/token', { token });
  return response.data;
};

export const getDriveFiles = async (folderId = 'root', pageToken = null) => {
  const params = pageToken ? { pageToken } : {};
  const response = await api.get(`/drive/files/${folderId}`, { params });
  return response.data;
};

export const searchMusicFiles = async (query, folderId = null) => {
  const params = { q: query };
  if (folderId) params.folderId = folderId;
  
  const response = await api.get('/drive/search', { params });
  return response.data;
};

export const getStreamUrl = async (fileId) => {
  try {
    console.log('🎵 Requesting stream URL for file:', fileId);
    const response = await api.get(`/drive/stream/${fileId}`);
    console.log('🎵 Stream URL response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get stream URL:', error);
    if (error.response?.status === 404) {
      throw new Error(`File not found: ${fileId}`);
    } else if (error.response?.status === 500) {
      throw new Error(`Server error: ${error.response.data?.error || 'Unknown server error'}`);
    } else if (error.code === 'NETWORK_ERROR') {
      throw new Error('Network error - please check your connection');
    } else {
      throw new Error(`Failed to get stream URL: ${error.message}`);
    }
  }
};

export const getFolderPath = async (folderId) => {
  const response = await api.get(`/drive/path/${folderId}`);
  return response.data;
};

export default api;
