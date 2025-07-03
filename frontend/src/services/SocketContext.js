import React, { createContext, useContext, useEffect, useState } from 'react';
// import io from 'socket.io-client'; // Disabled for serverless deployment

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Temporarily disable Socket.io for serverless deployment
    console.log('Socket.io disabled for serverless deployment');
    
    // Mock socket for compatibility
    const mockSocket = {
      emit: (event, data) => console.log('Mock socket emit:', event, data),
      on: (event, callback) => console.log('Mock socket on:', event),
      off: (event) => console.log('Mock socket off:', event),
      connected: false
    };
    
    setSocket(mockSocket);
    setIsConnected(false); // Keep disconnected for now
  }, []);

  const value = {
    socket,
    isConnected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
