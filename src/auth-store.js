import { pool } from './db.js';
export const modelType = 'App\\Models\\User';
export function createAuthStore(pool) {
async function transaction(fn) {
  const c = await pool.getConnection();
  try { await c.beginTransaction(); const value = await fn(c); await c.commit(); return value; }
  catch (e) { await c.rollback(); throw e; } finally { c.release(); }
}
const run = async (sql, args = []) => (await pool.execute(sql, args))[0];
return {
  async session(id) { return (await run('SELECT * FROM node_auth_sessions WHERE id=? AND expires_at > UNIX_TIMESTAMP()', [id]))[0]; },
  async putSession(s) { await run('INSERT INTO node_auth_sessions (id,user_id,csrf,password_hash,remember,expires_at,last_activity,ip_address,user_agent) VALUES (?,?,?,?,?,?,?,?,?)', [s.id,s.user_id,s.csrf,s.password_hash,s.remember,s.expires_at,s.last_activity,s.ip_address,s.user_agent]); },
  async touch(id, expiry) { await run('UPDATE node_auth_sessions SET expires_at=?,last_activity=UNIX_TIMESTAMP() WHERE id=?', [expiry,id]); },
  async deleteSession(id) { await run('DELETE FROM node_auth_sessions WHERE id=?', [id]); },
  async sessions(userId) { return run('SELECT id,ip_address,user_agent,last_activity FROM node_auth_sessions WHERE user_id=? AND expires_at>UNIX_TIMESTAMP() ORDER BY last_activity DESC',[userId]); },
  async revokeOthers(userId,id) { await run('DELETE FROM node_auth_sessions WHERE user_id=? AND id<>?',[userId,id]); },
  async user(id) { return (await run('SELECT * FROM users WHERE id=?',[id]))[0]; },
  async login(value) { return (await run(`SELECT * FROM users WHERE ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'email' : 'nomor_kk'}=? LIMIT 1`,[value]))[0]; },
  async email(value) { return (await run('SELECT * FROM users WHERE email=? LIMIT 1',[value]))[0]; },
  async access(id) {
    const roles = await run("SELECT r.name FROM roles r JOIN model_has_roles m ON m.role_id=r.id WHERE m.model_id=? AND m.model_type=? AND r.guard_name='web'",[id,modelType]);
    const permissions = await run(`SELECT DISTINCT p.name FROM permissions p WHERE p.guard_name='web' AND (p.id IN (SELECT permission_id FROM model_has_permissions WHERE model_id=? AND model_type=?) OR p.id IN (SELECT rp.permission_id FROM role_has_permissions rp JOIN model_has_roles m ON m.role_id=rp.role_id WHERE m.model_id=? AND m.model_type=?))`,[id,modelType,id,modelType]);
    return {roles:roles.map(r=>r.name),permissions:permissions.map(p=>p.name)};
  },
  async register(data) {
    return transaction(async c => {
      const [roles] = await c.execute("SELECT id FROM roles WHERE name='Wali santri' AND guard_name='web'");
      if (!roles.length) throw new Error('Role Wali santri belum tersedia.');
      const [result] = await c.execute('INSERT INTO users (name,email,password,nomor_kk,created_at,updated_at) VALUES (?,?,?,?,NOW(),NOW())',[data.name,data.email,data.password,data.nomor_kk]);
      await c.execute('INSERT INTO model_has_roles (role_id,model_type,model_id) VALUES (?,?,?)',[roles[0].id,modelType,result.insertId]);
      return result.insertId;
    });
  },
  async profile(id, data) { await run('UPDATE users SET name=?,email=?,updated_at=NOW() WHERE id=?',[data.name,data.email,id]); },
  async avatar(id,path) { await run('UPDATE users SET avatar_url=?,updated_at=NOW() WHERE id=?',[path,id]); },
  async kk(id,value) { await run('UPDATE users SET nomor_kk=?,updated_at=NOW() WHERE id=?',[value,id]); },
  async changePassword(id,password,rememberToken) { await run('UPDATE users SET password=?,remember_token=?,updated_at=NOW() WHERE id=?',[password,rememberToken,id]); },
  async deleteUser(id) { await transaction(async c => {
    await c.execute('DELETE FROM model_has_roles WHERE model_id=? AND model_type=?',[id,modelType]);
    await c.execute('DELETE FROM model_has_permissions WHERE model_id=? AND model_type=?',[id,modelType]);
    await c.execute('DELETE FROM node_auth_sessions WHERE user_id=?',[id]);
    await c.execute('DELETE FROM node_auth_resets WHERE user_id=?',[id]);
    await c.execute('DELETE FROM users WHERE id=?',[id]);
  }); },
  async rate(key,max,seconds=60) {
    await run('INSERT INTO node_auth_limits (`key`,attempts,expires_at) VALUES (?,1,UNIX_TIMESTAMP()+?) ON DUPLICATE KEY UPDATE attempts=IF(expires_at<=UNIX_TIMESTAMP(),1,attempts+1),expires_at=IF(expires_at<=UNIX_TIMESTAMP(),UNIX_TIMESTAMP()+?,expires_at)',[key,seconds,seconds]);
    const [row] = await run('SELECT attempts FROM node_auth_limits WHERE `key`=?',[key]);
    return row.attempts<=max;
  },
  async createReset(user,tokenHash) { return transaction(async c => {
    // Lock the account so parallel requests cannot bypass the per-account cooldown.
    await c.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[user.id]);
    const [rows]=await c.execute('SELECT created_at FROM node_auth_resets WHERE user_id=?',[user.id]);
    if(rows.length && Number(rows[0].created_at)>Date.now()/1000-60) return false;
    await c.execute('INSERT INTO node_auth_resets (user_id,email,token_hash,created_at) VALUES (?,?,?,UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE email=VALUES(email),token_hash=VALUES(token_hash),created_at=VALUES(created_at)',[user.id,user.email,tokenHash]);
    return true;
  }); },
  async reset(email,tokenHash,password,rememberToken) { return transaction(async c => {
    const [rows]=await c.execute('SELECT * FROM node_auth_resets WHERE email=? AND token_hash=? AND created_at>UNIX_TIMESTAMP()-3600 FOR UPDATE',[email,tokenHash]);
    if(!rows.length)return false;
    const [result]=await c.execute('UPDATE users SET password=?,remember_token=?,updated_at=NOW() WHERE id=? AND email=?',[password,rememberToken,rows[0].user_id,email]);
    await c.execute('DELETE FROM node_auth_resets WHERE user_id=?',[rows[0].user_id]);
    await c.execute('DELETE FROM node_auth_sessions WHERE user_id=?',[rows[0].user_id]);
    return result.affectedRows===1;
  }); },
};

}
export const authStore=createAuthStore(pool);
