import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { pool } from './db.js';
import { modelType } from './auth-store.js';
import { invalidatePermissionCache } from './permission-cache.js';
import { redactAudit } from './audit.js';
import { esc } from './dashboard-shell.js';
import { tableQuery, tableFilters, renderTable, tableExport, tableRowActions, selectedTableIds } from './dashboard-table.js';

const configs = {users:{title:'User',permission:'user'},roles:{title:'Peran',permission:'role'},'audit-logs':{title:'Audit Logs',permission:'audit::log'}};
const validId = value => /^[1-9]\d{0,14}$/.test(String(value));
export function adminRoute(path) {
 const match = path.match(/^\/dashboard\/(users|roles|audit-logs)(?:\/(create|delete|bulk-role)|\/([1-9]\d{0,14})\/(edit|view|delete))?$/);
 return match ? {resource:match[1],action:match[3]?match[4]:match[2]==='delete'?'bulkDelete':match[2] || 'list',id:match[3]} : null;
}
const checkboxIds = (data,prefix) => Object.entries(data).filter(([key])=>key.startsWith(prefix)).every(([key,value])=>new RegExp('^'+prefix+'[1-9]\\d{0,14}$').test(key)&&value==='1') ? Object.keys(data).filter(key=>key.startsWith(prefix)).map(key=>key.slice(prefix.length)) : null;
const csrfInput = csrf => `<input type="hidden" name="_csrf" value="${esc(csrf)}">`;
const input = (key,label,value='',extra='') => `<label class="field"><span class="field-label">${esc(label)}</span><input name="${key}" value="${esc(value)}" ${extra.includes('maxlength=')?'':'maxlength="255"'} ${extra}></label>`;
const displayJson = value => {try{return JSON.stringify(redactAudit(typeof value==='string'?JSON.parse(value):value),null,2);}catch{return '[Data JSON tidak valid]';}};

