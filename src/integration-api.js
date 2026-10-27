import { timingSafeEqual,createHmac } from 'node:crypto';
import { basename,parse } from 'node:path';
import Busboy from 'busboy';
import ExcelJS from 'exceljs';
import { pool,setting } from './db.js';
import { runAudit } from './audit.js';
import { esc } from './dashboard-shell.js';
import { contentRoot,saveContentFile,readContentFile,removeNewContentFile } from './content-files.js';
import { tableExcel } from './dashboard-table.js';
import { convertNamesWorkbook } from './name-library.js';
import { renderStudentCard } from './student-card.js';
import { studentRoot } from './student-storage.js';
import { diplomaDefinitions } from './diploma-resources.js';
import exportColumns from '../templates/integration-export-columns.json' with {type:'json'};

const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length>0&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const fail=(message,status=422)=>Object.assign(new Error(message),{status});
async function body(req,{file=false,limit=1048576}={}) {
 let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>limit+131072)throw fail('Data terlalu besar.',413);chunks.push(chunk);}const bytes=Buffer.concat(chunks);
 if(req.headers['content-type']?.startsWith('application/json')){if(length>limit)throw fail('Data terlalu besar.',413);try{const data=JSON.parse(bytes);if(!data||typeof data!=='object')throw Error();return data;}catch{throw fail('JSON tidak valid.',400);}}
 if(file&&req.headers['content-type']?.startsWith('multipart/form-data'))return new Promise((resolve,reject)=>{
  let parser;try{parser=Busboy({headers:req.headers,limits:{files:1,fileSize:limit,fields:5,fieldSize:2048,parts:6}});}catch{return reject(fail('Formulir tidak valid.',400));}
  const data={};let invalid=false;
  parser.on('field',(name,value,info)=>{if(Object.hasOwn(data,name)||info.valueTruncated||!['nama'].includes(name))invalid=true;data[name]=value;});
  parser.on('file',(name,stream,info)=>{if(name!=='file')invalid=true;const chunks=[];stream.on('limit',()=>invalid=true);stream.on('data',chunk=>chunks.push(chunk));stream.on('end',()=>{data.upload=Buffer.concat(chunks);data.upload_name=info.filename;});});
  for(const event of ['filesLimit','fieldsLimit','partsLimit'])parser.on(event,()=>invalid=true);parser.on('error',()=>reject(fail('Formulir tidak valid.',400)));parser.on('close',()=>invalid?reject(fail('Berkas atau formulir tidak valid.')):resolve(data));parser.end(bytes);
 });
 throw fail('Gunakan JSON atau formulir multipart yang sesuai.',415);
}
export function createIntegrationApi(db=pool,{exportKey=setting('NODE_EXPORT_API_KEY'),documentKey=setting('NODE_DOCUMENT_API_KEY'),libraryKey=setting('NODE_LIBRARY_API_KEY'),signingKey=setting('NODE_FILE_SIGNING_KEY'),root=contentRoot,studentsRoot=studentRoot,now=()=>Math.floor(Date.now()/1000),origin=setting('NODE_AUTH_PUBLIC_URL') || 'http://127.0.0.1:8075'}={}) {
 const sign=(id,expires)=>createHmac('sha256',signingKey || '').update(`${id}:${expires}`).digest('hex');
 const link=(id,preview=false)=>{if(!signingKey)throw fail('Konfigurasi tautan berkas belum tersedia.',503);const expires=now()+3600;return `${origin}/api/dokumen/file/${id}?expires=${expires}&signature=${sign(id,expires)}${preview?'&preview=1':''}`;};
 return async function integration(req,res,path,params=new URLSearchParams()) {
  const library=path.match(/^\/api\/perpustakaan-nama(?:\/([^/]+))?$/),batch=path.match(/^\/api\/konversi-nama-latin-to-arabic-batch(-excel)?$/),card=path.match(/^\/api\/cetak\/kartu-santri\/nis\/([^/]+)$/),download=path.match(/^\/api\/dokumen\/file\/([1-9]\d{0,14})$/),verification=path.match(/^\/mathaapp\/ijazah\/cek\/([^/]+)$/);
  const exporting=['/api/export/calon-santri','/api/export/calon-santri/n8n'].includes(path),documents=['/api/dokumen/upload','/api/dokumen/search'].includes(path);
  if(!library&&!batch&&!card&&!download&&!verification&&!exporting&&!documents)return false;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,value,type='application/json')=>{res.writeHead(status,{'Content-Type':type+(type==='application/json'?'; charset=utf-8':'')});res.end(req.method==='HEAD'?undefined:type.startsWith('application/json')?JSON.stringify(value):value);return true;};
  const file=result=>{res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");res.setHeader('Content-Disposition',`${result.attachment===false?'inline':'attachment'}; filename="${String(result.filename || 'dokumen').replace(/[^a-zA-Z0-9._-]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(result.filename || 'dokumen')}`);return send(200,result.content,result.type);};
  return runAudit({enabled:true,ip:req.socket.remoteAddress,userAgent:String(req.headers['user-agent'] || '')},async()=>{
   let c,newFile,saved=false;
   try {
    if(verification){
     if(!['GET','HEAD'].includes(req.method))return send(405,{message:'Metode tidak tersedia.'});const number=decodeURIComponent(verification[1]);if(!/^[A-Z0-9-]{3,255}$/.test(number))return send(404,{valid:false});c=await db.getConnection();
     let valid=false;for(const config of Object.values(diplomaDefinitions)){const [rows]=await c.execute(`SELECT id FROM ${config.table} WHERE nomor_ijazah=? AND verifikasi_kepala_sekolah=1 AND verifikasi_mudir=1 LIMIT 1`,[number]);if(rows.length){valid=true;break;}}
     return send(valid?200:404,`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifikasi Ijazah</title></head><body><h1>${valid?'Ijazah terverifikasi':'Ijazah belum terverifikasi'}</h1><p>${esc(number)}</p><p>Ma’had Tahfizh Al Yusro</p></body></html>`,'text/html; charset=utf-8');
    }
    if(download){
     if(!['GET','HEAD'].includes(req.method))return send(405,{message:'Metode tidak tersedia.'});const expires=params.get('expires') || '',signature=params.get('signature') || '';
     if(!signingKey||!/^\d{10}$/.test(expires)||Number(expires)<=now()||Number(expires)>now()+3600||!equal(signature,sign(download[1],expires)))return send(403,{message:'Tautan tidak valid atau kedaluwarsa.'});
     c=await db.getConnection();const [rows]=await c.execute('SELECT nama,path FROM dokumens WHERE id=?',[download[1]]);const stored=rows[0]&&await readContentFile({directory:'dokumen'},rows[0].path,root);if(!stored)return send(404,{message:'Berkas tidak ditemukan.'});return file({...stored,filename:rows[0].nama+parse(rows[0].path).ext,attachment:params.get('preview')!=='1'});
    }
    const key=library||batch?libraryKey:exporting||card?exportKey:documentKey;
    if(!key)return send(503,{message:'Konfigurasi API belum tersedia.'});if(!equal(req.headers['x-api-key'],key))return send(403,{message:'Unauthorized'});
    c=await db.getConnection();
    if(library){
     const identifier=library[1]?decodeURIComponent(library[1]):null;
     if(['GET','HEAD'].includes(req.method)){
      if(identifier){if(!/^[1-9]\d{0,14}$/.test(identifier))return send(404,{message:'Data tidak ditemukan.'});const [rows]=await c.execute('SELECT * FROM perpustakaan_namas WHERE id=?',[identifier]);return rows.length?send(200,rows[0]):send(404,{message:'Data tidak ditemukan.'});}
      const search=String(params.get('q') || '').trim();if(search.length>100)return send(422,{message:'Pencarian maksimal 100 karakter.'});const [rows]=await c.execute("SELECT * FROM perpustakaan_namas WHERE nama_latin LIKE ? ESCAPE '!' OR nama_arab LIKE ? ESCAPE '!' ORDER BY id LIMIT 50001",Array(2).fill('%'+search.replace(/[!%_]/g,'!$&')+'%'));if(rows.length>50000)return send(413,{message:'Hasil terlalu besar; persempit pencarian.'});return send(200,rows);
     }
     if(req.method==='DELETE'&&identifier){const [result]=await c.execute('DELETE FROM perpustakaan_namas WHERE nama_latin=?',[identifier]);return send(result.affectedRows?200:404,{message:result.affectedRows?'PerpustakaanNama deleted':'PerpustakaanNama not found'});}
     if(req.method!=='POST'&&req.method!=='PUT')return send(405,{message:'Metode tidak tersedia.'});if((req.method==='POST'&&identifier)||(req.method==='PUT'&&!identifier))return send(405,{message:'Metode tidak tersedia.'});
     const data=await body(req),values=[data.nama_latin ?? data[0],data.nama_arab ?? data[1],String(data.status ?? data[2] ?? '')];if(values.some(value=>typeof value!=='string'||!value.trim()||Array.from(value).length>255)||!['1','2'].includes(values[2]))return send(422,{message:'Nama Latin/Arab wajib diisi maksimal 255 karakter dan status 1/2.'});
     if(req.method==='POST'){const [result]=await c.execute('INSERT INTO perpustakaan_namas (nama_latin,nama_arab,status,created_at,updated_at) VALUES (?,?,?,NOW(),NOW())',values.map(value=>value.trim()));return send(201,{id:result.insertId,nama_latin:values[0],nama_arab:values[1],status:values[2]});}
     const [rows]=await c.execute('SELECT id FROM perpustakaan_namas WHERE nama_latin=? ORDER BY id LIMIT 1',[identifier]);if(!rows.length)return send(404,{message:'Data tidak ditemukan.'});await c.execute('UPDATE perpustakaan_namas SET nama_latin=?,nama_arab=?,status=?,updated_at=NOW() WHERE id=?',[...values.map(value=>value.trim()),rows[0].id]);return send(200,{id:rows[0].id,nama_latin:values[0],nama_arab:values[1],status:values[2]});
    }
    if(batch){
     if(req.method!=='POST')return send(405,{message:'Metode tidak tersedia.'});const data=await body(req,{file:true}),result=await convertNamesWorkbook({c,data:{workbook:data.upload},headerAlias:true,message:(status,message)=>({status,message})});
     if(!result.xlsx)return send(result.status,{message:result.message});if(batch[1])return file({content:result.xlsx,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename:'nama_arab.xlsx'});
     const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(result.xlsx);const sheet=workbook.worksheets[0],values=[];for(let row=2;row<=sheet.rowCount;row++)values.push(sheet.getCell('B'+row).value);return send(200,{nama_arab:values});
    }
    let generatedCard;
    if(card){
     if(!['GET','HEAD'].includes(req.method))return send(405,{message:'Metode tidak tersedia.'});const nis=decodeURIComponent(card[1]);if(nis.length>255)return send(422,{message:'NIS tidak valid.'});
     const [rows]=await c.execute('SELECT s.*, (SELECT path FROM foto_santris WHERE santri_id=s.id ORDER BY id LIMIT 1) AS foto FROM santris s WHERE s.nis=? OR s.nis_darul_ilmi=? ORDER BY s.id LIMIT 1',[nis,nis]);if(!rows.length)return send(404,{message:'Santri tidak ditemukan.'});const student=rows[0],rendered=await renderStudentCard(student,studentsRoot);generatedCard={student,bytes:rendered.content};
    }
    let bytes,name;
    if(generatedCard){bytes=generatedCard.bytes;name='Kartu Santri - '+generatedCard.student.nama;
    }else if(exporting){
     if(!['GET','HEAD'].includes(req.method))return send(405,{message:'Metode tidak tersedia.'});const year=params.get('tahun') || '',level=params.get('jenjang') || '';if(!/^\d{4}$/.test(year)||!level||level.length>80)return send(422,{message:'Tahun empat digit dan jenjang wajib diisi.'});
     const [rows]=await c.execute("SELECT s.* FROM santris s WHERE s.penerimaan_santri_id IN (SELECT id FROM penerimaan_santris WHERE SUBSTRING_INDEX(SUBSTRING_INDEX(kode_gelombang,'-',2),'-',-1)=?) AND s.jenjang=? AND s.status NOT IN ('Santri','Lulus','Di Keluarkan') ORDER BY s.id LIMIT 10001",[year,level]);if(rows.length>10000)return send(413,{message:'Ekspor melebihi 10.000 baris.'});
     bytes=await tableExcel(rows,exportColumns.map(column=>({key:column.key,label:column.label,value:row=>{let value=String(row[column.key] ?? '').trim();if(['rt','rw'].includes(column.key)){value=value.replace(/\D/g,'');if(value)value=value.padStart(3,'0');}return value.includes('@')?value.toLowerCase():value.toLowerCase().replace(/(^|\s)(\p{L})/gu,(_,space,char)=>space+char.toUpperCase());}})));name=`rekap_santri_${level}_${year}`;
     if(!path.endsWith('/n8n'))return file({content:bytes,type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename:name+'.xlsx'});
    }else if(path==='/api/dokumen/search'){
     if(!['GET','HEAD'].includes(req.method))return send(405,{message:'Metode tidak tersedia.'});name=(params.get('nama') || '').trim();if(!name||name.length>255)return send(422,{message:'Nama dokumen wajib diisi, maksimal 255 karakter.'});
     const [rows]=await c.execute("SELECT id,nama,created_at FROM dokumens WHERE nama LIKE ? ESCAPE '!' ORDER BY created_at DESC,id DESC LIMIT 1",['%'+name.replace(/[!%_]/g,'!$&')+'%']);if(!rows.length)return send(404,{success:false,message:'File tidak ditemukan'});return send(200,{success:true,data:{...rows[0],preview:link(rows[0].id,true),download:link(rows[0].id)}});
    }else {
     if(req.method!=='POST')return send(405,{message:'Metode tidak tersedia.'});const data=await body(req,{file:true,limit:10485760});bytes=data.upload;name=String(data.nama || parse(basename(data.upload_name || '')).name).trim();if(!name||Array.from(name).length>255)return send(422,{message:'Nama dokumen wajib diisi, maksimal 255 karakter.'});try{newFile=await saveContentFile({directory:'dokumen'},data,root);}catch(error){throw fail(error.message);}
    }
    if(!signingKey)throw fail('Konfigurasi tautan berkas belum tersedia.',503);
    if(!newFile)newFile=await saveContentFile({directory:'dokumen'},{upload:bytes,upload_name:generatedCard?'kartu.png':'export.xlsx'},root);
    const [result]=await c.execute('INSERT INTO dokumens (nama,path,link_preview_public,link_download,created_at,updated_at) VALUES (?,?,?,?,NOW(),NOW())',[name,newFile,'/preview/'+newFile,'/download/'+newFile]);saved=true;
    if(generatedCard){const student=generatedCard.student;return send(200,{status:true,message:'Kartu santri berhasil digenerate',data:{id:result.insertId,nama:student.nama,nis:student.jenjang==="Darul 'Ilmi"?student.nis_darul_ilmi:student.nis,download:link(result.insertId),preview:link(result.insertId,true),created_at:new Date(now()*1000).toISOString()}});}
    return send(200,{success:true,message:exporting?'Export berhasil':'Upload berhasil',data:{id:result.insertId,nama:name,link:link(result.insertId),download:link(result.insertId),preview:link(result.insertId,true),created_at:new Date(now()*1000).toISOString()}});
   }catch(error){if(!error.status)console.error('Integration:',error.code || error.name);return send(error.status || 503,{message:error.status?error.message:'Layanan belum dapat diproses.'});}
   finally{if(newFile&&!saved)await removeNewContentFile(newFile,root);if(c)c.release();}
  });
 };
}
export const handleIntegrationApi=createIntegrationApi();
