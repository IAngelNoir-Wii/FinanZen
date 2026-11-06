import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { FinanceData } from './src/types/finance';
import { getInitialFinanceData } from './src/utils/defaultData';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'finance_store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache + persistent disk storage
let cachedData: FinanceData;

function loadStoredData(): FinanceData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(fileContent);
      if (parsed && Array.isArray(parsed.transactions) && Array.isArray(parsed.loans)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading persistent data file, fallback to default seed:', err);
  }

  const initial = getInitialFinanceData();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  } catch (writeErr) {
    console.error('Error writing initial data to disk:', writeErr);
  }
  return initial;
}

cachedData = loadStoredData();

// SSE (Server-Sent Events) clients for real-time live sync across devices
const sseClients: Response[] = [];

function broadcastUpdate(data: FinanceData) {
  const payload = `data: ${JSON.stringify({ type: 'SYNC_UPDATE', data })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // API Healthcheck
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      version: cachedData.version,
      lastUpdated: cachedData.lastUpdated,
      clientsCount: sseClients.length,
    });
  });

  // GET complete financial dataset
  app.get('/api/finance/data', (_req: Request, res: Response) => {
    res.json(cachedData);
  });

  // POST sync and persist financial dataset
  app.post('/api/finance/sync', (req: Request, res: Response) => {
    try {
      const incomingData: FinanceData = req.body;
      if (!incomingData || !Array.isArray(incomingData.transactions)) {
        return res.status(400).json({ error: 'Formato de datos no válido' });
      }

      cachedData = {
        ...incomingData,
        version: (cachedData.version || 0) + 1,
        lastUpdated: new Date().toISOString(),
      };

      // Atomic save to persistent disk
      const tempPath = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(cachedData, null, 2), 'utf-8');
      fs.renameSync(tempPath, DATA_FILE);

      // Notify all other connected devices/tabs
      broadcastUpdate(cachedData);

      res.json({
        success: true,
        version: cachedData.version,
        lastUpdated: cachedData.lastUpdated,
      });
    } catch (err: any) {
      console.error('Error saving data:', err);
      res.status(500).json({ error: 'Error al sincronizar datos', message: err?.message });
    }
  });

  // POST reset to seed or clean state
  app.post('/api/finance/reset', (req: Request, res: Response) => {
    try {
      const mode = req.body?.mode || 'seed';
      if (mode === 'clean') {
        const initial = getInitialFinanceData();
        cachedData = {
          ...initial,
          transactions: [],
          loans: [],
          debts: [],
          version: (cachedData.version || 0) + 1,
          lastUpdated: new Date().toISOString(),
        };
      } else {
        cachedData = {
          ...getInitialFinanceData(),
          version: (cachedData.version || 0) + 1,
          lastUpdated: new Date().toISOString(),
        };
      }

      fs.writeFileSync(DATA_FILE, JSON.stringify(cachedData, null, 2), 'utf-8');
      broadcastUpdate(cachedData);

      res.json({ success: true, data: cachedData });
    } catch (err: any) {
      res.status(500).json({ error: 'Error resetting data', message: err?.message });
    }
  });

  // Real-time Server-Sent Events stream for multi-device sync
  app.get('/api/finance/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Initial keepalive comment
    res.write(': connected\n\n');
    sseClients.push(res);

    req.on('close', () => {
      const idx = sseClients.indexOf(res);
      if (idx !== -1) {
        sseClients.splice(idx, 1);
      }
    });
  });

  // Dev vs Prod Vite middleware handling
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FinanZen Server] listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