export function createAdminResources(db=pool,{invalidate=invalidatePermissionCache}={}) {
 return async function admin({resource,action='list',id,access,user,params=new URLSearchParams(),csrf='',data}) {
  const config = configs[resource], base = '/dashboard/'+resource;
  if(!config)return {status:404,title:'Tidak ditemukan',body:''};
  const message=(status,text)=>({status,title:config.title,body:`<section><p>${esc(text)}</p><a href="${base}">Kembali</a></section>`});
  const has = permission=>access.permissions.includes(permission+'_'+config.permission);
  const permission={list:'view_any',create:'create',edit:'update',view:'view',delete:'delete',bulkDelete:'delete_any','bulk-role':'update'}[action];
  if(!permission || (resource==='audit-logs'&&!['list','view'].includes(action)) || (resource==='users'&&['view','delete'].includes(action)) || (resource!=='users'&&action==='bulk-role'))return message(404,'Halaman tidak ditemukan.');
  if(!has(permission))return message(403,'Anda tidak memiliki izin untuk tindakan ini.');
  if(['edit','view','delete'].includes(action)&&!validId(id))return message(404,'Data tidak ditemukan.');
  const c=await db.getConnection();let transaction=false;
  try {
   if(resource==='audit-logs') {
    if(action==='view') {
     const [rows]=await c.execute('SELECT a.*,u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.id=?',[id]);
     if(!rows.length)return message(404,'Log tidak ditemukan.');
     const row=rows[0];
     return {status:200,title:config.title,body:`<section><dl>${['id','user_name','actor_type','action','table_name','record_id','ip_address','user_agent','request_id','created_at'].map(key=>`<dt>${esc(key)}</dt><dd>${esc(row[key]??'SYSTEM')}</dd>`).join('')}</dl><h2>Data lama</h2><pre class="audit-data">${esc(displayJson(row.old_data))}</pre><h2>Data baru</h2><pre class="audit-data">${esc(displayJson(row.new_data))}</pre><a href="${base}">Kembali</a></section>`};
    }
    const query=tableQuery(params,{sorts:['id','created_at','user_name'],defaultSort:'created_at'});if(query&&!params.has('direction'))query.direction='desc';
    const [names]=await c.execute('SELECT DISTINCT table_name FROM audit_logs ORDER BY table_name');
    const definitions=[{name:'action',label:'Tindakan',options:['INSERT','UPDATE','DELETE'].map(value=>({value,label:value}))},{name:'table_name',label:'Tabel',options:names.map(row=>({value:row.table_name,label:row.table_name}))}];
    const filters=tableFilters(params,definitions);
    if(!query||!filters)return message(422,'Pencarian, filter atau halaman tidak valid.');
    const sort={id:'a.id',created_at:'a.created_at',user_name:'u.name'}[query.sort];
    const [rows]=await c.execute(`SELECT a.id,a.actor_type,a.action,a.table_name,a.record_id,a.ip_address,a.request_id,a.created_at,COALESCE(u.name,'SYSTEM') AS user_name,COUNT(*) OVER() AS table_total FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE (u.name LIKE ? ESCAPE '!' OR a.table_name LIKE ? ESCAPE '!' OR a.record_id LIKE ? ESCAPE '!') AND (?='' OR a.action=?) AND (?='' OR a.table_name=?) ORDER BY ${sort} ${query.direction.toUpperCase()},a.id DESC LIMIT ${params.has('export')?10001:query.limit} OFFSET ${params.has('export')?0:query.offset}`,[query.pattern,query.pattern,query.pattern,filters.action,filters.action,filters.table_name,filters.table_name]);
    const columns=[['id','ID'],['user_name','User'],['actor_type','Pelaku'],['action','Tindakan'],['table_name','Tabel'],['record_id','Record'],['ip_address','IP'],['request_id','Request'],['created_at','Tanggal']].map(([key,label])=>({key,label}));
    const exported=await tableExport(params,rows,columns,config.title);if(exported)return exported;
    if(has('view'))columns.push({label:'Aksi',html:row=>tableRowActions([{label:'Detail',href:`${base}/${row.id}/view`}])});
    return {status:200,title:config.title,body:`<section>${renderTable({base,query,rows,columns,title:config.title,searchLabel:'Cari user / tabel / record',emptyText:'Tidak ada log.',sortOptions:[{value:'id',label:'ID'},{value:'created_at',label:'Tanggal'},{value:'user_name',label:'User'}],filters:definitions.map(f=>({...f,value:filters[f.name]})),exportable:true})}</section>`};
   }
   const [roles]=await c.execute("SELECT id,name FROM roles WHERE guard_name='web' ORDER BY name");
   if(action==='list') {
    const query=tableQuery(params,{sorts:resource==='users'?['name','email','nomor_kk','created_at','updated_at']:['name','created_at','updated_at'],defaultSort:'created_at'});if(query&&!params.has('direction'))query.direction='desc';
    const definitions=resource==='users'?[{name:'role',label:'Peran',options:roles.map(row=>({value:String(row.id),label:row.name}))}]:[];
    const filters=tableFilters(params,definitions);if(!query||!filters)return message(422,'Pencarian, filter atau halaman tidak valid.');
    const where=resource==='users'?`(u.name LIKE ? ESCAPE '!' OR u.email LIKE ? ESCAPE '!' OR u.nomor_kk LIKE ? ESCAPE '!')${filters.role?' AND EXISTS (SELECT 1 FROM model_has_roles m JOIN roles r ON r.id=m.role_id WHERE m.model_id=u.id AND m.model_type=? AND r.guard_name=\'web\' AND r.id=?)':''}`:"u.guard_name='web' AND u.name LIKE ? ESCAPE '!'";
    const args=resource==='users'?[query.pattern,query.pattern,query.pattern,...(filters.role?[modelType,filters.role]:[])]:[query.pattern];
    const [rows]=await c.execute(`SELECT u.id,u.name,u.created_at,u.updated_at${resource==='users'?',u.email,u.nomor_kk':',u.guard_name'},COUNT(*) OVER() AS table_total FROM ${resource} u WHERE ${where} ORDER BY u.\`${query.sort}\` ${query.direction.toUpperCase()},u.id DESC LIMIT ${params.has('export')?10001:query.limit} OFFSET ${params.has('export')?0:query.offset}`,args);
    if(resource==='users'&&rows.length) {
     const [assignments]=await c.execute(`SELECT m.model_id,r.name FROM model_has_roles m JOIN roles r ON r.id=m.role_id WHERE m.model_type=? AND m.model_id IN (${rows.map(()=>'?').join(',')}) AND r.guard_name='web' ORDER BY r.name`,[modelType,...rows.map(row=>row.id)]);
     for(const row of rows)row.roles=assignments.filter(item=>String(item.model_id)===String(row.id)).map(item=>item.name).join(', ');
    }
    const columns=(resource==='users'?[['name','Nama'],['email','Email'],['nomor_kk','Nomor KK'],['roles','Peran']]:[['name','Nama Peran'],['guard_name','Guard']]).concat([['created_at','Dibuat'],['updated_at','Diperbarui']]).map(([key,label])=>({key,label}));
    const exported=await tableExport(params,rows,columns,config.title);if(exported)return exported;
    columns.push({label:'Aksi',html:row=>tableRowActions([...(has('update')?[{label:'Edit',href:`${base}/${row.id}/edit`}]:[]),...(resource==='roles'&&has('view')?[{label:'Detail',href:`${base}/${row.id}/view`}]:[]),...(resource==='roles'&&has('delete')?[{label:'Hapus',href:`${base}/${row.id}/delete`}]:[])])});
    const actions=[...(has('delete_any')?[{label:'Hapus yang dipilih',action:base+'/delete'}]:[]),...(resource==='users'&&has('update')?[{label:'Ubah peran',action:base+'/bulk-role'}]:[])];
    return {status:200,title:config.title,body:`<section>${has('create')?`<p class="table-create"><a href="${base}/create">Tambah ${config.title}</a></p>`:''}${renderTable({base,query,rows,columns,title:config.title,searchLabel:resource==='users'?'Cari nama / email / KK':'Cari peran',emptyText:'Tidak ada data.',sortOptions:query? (resource==='users'?['name','email','nomor_kk','created_at','updated_at']:['name','created_at','updated_at']).map(value=>({value,label:columns.find(col=>col.key===value)?.label || value})):[],filters:definitions.map(f=>({...f,value:filters[f.name]})),exportable:true,bulk:actions.length?{action:actions[0].action,actions,csrf,rowLabel:row=>row.name,confirm:'Lanjutkan aksi pada data yang dipilih?'}:null})}</section>`};
   }
   if(['bulkDelete','delete','bulk-role'].includes(action)) {
    const {role_id,...selection}=data || {};
    const ids=action==='delete'?[id]:selectedTableIds(selection);
    if(action==='delete'&&!data)return {status:200,title:'Hapus Peran',body:`<section><form method="post" action="${base}/${id}/delete">${csrfInput(csrf)}<p>Hapus peran ini?</p><input type="hidden" name="confirm" value="HAPUS"><button>Ya, hapus</button> <a href="${base}">Batal</a></form></section>`};
    if(!ids || (action==='delete'&&data.confirm!=='HAPUS'))return message(422,'Pilih 1–100 data dan konfirmasikan tindakan.');
    if(action==='bulk-role'&&role_id===undefined)return {status:200,title:'Ubah Peran',body:`<section class="status-note-form"><form method="post" action="${base}/bulk-role">${csrfInput(csrf)}${ids.map(value=>`<input type="hidden" name="id_${value}" value="1">`).join('')}<label class="field">Peran<select name="role_id" required>${roles.map(role=>`<option value="${role.id}">${esc(role.name)}</option>`).join('')}</select></label><button>Simpan peran</button> <a href="${base}">Batal</a></form></section>`};
    if(action==='bulk-role'&&!roles.some(row=>String(row.id)===role_id))return message(422,'Peran tidak valid.');
    await c.beginTransaction();transaction=true;
    const placeholder=ids.map(()=>'?').join(',');
    const [locked]=await c.execute(`SELECT id FROM ${resource} WHERE id IN (${placeholder})${resource==='roles'?" AND guard_name='web'":''} ORDER BY id FOR UPDATE`,ids);
    if(locked.length!==ids.length)return message(404,'Sebagian data tidak ditemukan.');
    if(resource==='users') {
     if(action==='bulkDelete'&&ids.includes(String(user.id)))return message(422,'Akun aktif tidak dapat dihapus melalui aksi massal.');
     if(action==='bulk-role') {
      const [available]=await c.execute("SELECT id FROM roles WHERE id=? AND guard_name='web' FOR SHARE",[role_id]);if(!available.length)return message(422,'Peran tidak lagi tersedia.');
      await c.execute(`DELETE FROM model_has_roles WHERE model_type=? AND model_id IN (${placeholder}) AND role_id IN (SELECT id FROM roles WHERE guard_name='web')`,[modelType,...ids]);
      for(const value of ids)await c.execute('INSERT INTO model_has_roles (role_id,model_type,model_id) VALUES (?,?,?)',[role_id,modelType,value]);
     } else {
      for(const [table,key] of [['santris','user_id'],['santris','pengampu_tahfizh_id'],['artikels','penulis_id']]) {
       const [related]=await c.execute(`SELECT id FROM ${table} WHERE \`${key}\` IN (${placeholder}) LIMIT 1`,ids);if(related.length)return message(422,'Akun masih terkait santri/artikel. Pindahkan relasinya sebelum menghapus.');
      }
      for(const table of ['model_has_roles','model_has_permissions'])await c.execute(`DELETE FROM ${table} WHERE model_type=? AND model_id IN (${placeholder})`,[modelType,...ids]);
      for(const table of ['node_auth_sessions','node_auth_resets','sessions'])await c.execute(`DELETE FROM ${table} WHERE user_id IN (${placeholder})`,ids);
      await c.execute(`DELETE FROM users WHERE id IN (${placeholder})`,ids);
     }
    } else {
     const [related]=await c.execute(`SELECT model_id FROM model_has_roles WHERE role_id IN (${placeholder}) LIMIT 1`,ids);
     if(related.length)return message(422,'Peran masih dipakai akun. Pindahkan penugasannya sebelum menghapus.');
     await c.execute(`DELETE FROM role_has_permissions WHERE role_id IN (${placeholder})`,ids);
     await c.execute(`DELETE FROM roles WHERE id IN (${placeholder}) AND guard_name='web'`,ids);
    }
    await invalidate(c);await c.commit();transaction=false;return {status:303};
   }
   let row={},assigned=[];
   if(data){await c.beginTransaction();transaction=true;}
   if(action!=='create') {
    const [rows]=await c.execute(`SELECT * FROM ${resource} WHERE id=?${resource==='roles'?" AND guard_name='web'":''}${transaction?' FOR UPDATE':''}`,[id]);
    if(!rows.length)return message(404,'Data tidak ditemukan.');row=rows[0];
   }
   const [permissions]=resource==='roles'?await c.execute("SELECT id,name FROM permissions WHERE guard_name='web' ORDER BY name"):[[]];
   if(action!=='create') {
    const [links]=await c.execute(resource==='users'?"SELECT role_id AS id FROM model_has_roles WHERE model_id=? AND model_type=?":"SELECT permission_id AS id FROM role_has_permissions WHERE role_id=?",resource==='users'?[id,modelType]:[id]);assigned=links.map(link=>String(link.id));
   }
   if(action==='view')return {status:200,title:config.title,body:`<section><h2>${esc(row.name)}</h2><p>Guard: web</p><ul>${permissions.filter(p=>assigned.includes(String(p.id))).map(p=>`<li>${esc(p.name)}</li>`).join('')}</ul><a href="${base}">Kembali</a></section>`};
   const form=(errors=[],values=data || row)=>({status:errors.length?422:200,title:(action==='create'?'Tambah ':'Edit ')+config.title,body:`<section class="status-note-form"><form method="post" action="${base}/${action==='create'?'create':id+'/edit'}">${csrfInput(csrf)}${errors.length?`<div role="alert">${errors.map(error=>`<p>${esc(error)}</p>`).join('')}</div>`:''}${input('name',resource==='users'?'Nama':'Nama Peran',values.name,'required')}${resource==='users'?`${input('email','Email',values.email,'type="email" required')}${input('nomor_kk','Nomor KK',values.nomor_kk || '','maxlength="16"')}<label class="field">Password ${action==='edit'?'(kosongkan bila tidak diubah)':''}<input name="password" type="password" autocomplete="new-password" ${action==='create'?'required':''}></label><fieldset><legend>Peran (guard web)</legend>${roles.map(role=>`<label><input type="checkbox" name="role_${role.id}" value="1" ${(data?data['role_'+role.id]==='1':assigned.includes(String(role.id)))?'checked':''}>${esc(role.name)}</label>`).join('')}</fieldset>`:`<p>Guard: web</p><fieldset><legend>Permission</legend>${permissions.map(permission=>`<label><input type="checkbox" name="perm_${permission.id}" value="1" ${(data?data['perm_'+permission.id]==='1':assigned.includes(String(permission.id)))?'checked':''}>${esc(permission.name)}</label>`).join('')}</fieldset>`}<button>Simpan</button> <a href="${base}">Batal</a></form></section>`});
   if(!data)return form();
   const errors=[],name=String(data.name || '').trim();if(!name||Array.from(name).length>255)errors.push('Nama wajib diisi, maksimal 255 karakter.');
   const chosen=checkboxIds(data,resource==='users'?'role_':'perm_'),choices=resource==='users'?roles:permissions;
   if(!chosen||chosen.some(value=>!choices.some(choice=>String(choice.id)===value)))errors.push('Pilihan peran/permission tidak valid.');
   if(resource==='users') {
    if(typeof data.email!=='string'||data.email.length>255||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))errors.push('Email tidak valid.');
    if(typeof data.nomor_kk!=='string'||data.nomor_kk.trim().length>16)errors.push('Nomor KK maksimal 16 karakter.');
    if((action==='create'||data.password)&& (typeof data.password!=='string'||Array.from(data.password).length<8||Buffer.byteLength(data.password)>72))errors.push('Password minimal 8 karakter, maksimal 72 byte.');
   }
   if(errors.length)return form(errors);
   // Lock selected relationships after validation so concurrent deletion cannot drop assignments.
   for(const value of chosen){const [available]=await c.execute(`SELECT id FROM ${resource==='users'?'roles':'permissions'} WHERE id=? AND guard_name='web' FOR SHARE`,[value]);if(!available.length)return form(['Pilihan tidak lagi tersedia. Muat ulang formulir.']);}
   let recordId=id;
   try {
    if(resource==='users') {
     const password=data.password?await bcrypt.hash(data.password,12):row.password;
     if(action==='create'){const [created]=await c.execute('INSERT INTO users (name,email,nomor_kk,password,created_at,updated_at) VALUES (?,?,?,?,NOW(),NOW())',[name,data.email.trim(),data.nomor_kk.trim() || null,password]);recordId=String(created.insertId);}
     else {
      await c.execute('UPDATE users SET name=?,email=?,nomor_kk=?,password=?,remember_token=?,updated_at=NOW() WHERE id=?',[name,data.email.trim(),data.nomor_kk.trim() || null,password,data.password?randomBytes(30).toString('hex'):row.remember_token,id]);
      if(data.password){for(const table of ['node_auth_sessions','node_auth_resets','sessions'])await c.execute(`DELETE FROM ${table} WHERE user_id=?`,[id]);}
     }
     await c.execute("DELETE FROM model_has_roles WHERE model_id=? AND model_type=? AND role_id IN (SELECT id FROM roles WHERE guard_name='web')",[recordId,modelType]);
     for(const value of chosen)await c.execute('INSERT INTO model_has_roles (role_id,model_type,model_id) VALUES (?,?,?)',[value,modelType,recordId]);
    } else {
     if(action==='create'){const [created]=await c.execute("INSERT INTO roles (name,guard_name,created_at,updated_at) VALUES (?,'web',NOW(),NOW())",[name]);recordId=String(created.insertId);}
     else await c.execute("UPDATE roles SET name=?,updated_at=NOW() WHERE id=? AND guard_name='web'",[name,id]);
     await c.execute('DELETE FROM role_has_permissions WHERE role_id=?',[recordId]);
     for(const value of chosen)await c.execute('INSERT INTO role_has_permissions (permission_id,role_id) VALUES (?,?)',[value,recordId]);
    }
   }catch(error){if(error.code==='ER_DUP_ENTRY')return form(['Email, nomor KK atau nama peran sudah digunakan.']);throw error;}
   await invalidate(c);await c.commit();transaction=false;return {status:303};
  }finally{if(transaction)await c.rollback();c.release();}
 };
}
export const adminResources=createAdminResources();
