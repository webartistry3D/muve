import express from 'express';
import http from 'http';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { registerRoutes as registerAuthRoutes } from './auth.js';
import { registerRideRoutes } from './rides.js';
import { registerSockets } from './sockets.js';
import { setIO } from './state.js';
import { startSimEngine } from './sim.js';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'zber', time: new Date().toISOString() }));
registerAuthRoutes(app);
registerRideRoutes(app);

// In production (e.g. Render) serve the built client from this same server
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
setIO(io);
registerSockets(io);
startSimEngine();

server.listen(PORT, () => {
  console.log(`zber server running on http://localhost:${PORT}`);
});
