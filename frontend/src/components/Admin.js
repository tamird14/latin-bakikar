import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Admin = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clearingSessions, setClearingSessions] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/sessions');
        if (response.ok) {
          const data = await response.json();
          setSessions(data.activeSessions || []);
        } else {
          setError('Failed to load sessions');
        }
      } catch (err) {
        setError('Failed to load sessions: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinSession = (sessionId) => {
    navigate(`/session/${sessionId}`);
  };

  const handleClearAllSessions = async () => {
    if (!window.confirm('Are you sure you want to close and delete ALL active sessions? This action cannot be undone.')) {
      return;
    }

    try {
      setClearingSessions(true);
      const response = await fetch('/api/sessions', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Cleared all sessions:', result);
        setSessions([]); // Clear the sessions list
        alert(`Successfully cleared ${result.clearedSessions} sessions and ${result.clearedClients} clients.`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear sessions');
      }
    } catch (err) {
      console.error('Error clearing sessions:', err);
      alert('Failed to clear sessions: ' + err.message);
    } finally {
      setClearingSessions(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
          <div className="flex items-center space-x-3">
            {sessions.length > 0 && (
              <button 
                onClick={handleClearAllSessions}
                disabled={clearingSessions}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  clearingSessions 
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {clearingSessions ? 'Clearing...' : '🗑️ Close All Sessions'}
              </button>
            )}
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              ← Back to Home
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Active Sessions</h2>
            <div className="text-sm text-gray-500">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} active
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🎵</div>
              <p className="text-gray-600 text-lg">No active sessions</p>
              <p className="text-gray-500 text-sm mt-2">Create a session to get started</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <div key={session.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 truncate">
                        {session.name || 'Unnamed Session'}
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">
                        {session.id}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {session.clientCount}
                      </div>
                      <div className="text-xs text-gray-500">
                        participant{session.clientCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Current Song:</span>
                      <span className="font-medium">
                        {session.hasCurrentSong ? 'Playing' : 'None'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Queue Length:</span>
                      <span className="font-medium">{session.queueLength}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Updated:</span>
                      <span className="font-medium">{formatTime(session.lastUpdate)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinSession(session.id)}
                    className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Join Session
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin; 