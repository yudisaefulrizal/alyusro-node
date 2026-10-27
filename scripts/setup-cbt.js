import { pool } from '../src/db.js';
try {
 await pool.query(`CREATE TABLE IF NOT EXISTS node_cbt_attempts (
  peserta_id BIGINT UNSIGNED PRIMARY KEY,
  attempt_key CHAR(32) NOT NULL DEFAULT '',
  snapshot LONGTEXT NOT NULL,
  answers LONGTEXT NOT NULL,
  deadline BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK(JSON_VALID(snapshot)),CHECK(JSON_VALID(answers))
 ) ENGINE=InnoDB`);
 const [attemptColumns]=await pool.query('SHOW COLUMNS FROM node_cbt_attempts');
 if(!attemptColumns.some(column=>column.Field==='attempt_key'))await pool.query("ALTER TABLE node_cbt_attempts ADD COLUMN attempt_key CHAR(32) NOT NULL DEFAULT ''");
 const [columns]=await pool.query("SHOW COLUMNS FROM cbt_peserta");
 const changes=columns.filter(column=>/^j(?:[1-9]|[1-9][0-9]|100)$/.test(column.Field)&&column.Type.startsWith('varchar')).map(column=>'MODIFY `'+column.Field+'` TEXT NULL');
 if(changes.length)await pool.query('ALTER TABLE cbt_peserta '+changes.join(','));
 console.log('Penyimpanan attempt CBT Node siap.');
}finally{await pool.end();}
