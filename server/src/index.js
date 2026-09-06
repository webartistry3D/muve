import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { registerRoutes as registerAuthRoutes } from './auth.js';
import { registerRideRoutes } from './rides.js';
import { registerSockets } from './sockets.js';
import { setIO } from './state.js';
import { startSimEngine } from './sim.js';

const PORT = process.env.PORT || 4000;
const SIM_MODE = process.env.SIM_MODE !== 'false'; // default: on

// In production, set FRONTEND_URL to the frontend's URL for CORS
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:4321'], credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'muve', time: new Date().toISOString() }));
registerAuthRoutes(app);
registerRideRoutes(app);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:4321'], credentials: true } });
setIO(io);
registerSockets(io);
if (SIM_MODE) startSimEngine();

server.listen(PORT, () => {
  console.log(`muve API server running on http://localhost:${PORT}`);
});
