import QRCode from 'qrcode';
import { pool } from './db.js';
import { esc } from './dashboard-shell.js';
import { diplomaDefinitions,diplomaSummary } from './diploma-resources.js';
import { renderDiploma,diplomaHijri } from './diploma-print.js';
import { selectedTableIds,tableExcel } from './dashboard-table.js';

export function diplomaRoute(path){const match=path.match(/^\/dashboard\/(ijazah|ijazah-darul-ilmi|ijazah-mahad-aly)\/(recalculate|bulk-export|([1-9]\d{0,14})\/(print|transcript|qr))$/);return match?{resource:match[1],action:match[3]?match[4]:match[2],id:match[3]}:null;}
export function createDiplomas(db=pool,{hijri=diplomaHijri}={}){return async function diplomas({resource,action,id,access,csrf='',data}){
 const config=diplomaDefinitions[resource],base='/dashboard/'+resource,message=(status,text)=>({status,title:'Ijazah',body:`<section><p>${esc(text)}</p><a href="${base}">Kembali</a></section>`});
 if(!config)return message(404,'Modul tidak ditemukan.');
 const permission=(action==='recalculate'?'update':'view_any')+'_'+resource.replaceAll('-','::');if(!access.permissions.includes(permission))return message(403,'Anda tidak memiliki izin untuk tindakan ini.');
 const c=await db.getConnection();let transaction=false;
 try{
  if(action==='recalculate'){
   if(!data)return {status:200,title:'Perbarui Predikat',body:`<section><form method="post"><input type="hidden" name="_csrf" value="${esc(csrf)}"><input type="hidden" name="confirm" value="HITUNG"><p>Perbarui rata-rata/IPK dan predikat seluruh data modul ini?</p><button>Ya, perbarui</button> <a href="${base}">Batal</a></form></section>`};
   if(data.confirm!=='HITUNG')return message(422,'Konfirmasi perhitungan tidak valid.');
   await c.beginTransaction();transaction=true;
   const [rows]=await c.execute(`SELECT * FROM ${config.table} ORDER BY id FOR UPDATE`);
   for(const row of rows){const summary=diplomaSummary(resource,row);await c.execute(`UPDATE ${config.table} SET ${config.hours?'temp_ipk':'temp_rata_rata'}=?,temp_predikat=?,updated_at=NOW() WHERE id=?`,[config.hours?summary.ipk:summary.average,summary.predicate,row.id]);}
   await c.commit();transaction=false;return {status:303,redirect:base};
  }
  if(action==='bulk-export'){
   const ids=selectedTableIds(data);if(!ids)return message(422,'Pilih 1–100 ijazah.');
   const [rows]=await c.execute(`SELECT d.*,s.nama,s.nama_arab,s.nis,s.jenis_kelamin,e.nama AS event_name FROM ${config.table} d JOIN santris s ON s.id=d.santri_id JOIN event_mahads e ON e.id=d.event_id WHERE d.id IN (${ids.map(()=>'?').join(',')}) ORDER BY s.nama,d.id`,ids);
   if(rows.length!==ids.length)return message(404,'Sebagian ijazah tidak ditemukan.');
   const columns=[['nama','Nama Santri'],['nama_arab','Nama Arab'],['nis','NIS'],['jenis_kelamin','Jenis Kelamin'],['event_name','Event'],['nomor_ijazah','Nomor Ijazah'],...config.grades.map(key=>[key,config.fields.find(field=>field.key===key).label]),[config.hours?'temp_ipk':'temp_rata_rata',config.hours?'IPK':'Rata-rata'],['temp_predikat','Predikat']].map(([key,label])=>({key,label}));
   return {status:200,xlsx:await tableExcel(rows,columns)};
  }
  const [records]=await c.execute(`SELECT * FROM ${config.table} WHERE id=?`,[id]);if(!records.length)return message(404,'Ijazah tidak ditemukan.');const row=records[0];
  if(action==='qr')return {status:200,content:await QRCode.toBuffer('https://www.mahadalyusro.sch.id/mathaapp/ijazah/cek/'+encodeURIComponent(row.nomor_ijazah),{errorCorrectionLevel:'H',width:512}),type:'image/png',attachment:true,filename:'qr-'+row.nomor_ijazah+'.png'};
  const [students]=await c.execute('SELECT s.*, (SELECT path FROM foto_santris WHERE santri_id=s.id ORDER BY id LIMIT 1) AS foto FROM santris s WHERE s.id=?',[row.santri_id]),[events]=await c.execute('SELECT * FROM event_mahads WHERE id=?',[row.event_id]);
  if(!students.length||!events.length)return message(422,'Relasi santri/event tidak tersedia.');
  const [cities]=await c.execute('SELECT nama_arab FROM nama_kota WHERE LOWER(nama_latin)=? ORDER BY id LIMIT 1',[String(students[0].tempat_lahir || '').toLowerCase()]);
  return await renderDiploma(resource,row,students[0],events[0],{kind:action,hijri,cityArabic:cities[0]?.nama_arab || students[0].tempat_lahir});
 }finally{if(transaction)await c.rollback();c.release();}
};}
export const diplomas=createDiplomas();
