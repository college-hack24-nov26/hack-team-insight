import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure the MySQL connection.');
}

let parsedDatabaseUrl;
try {
  parsedDatabaseUrl = new URL(databaseUrl);
} catch {
  throw new Error('DATABASE_URL must be a valid MySQL connection URL.');
}
if (!['mysql:', 'mysql2:'].includes(parsedDatabaseUrl.protocol) || !parsedDatabaseUrl.hostname || !parsedDatabaseUrl.pathname.slice(1)) {
  throw new Error('DATABASE_URL must include a MySQL host and database name.');
}

export const pool = mysql.createPool({
  host: parsedDatabaseUrl.hostname,
  port: Number(parsedDatabaseUrl.port || 3306),
  user: decodeURIComponent(parsedDatabaseUrl.username),
  password: decodeURIComponent(parsedDatabaseUrl.password),
  database: decodeURIComponent(parsedDatabaseUrl.pathname.slice(1)),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
});
export async function verifyDatabaseConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
}

