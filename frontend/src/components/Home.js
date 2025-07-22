import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, getSession } from '../services/api';

const Home = () => {
  const [sessionName, setSessionName] = useState('');
  const [joinSessionId, setJoinSessionId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      setError('Please enter a session name');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await createSession(sessionName);
      navigate(`/session/${response.sessionId}?host=true`);
    } catch (err) {
      setError('Failed to create session. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSession = async () => {
    if (!joinSessionId.trim()) {
      setError('Please enter a session ID');
      return;
    }

    setIsJoining(true);
    setError('');
    const sessionId = joinSessionId.trim();

    try {
      // Check if session exists before navigating
      await getSession(sessionId);
      navigate(`/session/${sessionId}`);
    } catch (err) {
      setError('Session not found. Please check the session ID and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <div className="bg-white bg-opacity-20 backdrop-blur-lg rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl">🎵</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Latin BaKikar</h1>
          <p className="text-white text-opacity-80">Collaborative Music Streaming</p>
        </div>

        {/* Main Card */}
        <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white border-opacity-20">
          {error && (
            <div className="bg-red-500 bg-opacity-20 border border-red-500 border-opacity-50 rounded-xl p-3 mb-6">
              <p className="text-red-100 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Create Session */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Create Session</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter session name..."
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full px-4 py-3 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl text-white placeholder-white placeholder-opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
              />
              <button
                onClick={handleCreateSession}
                disabled={isCreating}
                className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 disabled:bg-opacity-10 backdrop-blur-sm border border-white border-opacity-30 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create & Host Session'}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-white bg-opacity-30"></div>
            <span className="px-4 text-white text-opacity-70 text-sm">OR</span>
            <div className="flex-1 h-px bg-white bg-opacity-30"></div>
          </div>

          {/* Join Session */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Join Session</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter session ID..."
                value={joinSessionId}
                onChange={(e) => setJoinSessionId(e.target.value)}
                className="w-full px-4 py-3 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl text-white placeholder-white placeholder-opacity-70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                onKeyPress={(e) => e.key === 'Enter' && handleJoinSession()}
              />
              <button
                onClick={handleJoinSession}
                disabled={isJoining}
                className="w-full bg-transparent hover:bg-white hover:bg-opacity-10 border-2 border-white border-opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:bg-opacity-10 disabled:cursor-not-allowed"
              >
                {isJoining ? 'Checking...' : 'Join Session'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white text-opacity-60 text-sm mb-4">
            Stream music together with friends in real-time
          </p>
          <button
            onClick={() => navigate('/admin')}
            className="text-white text-opacity-80 hover:text-opacity-100 text-sm underline transition-opacity"
          >
            Admin Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home; 