import { Platform, NativeModules } from 'react-native';
import { io } from 'socket.io-client';

// Helper to extract the local host IP dynamically from Metro Bundler's script URL.
// This allows physical devices (connected via same Wi-Fi) to reach the server automatically.
const getMetroHost = () => {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      // e.g. "http://10.188.179.4:8081/index.bundle?platform=android..."
      const host = scriptURL.split('://')[1]?.split('/')[0]?.split(':')[0];
      // Check if it looks like a local network IP address, and ignore stale IP
      if (host && host !== '10.188.179.4' && (host.startsWith('192.') || host.startsWith('10.') || host.startsWith('172.'))) {
        return host;
      }
    }
  } catch (e) {
    console.warn('Could not dynamically resolve host IP:', e);
  }
  return null;
};

const hostIP = getMetroHost() || '10.223.99.4'; // Fallback to your host's local Wi-Fi IP address

// Dynamic socket URL routing based on platform
const SOCKET_URL = Platform.OS === 'web'
  ? 'http://localhost:5000'
  : `http://${hostIP}:5000`;
const FALLBACK_URL = 'http://localhost:5000';

let socket = null;

export const getSocket = () => {
  if (socket) return socket;

  try {
    socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: false
    });
    
    // Setup generic connection failure fallback
    socket.on('connect_error', () => {
      if (socket.io.uri === SOCKET_URL) {
        console.log('Falling back socket connection to localhost');
        socket.io.uri = FALLBACK_URL;
        socket.connect();
      }
    });
  } catch (err) {
    console.error('Socket init failed: ', err);
  }

  return socket;
};

export const connectSocket = (userId, name) => {
  const s = getSocket();
  if (s && !s.connected) {
    s.auth = { userId, name };
    s.connect();
    console.log('Socket client connecting...');
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket client disconnected');
  }
};
