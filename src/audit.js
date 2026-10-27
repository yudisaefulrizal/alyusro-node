import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const context = new AsyncLocalStorage();
export const runAudit = (metadata, fn) => context.run({ requestId: randomUUID(), ...metadata }, fn);
export const auditActor = id => { const value = context.getStore(); if (value) value.userId = id; };
const secret = /password|token|csrf|secret|authorization/i;
export function redactAudit(value) {
 if (Array.isArray(value)) return value.map(redactAudit);
 if (!value || typeof value !== 'object') return value;
 return Object.fromEntries(Object.entries(value).filter(([key]) => !secret.test(key)).map(([key, item]) => [key, redactAudit(item)]));
}
const tables = new Set(['users','roles','permissions','model_has_roles','model_has_permissions','role_has_permissions','santris','foto_santris','penerimaan_santris','status_catatan','referral_sources','program_pendidikans','kalender_akademiks','prestasis','nama_kota','cbt_tema_soal','cbt_soal','cbt_ujian','cbt_peserta','cbt_jawaban','cbt_peserta_publik','kategori_artikels','kategori_fasilitas','struktur_mahads','menus','event_mahads','artikels','fasilitas','galeri_fasilitas','dokumens','perpustakaan_namas','ijazahs','ijazah_darul_ilmis','ijazah_mahad_alies']);
const keysFor = table => ({model_has_roles:['role_id','model_type','model_id'],model_has_permissions:['permission_id','model_type','model_id'],role_has_permissions:['permission_id','role_id']}[table] || ['id']);
const identifier = key => '`' + key + '`';
const identity = (table,row) => keysFor(table).map(key => String(row[key])).join(':');

// Only our deliberately restricted SQL write shapes are accepted for audited tables.
// Snapshots, the mutation and its audit entries share the original transaction.
export function auditedConnection(connection) {
 let transaction = false;
 const execute = connection.execute.bind(connection), query = connection.query.bind(connection);
 const begin = async () => { await connection.beginTransaction(); transaction = true; };
 const commit = async () => { await connection.commit(); transaction = false; };
 const rollback = async () => { try { await connection.rollback(); } finally { transaction = false; } };
 async function write(sql,args = [],method = execute) {
  const metadata = context.getStore();
  const match = typeof sql === 'string' && sql.match(/^\s*(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+`?([a-z_]+)`?\s*/i);
  if (!metadata?.enabled || !match || !tables.has(match[2])) return method(sql,args);
  const table = match[2], operation = match[1].toUpperCase().startsWith('INSERT') ? 'INSERT' : match[1].toUpperCase().startsWith('DELETE') ? 'DELETE' : 'UPDATE';
  const own = !transaction;
  if (own) await begin();
  try {
   let before = [];
   if (operation !== 'INSERT') {
    const whereAt = sql.search(/\sWHERE\s/i);
    if (whereAt < 0) throw new Error('Audited UPDATE/DELETE requires a WHERE clause');
    const predicate = sql.slice(whereAt).replace(/;\s*$/,'');
    const skipped = (sql.slice(0,whereAt).match(/\?/g) || []).length;
    [before] = await execute(`SELECT * FROM ${identifier(table)} ${predicate} FOR UPDATE`,args.slice(skipped));
   }
   const result = await method(sql,args);
   let after = [];
   if (operation === 'INSERT') {
    if (result[0].affectedRows !== 1 || /ON\s+DUPLICATE\s+KEY/i.test(sql)) throw new Error('Audited inserts must insert exactly one row without upsert');
    if (keysFor(table)[0] === 'id') {
     if (!result[0].insertId) throw new Error('Audited insert must return a primary key');
     [after] = await execute(`SELECT * FROM ${identifier(table)} WHERE id=?`,[result[0].insertId]);
    } else {
     const fields = sql.slice(match[0].length).match(/^\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
     if (!fields || fields[2].split(',').some(v=>v.trim() !== '?')) throw new Error('Unsupported audited relationship insert');
     const values = Object.fromEntries(fields[1].split(',').map((key,i)=>[key.trim().replaceAll('`',''),args[i]]));
     [after] = await execute(`SELECT * FROM ${identifier(table)} WHERE ${keysFor(table).map(key=>identifier(key)+'=?').join(' AND ')}`,keysFor(table).map(key=>values[key]));
    }
   } else if (operation === 'UPDATE') {
    for (const row of before) {
     const [rows] = await execute(`SELECT * FROM ${identifier(table)} WHERE ${keysFor(table).map(key=>identifier(key)+'=?').join(' AND ')}`,keysFor(table).map(key=>row[key]));
     if (rows[0]) after.push(rows[0]);
    }
   }
   const originals = new Map(before.map(row=>[identity(table,row),row]));
   for (const row of operation === 'DELETE' ? before : after) {
    let oldData = operation === 'INSERT' ? null : redactAudit(originals.get(identity(table,row)) || row);
    let newData = operation === 'DELETE' ? null : redactAudit(row);
    if (operation === 'UPDATE') {
     const fields = Object.keys(newData).filter(key=>!['updated_at','created_at'].includes(key) && JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]));
     const sensitive = Object.keys(row).filter(key=>secret.test(key) && row[key] !== originals.get(identity(table,row))?.[key]);
     oldData = Object.fromEntries(fields.map(key=>[key,oldData[key]]));
     newData = Object.fromEntries(fields.map(key=>[key,newData[key]]));
     if (sensitive.length) newData.changed_sensitive_fields = sensitive;
     if (!fields.length && !sensitive.length) continue;
    }
    await execute('INSERT INTO audit_logs (user_id,actor_type,action,table_name,record_id,old_data,new_data,ip_address,user_agent,request_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',[metadata.userId || null,metadata.userId ? 'USER' : 'SYSTEM',operation,table,identity(table,row),oldData === null ? null : JSON.stringify(oldData),newData === null ? null : JSON.stringify(newData),metadata.ip?.slice(0,45) || null,metadata.userAgent?.slice(0,2048) || null,metadata.requestId]);
   }
   if (own) await commit();
   return result;
  } catch (error) { if (own) await rollback(); throw error; }
 }
 return new Proxy(connection,{get(target,key){
  if (key === 'execute') return (sql,args)=>write(sql,args);
  if (key === 'query') return async(sql,args)=>{
   if (typeof sql === 'string' && /^\s*(START TRANSACTION|BEGIN)/i.test(sql)) {const result=await query(sql,args);transaction=true;return result;}
   if (typeof sql === 'string' && /^\s*(COMMIT|ROLLBACK)/i.test(sql)) {const result=await query(sql,args);transaction=false;return result;}
   return write(sql,args,query);
  };
  if(key === 'beginTransaction')return begin;
  if(key === 'commit')return commit;
  if(key === 'rollback')return rollback;
  const value = Reflect.get(target,key,target);return typeof value === 'function' ? value.bind(target) : value;
 }});
}

export function enableAudit(pool) {
 const acquire = pool.getConnection.bind(pool);
 pool.getConnection = async()=>auditedConnection(await acquire());
 pool.query = async(sql,args)=>{const c=await pool.getConnection();try{return await c.query(sql,args);}finally{c.release();}};
 pool.execute = async(sql,args)=>{const c=await pool.getConnection();try{return await c.execute(sql,args);}finally{c.release();}};
 return pool;
}
