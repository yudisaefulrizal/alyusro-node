import { readFile, mkdir } from 'node:fs/promises';
import { pool } from '../src/db.js';
import { publicStorageRoot } from '../src/config.js';

try {
 const [tables] = await pool.query('SHOW TABLES');
 if (tables.length) throw new Error('Database harus kosong. Untuk data lama, impor backup SQL; jalankan auth:setup dan cbt:setup bila diperlukan.');
 const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
 const connection = await pool.getConnection();
 try {
  // Execute trusted repository DDL on one connection; never accept user SQL.
  for (const statement of schema.split(/;\s*(?:\n|$)/)) if (statement.trim()) await connection.query(statement);
  await connection.execute("INSERT INTO roles (name,guard_name,created_at,updated_at) VALUES ('Wali santri','web',NOW(),NOW())");
 } finally { await connection.query('SET FOREIGN_KEY_CHECKS=1'); connection.release(); }
 await mkdir(publicStorageRoot, { recursive:true });
 await mkdir(new URL('../storage/uploads/', import.meta.url), { recursive:true });
 console.log('Skema database mandiri siap. Impor data konten/hak akses yang diperlukan secara privat; tidak ada akun atau password bawaan.');
} finally { await pool.end(); }
