import { io } from 'socket.io-client';
import { getToken } from './api.js';

// In dev, Vite proxies /socket.io to localhost:4000. In prod, VITE_API_URL is the backend.
const SOCKET_URL = import.meta.env.VITE_API_URL || '/';

let socket = null;

export function getSocket() {
  if (!socket && getToken()) {
    socket = io(SOCKET_URL, { auth: { token: getToken() } });
  }
  return socket;
}

export function resetSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
