import { pool } from './db.js';
import { esc } from './dashboard-shell.js';
import { selectedTableIds,tableExcel } from './dashboard-table.js';
import { slots,verificationFilters } from './cbt-resources.js';
import { importQuestions } from './cbt-imports.js';
import { validateMaster } from './dashboard-masters.js';

export function cbtAdminRoute(path){const match=path.match(/^\/dashboard\/(cbt-soal\/(json|bulk-verify)|cbt-ujian\/([1-9]\d{0,14})\/(assign|generate|results)|cbt-peserta\/([1-9]\d{0,14})\/(reset|grade))$/);return match?{resource:match[2]?'cbt-soal':match[3]?'cbt-ujian':'cbt-peserta',action:match[2] || match[4] || match[6],id:match[3] || match[5]}:null;}
export function createCbtAdmin(db=pool){return async function cbtAdmin({resource,action,id,user,access,csrf='',data}){
 const base='/dashboard/'+resource,message=(status,text)=>({status,title:'CBT',body:`<section><p>${esc(text)}</p><a href="${base}">Kembali</a></section>`});
 const permission=action==='results'?'view_any_c::b::t::peserta':action==='json'?'create_c::b::t::soal':action==='assign'?'create_c::b::t::peserta':resource==='cbt-ujian'?'update_c::b::t::ujian':resource==='cbt-soal'?'update_c::b::t::soal':'update_c::b::t::peserta';
 if(!access.permissions.includes(permission))return message(403,'Anda tidak memiliki izin untuk tindakan ini.');
 const form=(title,body)=>({status:200,title,body:`<section class="status-note-form"><form method="post"><input type="hidden" name="_csrf" value="${esc(csrf)}">${body}<button>Simpan</button> <a href="${base}">Batal</a></form></section>`});
 const c=await db.getConnection();let transaction=false;
 try {
  if(action==='json') {
   if(data)return await importQuestions({c,data,user,validate:validateMaster,message,json:true});
   return form('Input Soal JSON',`<details><summary>Prompt buat soal</summary><textarea readonly rows="7">Generate soal CBT sebagai JSON array. Setiap object memuat tema, pertanyaan, tipe_soal (pilihan_ganda/essay/benar_salah), jawaban_benar, jawaban_salah_1 sampai jawaban_salah_6 (opsional), bobot (integer minimal 1) dan aktif (boolean). Jangan gunakan Markdown.</textarea></details><details><summary>Prompt konversi teks soal</summary><textarea readonly rows="7">Ubah teks soal berikut menjadi JSON array dengan field tema, pertanyaan, tipe_soal, jawaban_benar, jawaban_salah_1..jawaban_salah_6, bobot dan aktif. Pertahankan isi soal dan tandai jawaban yang benar. Gunakan tema yang ditentukan pengguna. Keluarkan JSON valid tanpa Markdown.</textarea></details><label class="field">JSON Soal<textarea name="json_data" rows="12" required></textarea></label>`);
  }
  if(action==='bulk-verify') {
   const ids=selectedTableIds(data);if(!ids)return message(422,'Pilih 1–100 soal.');await c.beginTransaction();transaction=true;
   const [rows]=await c.execute(`SELECT id FROM cbt_soal WHERE id IN (${ids.map(()=>'?').join(',')}) ORDER BY id FOR UPDATE`,ids);if(rows.length!==ids.length)return message(404,'Sebagian soal tidak ditemukan.');
   await c.execute(`UPDATE cbt_soal SET verifikasi='verified',updated_at=NOW() WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);
   await c.commit();transaction=false;return {status:303,redirect:base};
  }
  if(data){await c.beginTransaction();transaction=true;}
  const table=resource==='cbt-ujian'?'cbt_ujian':'cbt_peserta';
  const [rows]=await c.execute(`SELECT * FROM ${table} WHERE id=?${transaction?' FOR UPDATE':''}`,[id]);if(!rows.length)return message(404,'Data tidak ditemukan.');const row=rows[0];
  if(action==='results'){const [results]=await c.execute('SELECT s.nama,p.nomor_pendaftaran,p.nilai,p.nilai_essay,p.nilai_total FROM cbt_peserta p LEFT JOIN santris s ON s.nomor_pendaftaran=p.nomor_pendaftaran WHERE p.ujian_id=? ORDER BY s.nama,p.id LIMIT 10001',[id]);if(results.length>10000)return message(422,'Hasil melebihi 10.000 baris.');return {status:200,xlsx:await tableExcel(results,[['nama','Nama'],['nomor_pendaftaran','Nomor Pendaftaran'],['nilai','Nilai PG'],['nilai_essay','Nilai Essay'],['nilai_total','Nilai Total']].map(([key,label])=>({key,label})))};}
  if(action==='reset') {
   if(!data)return form('Reset Peserta',`<p>Hapus jawaban, waktu dan nilai peserta ${esc(row.nomor_pendaftaran)}?</p><input type="hidden" name="confirm" value="RESET">`);
   if(data.confirm!=='RESET')return message(422,'Konfirmasi reset tidak valid.');
   await c.execute(`UPDATE cbt_peserta SET ${slots.map(i=>'j'+i+'=NULL').join(',')},status='pending',started_at=NULL,finished_at=NULL,nilai=NULL,nilai_essay=NULL,nilai_total=NULL,updated_at=NOW() WHERE id=?`,[id]);
   await c.execute('DELETE FROM node_cbt_attempts WHERE peserta_id=?',[id]);
  }else if(action==='grade') {
   if(row.status!=='finished')return message(422,'Nilai essay hanya dapat diubah setelah ujian selesai.');
   if(!data)return form('Nilai Essay',`<p>${esc(row.nomor_pendaftaran)} · Nilai PG ${esc(row.nilai)}</p>${slots.filter(i=>i>100&&row['j'+i]).map(i=>`<p>Jawaban ${i}: ${esc(row['j'+i])}</p>`).join('')}<label class="field">Nilai Essay (0–100, kosongkan jika belum dinilai)<input name="nilai_essay" type="number" min="0" max="100" step="1" value="${esc(row.nilai_essay ?? '')}"></label>`);
   const value=data.nilai_essay;if(typeof value!=='string'||(value!==''&&(!/^\d{1,3}$/.test(value)||Number(value)>100)))return message(422,'Nilai essay harus bilangan bulat 0–100.');
   const essay=value===''?null:Number(value),total=essay===null?row.nilai:row.nilai===null?null:Math.round((Number(row.nilai)+essay)/2);
   await c.execute('UPDATE cbt_peserta SET nilai_essay=?,nilai_total=?,updated_at=NOW() WHERE id=?',[essay,total,id]);
  }else if(action==='assign') {
   if(!data)return form('Tambah Peserta dari Santri','<label class="field">Prefix nomor pendaftaran<input name="prefix" maxlength="50" required></label>');
   const prefix=String(data.prefix || '').trim();if(!prefix||prefix.length>50)return message(422,'Prefix wajib diisi, maksimal 50 karakter.');
   const [students]=await c.execute("SELECT nomor_pendaftaran FROM santris WHERE nomor_pendaftaran LIKE ? ESCAPE '!' ORDER BY id LIMIT 1001",[prefix.replace(/[!%_]/g,'!$&')+'%']);if(students.length>1000)return message(422,'Maksimal 1.000 santri per penambahan; persempit prefix.');
   for(const student of students){const [existing]=await c.execute('SELECT id FROM cbt_peserta WHERE ujian_id=? AND nomor_pendaftaran=? FOR UPDATE',[id,student.nomor_pendaftaran]);if(!existing.length)await c.execute("INSERT INTO cbt_peserta (ujian_id,nomor_pendaftaran,status,created_at,updated_at) VALUES (?,?,'pending',NOW(),NOW())",[id,student.nomor_pendaftaran]);}
  }else if(action==='generate') {
   const [themes]=await c.execute('SELECT id,nama_tema FROM cbt_tema_soal ORDER BY nama_tema');
   if(!data)return form('Generate Soal',`<label class="field">Filter verifikasi<select name="verification">${verificationFilters.map(value=>`<option>${value}</option>`).join('')}</select></label><label><input type="checkbox" name="shuffle" value="1" checked> Acak soal</label>${themes.map(theme=>`<fieldset><legend>${esc(theme.nama_tema)}</legend><label>Jumlah PG<input name="pg_${theme.id}" type="number" min="0" max="100" value="0"></label><label>Jumlah Essay<input name="essay_${theme.id}" type="number" min="0" max="20" value="0"></label></fieldset>`).join('')}`);
   if(!verificationFilters.includes(data.verification))return message(422,'Filter tidak valid.');const chosen={};let pg=1,essay=101;
   for(const theme of themes)for(const type of ['pg','essay']) {
    const value=data[type+'_'+theme.id] || '0';if(!/^\d{1,3}$/.test(value)||Number(value)>(type==='pg'?100:20))return message(422,'Jumlah soal tidak valid.');const count=Number(value);if(!count)continue;
    const verification=data.verification==='all'?'1=1':data.verification==='verified_plus_pending'?"verifikasi IN ('verified','pending')":"verifikasi='verified'";
    const [bank]=await c.execute(`SELECT id FROM cbt_soal WHERE tema_soal_id=? AND aktif=1 AND tipe_soal ${type==='pg'?"IN ('pilihan_ganda','benar_salah')":"='essay'"} AND ${verification} ORDER BY ${data.shuffle==='1'?'RAND()':'id'} LIMIT ${count} FOR SHARE`,[theme.id]);
    if(bank.length!==count)return message(422,'Jumlah soal tersedia tidak mencukupi distribusi.');
    for(const question of bank){if(type==='pg'){if(pg>100)return message(422,'Maksimal 100 soal PG.');chosen['q'+pg++]=question.id;}else{if(essay>120)return message(422,'Maksimal 20 soal essay.');chosen['q'+essay++]=question.id;}}
   }
   if(!Object.keys(chosen).length)return message(422,'Pilih setidaknya satu soal.');
   await c.execute(`UPDATE cbt_ujian SET ${slots.map(i=>'q'+i+'=?').join(',')},updated_at=NOW() WHERE id=?`,[...slots.map(i=>chosen['q'+i] || null),id]);
  }else return message(404,'Tindakan tidak ditemukan.');
  await c.commit();transaction=false;return {status:303,redirect:resource==='cbt-ujian'?'/dashboard/cbt-ujian/'+id+'/edit':base};
 }finally{if(transaction)await c.rollback();c.release();}
};}
export const cbtAdmin=createCbtAdmin();
