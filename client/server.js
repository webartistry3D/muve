// Production frontend server — serves the landing page at / and the React app at /app
// Used when deploying the frontend as a separate web service (e.g. Render)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 5173;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');

const app = express();

// Serve all static files from dist/
app.use(express.static(dist));

// The Vite build uses base: '/app/' so all asset references are /app/assets/...
// and /app/sw.js, /app/manifest.webmanifest, etc.
// Map /app/* static files (with extensions) to dist/* by stripping the /app prefix
app.use('/app', express.static(dist));

// SPA fallback for /app/* — serve the React app shell
// Only serve app.html for navigation routes (no file extension)
app.get(/^\/app(.*)$/, (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  if (path.extname(req.path)) return next(); // let express.static handle files
  res.sendFile(path.join(dist, 'app.html'));
});

// For any other unmatched route, serve the landing page
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  // Try to serve the exact file first (about.html, contact.html, etc.)
  const file = path.join(dist, req.path);
  res.sendFile(file, (err) => {
    if (err) res.sendFile(path.join(dist, 'index.html'));
  });
});

app.listen(PORT, () => {
  console.log(`muve frontend running on http://localhost:${PORT}`);
});
