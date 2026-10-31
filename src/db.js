import { enableAudit } from './audit.js';
import mysql from 'mysql2/promise';
import { setting } from './config.js';
export { setting } from './config.js';
export const pool = enableAudit(mysql.createPool({ host: setting('DB_HOST') || '127.0.0.1', port: Number(setting('DB_PORT') || 3306), user: setting('DB_USERNAME'), password: setting('DB_PASSWORD'), database: setting('DB_DATABASE'), ...(setting('DB_SOCKET') ? { socketPath: setting('DB_SOCKET') } : {}), charset: 'utf8mb4', connectionLimit: 5, dateStrings: true }));
// Public content queries remain read-only. Auth writes are isolated in auth-store.js.
export async function query(sql, params = []) {
  const connection = await pool.getConnection();
  try { await connection.query('START TRANSACTION READ ONLY'); const [rows] = await connection.execute(sql, params); return rows; }
  finally { try { await connection.rollback(); } finally { connection.release(); } }
}
