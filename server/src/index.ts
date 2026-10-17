import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { authRouter } from './routes/authRoutes.js';
import { teamRouter } from './routes/teamRoutes.js';
import { workItemRouter } from './routes/workItemRoutes.js';
import { outboxRouter } from './routes/outboxRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { OutboxWorker } from './services/outboxWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static frontend assets if built
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'newtonite-operations-under-pressure',
    timestamp: new Date().toISOString()
  });
});

// Root route: Redirect or guide to UI
app.get('/', (req, res) => {
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    res.sendFile(path.join(clientDist, 'index.html'));
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Newtonite API Server</title>
          <style>
            body { font-family: sans-serif; background: #070a13; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #0e1424; padding: 32px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); text-align: center; max-width: 480px; }
            a { display: inline-block; margin-top: 16px; background: #6366f1; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚡ Newtonite API Server is Running</h2>
            <p style="color: #94a3b8;">Port 5000 hosts the backend REST API. The web application frontend is running on Port 3000.</p>
            <a href="http://localhost:3000">Open Web App Dashboard (Port 3000) &rarr;</a>
          </div>
        </body>
      </html>
    `);
  }
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/teams', teamRouter);
app.use('/api/work-items', workItemRouter);
app.use('/api/outbox', outboxRouter);

// Global Error Handler
app.use(errorHandler);

// Start server if not imported by test suite
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, () => {
    console.log(`[Newtonite Server] Running on http://localhost:${config.port}`);
    OutboxWorker.start();
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Newtonite Server] Shutting down gracefully...');
    OutboxWorker.stop();
    server.close(() => {
      console.log('[Newtonite Server] HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
