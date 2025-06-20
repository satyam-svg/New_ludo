// hooks/useWebSocket.js - OPTIMIZED FOR GAMES
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const WEBSOCKET_URL = 'ws://192.168.1.4:5000/ws';

// Singleton WebSocket instance
let globalSocket = null;
let globalIsConnected = false;
let messageHandlers = new Set();
let reconnectAttempts = 0;
let maxReconnectAttempts = 3; // Reduced for faster failover
let reconnectTimeout = null;
let isReconnecting = false;
let pingInterval = null;
let lastPongTime = null;

const connectGlobalSocket = () => {
  if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
    console.log('🔗 WebSocket already connected');
    return;
  }

  if (isReconnecting) {
    console.log('🔄 Already attempting to reconnect...');
    return;
  }

  try {
    console.log(`🔌 Connecting to ${WEBSOCKET_URL} (attempt ${reconnectAttempts + 1})`);
    isReconnecting = true;
    
    if (globalSocket) {
      globalSocket.close();
    }
    
    globalSocket = new WebSocket(WEBSOCKET_URL);
    
    // Set a connection timeout
    const connectionTimeout = setTimeout(() => {
      if (globalSocket && globalSocket.readyState !== WebSocket.OPEN) {
        console.log('⏰ Connection timeout, closing socket');
        globalSocket.close();
      }
    }, 5000); // 5 second timeout
    
    globalSocket.onopen = () => {
      console.log('✅ WebSocket connected');
      clearTimeout(connectionTimeout);
      globalIsConnected = true;
      reconnectAttempts = 0;
      isReconnecting = false;
      lastPongTime = Date.now();
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Start ping mechanism
      startPingMechanism();
      
      messageHandlers.forEach(handler => {
        if (handler.onConnect) {
          try {
            handler.onConnect();
          } catch (error) {
            console.error('Error in onConnect handler:', error);
          }
        }
      });
    };

    globalSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle pong responses
        if (data.type === 'pong') {
          lastPongTime = Date.now();
          console.log('🏓 Pong received');
          return;
        }
        
        // Process other messages immediately
        messageHandlers.forEach(handler => {
          if (handler.onMessage) {
            try {
              handler.onMessage(data);
            } catch (error) {
              console.error('Error in onMessage handler:', error);
            }
          }
        });
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    globalSocket.onclose = (event) => {
      console.log(`🔌 WebSocket disconnected (code: ${event.code})`);
      clearTimeout(connectionTimeout);
      globalIsConnected = false;
      isReconnecting = false;
      
      // Stop ping mechanism
      stopPingMechanism();
      
      messageHandlers.forEach(handler => {
        if (handler.onDisconnect) {
          try {
            handler.onDisconnect();
          } catch (error) {
            console.error('Error in onDisconnect handler:', error);
          }
        }
      });
      
      // Quick reconnect for games
      if (messageHandlers.size > 0 && reconnectAttempts < maxReconnectAttempts) {
        const delay = reconnectAttempts === 0 ? 1000 : 2000; // Fast first retry
        console.log(`🔄 Reconnecting in ${delay}ms`);
        
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          connectGlobalSocket();
        }, delay);
      }
    };

    globalSocket.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      clearTimeout(connectionTimeout);
      globalIsConnected = false;
      isReconnecting = false;
    };

  } catch (error) {
    console.error('❌ Error creating WebSocket:', error);
    globalIsConnected = false;
    isReconnecting = false;
  }
};

const startPingMechanism = () => {
  stopPingMechanism(); // Clear any existing ping
  
  pingInterval = setInterval(() => {
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
      const now = Date.now();
      
      // Check if we haven't received a pong in too long
      if (lastPongTime && (now - lastPongTime) > 45000) { // 45 seconds
        console.log('⚠️ No pong received, connection may be dead');
        globalSocket.close();
        return;
      }
      
      try {
        globalSocket.send(JSON.stringify({ 
          type: 'ping', 
          data: { timestamp: now } 
        }));
      } catch (error) {
        console.error('❌ Error sending ping:', error);
      }
    }
  }, 20000); // Ping every 20 seconds (more frequent for games)
};

const stopPingMechanism = () => {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
};

export const useWebSocket = ({ onMessage, onConnect, onDisconnect }) => {
  const [isConnected, setIsConnected] = useState(globalIsConnected);
  const handlerRef = useRef({ onMessage, onConnect, onDisconnect });

  useEffect(() => {
    handlerRef.current = { onMessage, onConnect, onDisconnect };
    messageHandlers.add(handlerRef.current);
    
    if (!globalSocket || globalSocket.readyState !== WebSocket.OPEN) {
      connectGlobalSocket();
    } else if (globalIsConnected && onConnect) {
      try {
        onConnect();
      } catch (error) {
        console.error('Error calling immediate onConnect:', error);
      }
    }
    
    setIsConnected(globalIsConnected);
    
    return () => {
      messageHandlers.delete(handlerRef.current);
      
      if (messageHandlers.size === 0) {
        setTimeout(() => {
          if (messageHandlers.size === 0 && globalSocket) {
            console.log('🔌 Disconnecting unused WebSocket');
            stopPingMechanism();
            globalSocket.close();
            globalSocket = null;
            globalIsConnected = false;
          }
        }, 2000); // Shorter delay for games
      }
    };
  }, []);

  // Faster connection state checking for games
  useEffect(() => {
    const checkConnection = () => {
      const currentlyConnected = globalSocket && globalSocket.readyState === WebSocket.OPEN;
      if (currentlyConnected !== isConnected) {
        setIsConnected(currentlyConnected);
      }
    };
    
    const interval = setInterval(checkConnection, 500); // Check every 500ms
    return () => clearInterval(interval);
  }, [isConnected]);

  const sendMessage = (type, data) => {
    if (globalSocket && globalSocket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, data });
      try {
        globalSocket.send(message);
        return true;
      } catch (error) {
        console.error(`❌ Error sending message ${type}:`, error);
        return false;
      }
    } else {
      console.warn(`⚠️ Cannot send message ${type} - WebSocket not connected`);
      
      // Try immediate reconnect for critical game messages
      if (['roll_dice', 'join_game', 'start_game'].includes(type)) {
        connectGlobalSocket();
      }
      
      return false;
    }
  };

  const forceReconnect = () => {
    console.log('🔄 Force reconnect requested');
    reconnectAttempts = 0;
    if (globalSocket) {
      globalSocket.close();
    }
    setTimeout(() => connectGlobalSocket(), 100);
  };

  return {
    socket: globalSocket,
    isConnected,
    sendMessage,
    forceReconnect
  };
};