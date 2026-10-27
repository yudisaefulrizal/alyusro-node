import { pool } from './db.js';
import { esc } from './dashboard-shell.js';
import { tableExcel,selectedTableIds } from './dashboard-table.js';
import studentFields from '../templates/santri-fields.json' with {type:'json'};
import { adminStudentFiles } from './wali-files.js';
import { renderStudentCard } from './student-card.js';
import { studentRoot } from './student-storage.js';

export function studentsAdminRoute(path) {
 const match=path.match(/^\/dashboard\/santri\/(bulk-export|bulk-class|bulk-status|([1-9]\d{0,14})\/(documents|card|status|berkas\/([a-z_]+)(?:\/(upload|delete))?))$/);
 return match?{action:match[2]?match[4]?'file':match[3]:match[1],id:match[2],field:match[4],fileAction:match[5] || 'read'}:null;
}
export function createStudentsAdmin(db=pool,root=studentRoot) {
 return async function students({access,user,action,id,csrf='',data}) {
  const base='/dashboard/santri',message=(status,text)=>({status,title:'Santri',body:`<section><p>${esc(text)}</p><a href="${base}">Kembali</a></section>`});
  const modifying=['bulk-class','bulk-status'].includes(action);
  if(!(action==='status'&&access.permissions.includes('view_any_santri::wali'))&&!access.permissions.includes((modifying?'update':'view_any')+'_santri'))return message(403,'Anda tidak memiliki izin untuk tindakan ini.');
  const c=await db.getConnection();let transaction=false;
  try {
   if(action==='status'){if(data)return message(405,'Gunakan GET.');const [rows]=await c.execute('SELECT id,status,no_kk FROM santris WHERE id=?',[id]);const row=rows[0];if(!row||(!access.permissions.includes('view_any_santri')&&(!user?.nomor_kk||String(row.no_kk)!==String(user.nomor_kk))))return message(404,'Santri tidak ditemukan.');return {status:200,json:{status:row.status}};}
   if(action==='card'||action==='documents') {
    const [rows]=await c.execute('SELECT s.*, (SELECT path FROM foto_santris WHERE santri_id=s.id ORDER BY id LIMIT 1) AS foto FROM santris s WHERE s.id=?',[id]);
    if(!rows.length)return message(404,'Santri tidak ditemukan.');const row=rows[0];
    if(action==='card')return await renderStudentCard(row,root);
    return {status:200,title:'Berkas '+row.nama,body:`<section class="wali-documents"><p>${esc(row.nama)}</p><div class="document-grid">${adminStudentFiles.map(([field,label])=>`<article class="document-card"><h2>${esc(label)}</h2>${row[field]?`<a href="${base}/${id}/berkas/${field}"><img class="document-thumb" src="${base}/${id}/berkas/${field}" alt="${esc(label)}"></a>`:'<p>Belum diunggah.</p>'}${access.permissions.includes('update_santri')?`<form method="post" action="${base}/${id}/berkas/${field}/upload" enctype="multipart/form-data"><input type="hidden" name="_csrf" value="${esc(csrf)}"><label>PNG/JPEG/WebP, maksimal 1 MB<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required></label><button>Simpan berkas</button></form>${row[field]?`<form method="post" action="${base}/${id}/berkas/${field}/delete" data-confirm="Hapus berkas ini?"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button>Hapus</button></form>`:''}`:''}</article>`).join('')}</div><a href="${base}">Kembali</a></section>`};
   }
   if(!['bulk-export','bulk-class','bulk-status'].includes(action))return message(404,'Halaman tidak ditemukan.');
   const field=action==='bulk-class'?'kelas_id':'status';
   const {[field]:value,...selection}=data || {},ids=selectedTableIds(selection);if(!ids)return message(422,'Pilih 1–100 santri yang valid.');
   const placeholders=ids.map(()=>'?').join(',');
   if(action==='bulk-export') {
    const [rows]=await c.execute(`SELECT * FROM santris WHERE id IN (${placeholders}) ORDER BY nama,id`,ids);
    if(rows.length!==ids.length)return message(404,'Sebagian santri tidak ditemukan.');
    return {status:200,xlsx:await tableExcel(rows,studentFields.map(field=>({key:field.key,label:field.label})))};
   }
   const choices=field==='status'?studentFields.find(field=>field.key==='status').options.map(value=>({id:value,label:value})):(await c.execute("SELECT k.id,CONCAT(k.nama_kelas,' - ',COALESCE(p.nama_program,'')) AS label FROM kelas k LEFT JOIN program_pendidikans p ON p.id=k.id_program_pendidikan ORDER BY label"))[0];
   if(value===undefined)return {status:200,title:field==='status'?'Ubah Status Santri':'Ubah Kelas Santri',body:`<section class="status-note-form"><form method="post" action="${base}/${action}"><input type="hidden" name="_csrf" value="${esc(csrf)}">${ids.map(id=>`<input type="hidden" name="id_${id}" value="1">`).join('')}<label class="field">${field==='status'?'Status':'Kelas'}<select name="${field}" required>${choices.map(choice=>`<option value="${esc(choice.id)}">${esc(choice.label)}</option>`).join('')}</select></label><button>Simpan</button> <a href="${base}">Batal</a></form></section>`};
   if(!choices.some(choice=>String(choice.id)===value))return message(422,'Pilihan tidak valid.');
   await c.beginTransaction();transaction=true;
   const [locked]=await c.execute(`SELECT id FROM santris WHERE id IN (${placeholders}) ORDER BY id FOR UPDATE`,ids);if(locked.length!==ids.length)return message(404,'Sebagian santri tidak ditemukan.');
   if(field==='kelas_id'){const [available]=await c.execute('SELECT id FROM kelas WHERE id=? FOR SHARE',[value]);if(!available.length)return message(422,'Kelas tidak lagi tersedia.');}
   await c.execute(`UPDATE santris SET \`${field}\`=?,updated_at=NOW() WHERE id IN (${placeholders})`,[value,...ids]);
   await c.commit();transaction=false;return {status:303};
  }finally{if(transaction)await c.rollback();c.release();}
 };
}
export const studentsAdmin=createStudentsAdmin();
