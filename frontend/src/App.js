import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Session from './components/Session';
import Admin from './components/Admin';
import { SocketProvider } from './services/SocketContext';

function App() {
  return (
    <SocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/session/:sessionId" element={<Session />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </Router>
    </SocketProvider>
  );
}

export default App;
