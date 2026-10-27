import { pool } from '../src/db.js';
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS node_auth_sessions (
    id CHAR(64) PRIMARY KEY, user_id BIGINT UNSIGNED NULL, csrf CHAR(64) NOT NULL,
    password_hash CHAR(64) NULL, remember BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at BIGINT NOT NULL,last_activity BIGINT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,user_agent VARCHAR(512) NOT NULL,
    INDEX(user_id),INDEX(expires_at)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS node_auth_resets (
    user_id BIGINT UNSIGNED PRIMARY KEY,email VARCHAR(255) NOT NULL,token_hash CHAR(64) NOT NULL,
    created_at BIGINT NOT NULL, INDEX(email),INDEX(created_at)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS node_auth_limits (
    \`key\` CHAR(64) PRIMARY KEY,attempts INT UNSIGNED NOT NULL,expires_at BIGINT NOT NULL,INDEX(expires_at)
  ) ENGINE=InnoDB`);
  console.log('Tabel autentikasi Node.js siap. Tabel Laravel tidak diubah.');
} finally { await pool.end(); }
