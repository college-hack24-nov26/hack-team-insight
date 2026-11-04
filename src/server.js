import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool, verifyDatabaseConnection } from './db.js';
import authRoutes from './routes/auth.js';
import appRoutes from './routes/app.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
const app = express();
app.disable('x-powered-by');
app.use(helmet());
const configuredOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((x) => x.trim());
app.use(cors({
  origin(origin, callback) {
    if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') {
      try {
        const parsed = new URL(origin);
        if (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) return callback(null, true);
      } catch { /* An invalid origin is rejected below. */ }
    }
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/v1/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/api/health', async (_req, res) => {
  try { await verifyDatabaseConnection(); res.json({ status: 'ok', database: 'connected' }); }
  catch (error) {
    console.error(`Database health check failed [${error.code || error.name}]: ${error.message}`);
    const { database, message } = describeDatabaseError(error);
    res.status(503).json({ status: 'degraded', api: 'online', database, message });
  }
});
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', appRoutes);
app.use((err, _req, res, _next) => {
  console.error(`Request failed [${err.code || err.name}]: ${err.message}`);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body exceeds the 1 MB limit.' });
  if (err.message === 'Origin is not allowed by CORS.') return res.status(403).json({ error: 'This frontend origin is not allowed.' });
  if (err.name === 'MulterError') {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? `File exceeds the ${Number(process.env.MAX_UPLOAD_MB || 10)} MB upload limit.` : 'The uploaded file could not be accepted.' });
  }
  if (err.message === 'Upload a PDF, JPG, or PNG file.' || err.message === 'The file contents do not match the selected file type.') return res.status(400).json({ error: err.message });
  if (isDatabaseError(err)) {
    const { message } = describeDatabaseError(err);
    return res.status(503).json({ error: message });
  }
  res.status(500).json({ error: 'The request could not be completed.' });
});
const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid integer from 1 to 65535.');
app.listen(port, () => console.log(`WELLCARE API listening on http://localhost:${port}`));

function isDatabaseError(error) {
  return ['ECONNREFUSED','ETIMEDOUT','ENOTFOUND','ER_ACCESS_DENIED_ERROR','ER_BAD_DB_ERROR','PROTOCOL_CONNECTION_LOST','PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR','ECONNRESET'].includes(error.code);
}

function describeDatabaseError(error) {
  if (error.code === 'ER_ACCESS_DENIED_ERROR') return { database: 'authentication_failed', message: 'MySQL rejected the configured username or password. Check DATABASE_URL in the root .env file.' };
  if (error.code === 'ER_BAD_DB_ERROR') return { database: 'database_not_found', message: 'The WELLCARE database was not found. Create it and import database/schema.sql.' };
  if (error.code === 'ENOTFOUND') return { database: 'host_not_found', message: 'The MySQL host in DATABASE_URL could not be found. Check its hostname.' };
  if (error.code === 'ETIMEDOUT') return { database: 'connection_timed_out', message: 'The MySQL server did not respond. Check that it is running and that the configured port is reachable.' };
  return { database: 'unavailable', message: 'MySQL is unavailable. Start MySQL and verify the host and port in DATABASE_URL.' };
}
