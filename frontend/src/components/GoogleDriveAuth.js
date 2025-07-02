import React, { useState, useEffect } from 'react';
import { initiateGoogleAuth, handleAuthCallback } from '../services/api';

const GoogleDriveAuth = ({ onAuthSuccess }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    // Check if we're handling a callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    const handleAuthCodeCallback = async (code) => {
      setIsLoading(true);
      setError('');
      
      try {
        await handleAuthCallback(code);
        setIsAuthenticated(true);
        onAuthSuccess?.();
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        setError('Authentication failed: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (code) {
      handleAuthCodeCallback(code);
    }
  }, [onAuthSuccess]);



  const initiateAuth = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // For demo purposes, we'll use basic client credentials
      // In production, you'd get these from your backend
      const credentials = {
        web: {
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          client_secret: process.env.REACT_APP_GOOGLE_CLIENT_SECRET,
          redirect_uri: 'http://localhost:3000/auth/callback'
        }
      };
      
             const result = await initiateGoogleAuth(credentials);
       
       // Redirect to Google OAuth
       window.location.href = result.authUrl;
      
    } catch (err) {
      setError('Failed to initiate authentication: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated) {
    return (
      <div className="bg-green-900 border border-green-600 rounded-lg p-4 mb-4">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
          <div>
            <h3 className="text-green-300 font-medium">Google Drive Connected</h3>
            <p className="text-green-400 text-sm">You can now browse and stream music from your Google Drive</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-xl font-bold mb-4 text-white">Connect Google Drive</h3>
      
      <div className="space-y-4">
        <p className="text-gray-300">
          To stream music from Google Drive, you need to authorize this application to access your files.
        </p>
        
        {error && (
          <div className="bg-red-900 border border-red-600 rounded p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}
        
        <div className="space-y-3">
          <div className="text-sm text-gray-400">
            <p>✅ Read-only access to your Google Drive</p>
            <p>✅ Only music files will be accessible</p>
            <p>✅ Your files remain private and secure</p>
          </div>
          
          <button
            onClick={initiateAuth}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Connect with Google Drive</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoogleDriveAuth; 