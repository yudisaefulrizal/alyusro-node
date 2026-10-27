import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { cbtResources } from './cbt-resources.js';
export const questionHeaders=['tema','pertanyaan','tipe_soal','jawaban_benar','salah_1','salah_2','salah_3','salah_4','salah_5','salah_6','bobot','aktif'];

export async function importQuestions({c,data,user,validate,message,json=false}) {
 const invalid=text=>message(422,text);let entries;
 if(!user?.id)return message(403,'Akun pembuat tidak valid.');
 if(json) {
  if(typeof data?.json_data!=='string'||Buffer.byteLength(data.json_data)>1048576)return invalid('JSON maksimal 1 MB.');
  try{entries=JSON.parse(data.json_data);}catch{return invalid('JSON tidak dapat dibaca.');}
 } else {
  if(!Buffer.isBuffer(data?.workbook)||!data.workbook.length||data.workbook.length>1048576)return invalid('Pilih .xlsx maksimal 1 MB.');
  try {
   const zip=await JSZip.loadAsync(data.workbook),items=Object.values(zip.files);
   if(items.length>200||items.reduce((sum,file)=>sum+(file._data?.uncompressedSize || 0),0)>8388608)return invalid('Isi workbook terlalu besar.');
   const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(data.workbook);if(workbook.worksheets.length!==1)return invalid('Workbook harus memiliki satu lembar.');
   const sheet=workbook.worksheets[0];if(sheet.rowCount>1001||sheet.columnCount>12)return invalid('Maksimal 1.000 baris dan 12 kolom.');
   if(questionHeaders.some((key,i)=>String(sheet.getRow(1).getCell(i+1).value || '').trim().toLowerCase()!==key))return invalid('Header harus sesuai template.');
   entries=[];
   for(let i=2;i<=sheet.rowCount;i++){
    const values=questionHeaders.map((key,n)=>sheet.getRow(i).getCell(n+1).value);
    if(values.every(value=>value===null||value===''))continue;
    if(values.some(value=>value!==null&&!['string','number','boolean'].includes(typeof value)))return invalid(`Baris ${i}: rumus/objek tidak diizinkan.`);
    const row=Object.fromEntries(questionHeaders.map((key,n)=>[key,values[n]]));for(let n=1;n<=6;n++)row['jawaban_salah_'+n]=row['salah_'+n];entries.push(row);
   }
  }catch{return invalid('Workbook .xlsx tidak dapat dibaca.');}
 }
 if(!Array.isArray(entries)||!entries.length||entries.length>1000)return invalid('Masukkan array 1–1.000 soal.');
 const records=[];
 for(let i=0;i<entries.length;i++) {
  const entry=entries[i];if(!entry||Array.isArray(entry)||typeof entry!=='object'||Object.values(entry).some(value=>value!==null&&!['string','number','boolean'].includes(typeof value)))return invalid(`Soal ${i+1} tidak valid.`);
  const theme=String(entry.tema ?? (json?'Umum':'')).trim();if(!theme||theme.length>255)return invalid(`Soal ${i+1}: tema wajib diisi, maksimal 255 karakter.`);
  if(entry.aktif!==undefined&&entry.aktif!==null&&entry.aktif!==''&&!['true','false','1','0','ya','tidak'].includes(String(entry.aktif).toLowerCase()))return invalid(`Soal ${i+1}: aktif harus true/false, 1/0 atau ya/tidak.`);
  const input={...entry,pertanyaan:String(entry.pertanyaan || '').trim().replace(/\s+/g,' '),tipe_soal:entry.tipe_soal || 'pilihan_ganda',bobot:String(entry.bobot===null||entry.bobot===undefined||entry.bobot===''?'1':entry.bobot),aktif:entry.aktif===undefined||entry.aktif===null||entry.aktif===''?'1':['true','1','ya'].includes(String(entry.aktif).toLowerCase())?'1':'0',verifikasi:'pending'};
  const checked=validate(cbtResources['cbt-soal'].fields.filter(field=>field.key!=='tema_soal_id'),input);
  if(checked.errors.length)return invalid(`Soal ${i+1}: ${checked.errors.join(' ')}`);records.push({theme,values:checked.values});
 }
 await c.beginTransaction();
 try {
  for(const record of records) {
   if(!json){const [duplicate]=await c.execute('SELECT id FROM cbt_soal WHERE LOWER(pertanyaan)=? LIMIT 1 FOR UPDATE',[record.values.pertanyaan.toLowerCase()]);if(duplicate.length)continue;}
   let [themes]=await c.execute('SELECT id FROM cbt_tema_soal WHERE nama_tema=? ORDER BY id LIMIT 1 FOR UPDATE',[record.theme]);
   if(!themes.length){const [created]=await c.execute('INSERT INTO cbt_tema_soal (nama_tema,created_at,updated_at) VALUES (?,NOW(),NOW())',[record.theme]);themes=[{id:created.insertId}];}
   const values={...record.values,tema_soal_id:themes[0].id,created_by:user.id},keys=Object.keys(values);
   await c.execute(`INSERT INTO cbt_soal (${keys.map(key=>'`'+key+'`').join(',')},created_at,updated_at) VALUES (${keys.map(()=>'?').join(',')},NOW(),NOW())`,Object.values(values));
  }
  await c.commit();return {status:303};
 }catch(error){await c.rollback();throw error;}
}
