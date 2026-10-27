import { pool } from '../src/db.js';
try {
  await pool.query('DELETE FROM node_auth_sessions WHERE expires_at<=UNIX_TIMESTAMP()');
  await pool.query('DELETE FROM node_auth_resets WHERE created_at<=UNIX_TIMESTAMP()-3600');
  await pool.query('DELETE FROM node_auth_limits WHERE expires_at<=UNIX_TIMESTAMP()');
  console.log('Sesi, token reset, dan penghitung percobaan Node.js yang kedaluwarsa telah dibersihkan.');
}finally{await pool.end();}
