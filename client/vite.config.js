import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // In dev, rewrite /app and /app/* to /app.html so Vite serves the React entry
    // Serve landing.html at / since the Vite entry is landing.html
    {
      name: 'app-route-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Serve the landing page at /
          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/landing.html';
          }
          // Rewrite /app to /app.html for the React app
          if (req.url === '/app' || req.url === '/app/') {
            req.url = '/app.html';
          }
          // In dev, /app/* public assets (manifest, icons, sw) are served from root
          if (req.url.startsWith('/app/manifest.webmanifest') ||
              req.url.startsWith('/app/icon-') ||
              req.url.startsWith('/app/sw.js')) {
            req.url = req.url.replace('/app/', '/');
          }
          next();
        });
      },
    },
  ],
  // In production the app is served at /app, so assets must be prefixed with /app/
  // In dev, serve at root (/) — Vite proxy handles /api and /socket.io
  base: command === 'build' ? '/app/' : '/',
  build: {
    rollupOptions: {
      input: {
        landing: path.resolve(__dirname, 'landing.html'),
        app: path.resolve(__dirname, 'app.html'),
      },
    },
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
}));
