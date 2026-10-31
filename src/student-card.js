import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { esc } from './dashboard-shell.js';
import { studentFile,studentRoot } from './student-storage.js';
import { renderDocument } from './document-renderer.js';

export function studentCardIdentity(row) {
 const level=String(row.jenjang || '').trim().toLowerCase(),gender=String(row.jenis_kelamin || '').trim().toLowerCase();
 const female=['p','perempuan'].includes(gender),male=['l','laki-laki','laki laki','laki'].includes(gender);
 const template=!female&&!male?'kartu santri umum.jpg':`kartu ${level==="ma'had 'aly"?'maha ':''}santri ${female?'akhwat':'ikhwan'}.jpg`;
 const number=level==="darul 'ilmi"?row.nis_darul_ilmi || row.nis:level==="ma'had 'aly"?row.nis_mahad_aly || row.nis:level==='taud'||level==='tk taud'?row.nis_taud || row.nis:level==='kuttab'?row.nis_kuttab || row.nis:row.nis;
 const names={taud:['Taud Al Yusro','تود اليسر'],'tk taud':['Taud Al Yusro','تود اليسر'],kuttab:['Kuttab Al Yusro','كتّاب اليسر'],madrasah:['Madrasah Al Yusro Al Mutawassithoh','مدرسة اليسرى المتوسطة'],"darul 'ilmi":["Darul 'Ilmi Ats Tsanawiyyah",'دار العلم الثانوية'],"ma'had 'aly":["Ma'had 'Aly",'معهد علي']};
 return {template,number:number || '',female,male,level,latin:names[level]?.[0] || row.jenjang,arabic:names[level]?.[1] || row.jenjang};
}
export async function studentCardHtml(row,root=studentRoot) {
 const details=studentCardIdentity(row),background=await readFile(new URL('../assets/legacy-public/template/'+details.template,import.meta.url)),metadata=await sharp(background).metadata();
 const width=metadata.width,height=metadata.height,font=await readFile(new URL('../assets/legacy-public/fonts/Simplified Arabic Bold.ttf',import.meta.url));
 const stored=await studentFile(row.foto,root);
 const photo=await sharp(stored?await readFile(stored.file):await readFile(new URL('../assets/legacy-public/template/foto-default.jpg',import.meta.url)),{limitInputPixels:16000000}).rotate().resize(500,650,{fit:'cover'}).jpeg().toBuffer();
 const qr=await QRCode.toDataURL('www.mahadalyusro.sch.id/santri/'+details.number,{errorCorrectionLevel:'H',margin:2,width:512});
 const label=(text,x,y,arabic=false)=>`<div class="text" style="right:${100-x/10}%;top:${y/10}%;${arabic?'direction:rtl;':''}">${esc(text || '')}</div>`;
 const positions=[345,458,567,671,757],values=[row.nama_arab,row.nama,details.number,details.arabic,details.latin],labels=[details.male?'اسم الطالب':details.female?'اسم الطالبة':'الاسم',details.level==="ma'had 'aly"?'Nama Mahasantri':'Nama Santri','رقم الطالب','البرنامج','Program'];
 const html=`<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Card;src:url(data:font/ttf;base64,${font.toString('base64')})}*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}.background{position:absolute;inset:0;width:100%;height:100%}.text{position:absolute;font:50px Card,serif;color:#1d333e;text-align:right;max-width:58%;line-height:1.2;overflow-wrap:anywhere}.picture{position:absolute;transform:translate(-50%,-50%)}.photo{left:16%;top:56.5%;width:18%;height:auto}.qr{left:85%;top:18%;width:23%;height:auto}</style></head><body><img class="background" src="data:image/jpeg;base64,${background.toString('base64')}">${values.map((value,i)=>label(value,750,positions[i],[0,3].includes(i))).join('')}${labels.map((value,i)=>label(value,960,positions[i],[0,2,3].includes(i))).join('')}<img class="picture photo" src="data:image/jpeg;base64,${photo.toString('base64')}"><img class="picture qr" src="${qr}"></body></html>`;
 return {html,width,height};
}
export async function renderStudentCard(row,root=studentRoot) {
 const {html,width,height}=await studentCardHtml(row,root);
 return {status:200,content:await renderDocument(html,{width,height,format:'png'}),type:'image/png',attachment:true,filename:`kartu-${row.nis || row.id}.png`};
}
