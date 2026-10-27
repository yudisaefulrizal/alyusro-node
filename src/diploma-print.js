import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { esc } from './dashboard-shell.js';
import { studentFile,studentRoot } from './student-storage.js';
import { renderDocument } from './document-renderer.js';
import { diplomaDefinitions,diplomaSummary,gradeLetter } from './diploma-resources.js';

const arabic=value=>String(value ?? '').replace(/\d/g,digit=>'٠١٢٣٤٥٦٧٨٩'[digit]);
const decimal=value=>Number(value).toLocaleString('id-ID',{maximumFractionDigits:2});
const predAr=value=>value>=90?'ممتاز':value>=80?'جيد جدا':value>=70?'جيد':'مقبول';
const predId=value=>value>=90?'Istimewa':value>=80?'Sangat Baik':value>=70?'Baik':'Cukup';
const hijriMonths=['Muharram','Safar','Rabiul Awal','Rabiul Akhir','Jumadil Awal','Jumadil Akhir','Rajab',"Sya'ban",'Ramadhan','Syawal',"Dzulqa'dah",'Dzulhijjah'];
const hijriArabic=['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const monthArabic=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const hijriCache=new Map();
export async function diplomaHijri(event){
 const key=`${Number(event.tanggal)}-${Number(event.bulan)}-${Number(event.tahun)}`;
 if(hijriCache.has(key))return hijriCache.get(key);
 const response=await fetch('https://api.aladhan.com/v1/gToH/'+key,{signal:AbortSignal.timeout(10000)}),data=await response.json();
 if(!response.ok||data.code!==200||!data.data?.hijri?.date)throw new Error('Tanggal Hijriah penerbitan belum dapat diverifikasi.');
 const [day,month,year]=data.data.hijri.date.split('-').map(Number),value={day,month,year};hijriCache.set(key,value);return value;
}
let fonts;
async function fontCss(){fonts ||= Promise.all([['Latin','PoorRichardOpti.otf'],['Arabic','Amiri-Regular.ttf'],['ArabicBold','Al-Jazeera-Arabic Bold.ttf'],['Name','old.ttf']].map(async([name,path])=>`@font-face{font-family:${name};src:url(data:font/ttf;base64,${(await readFile(new URL('../../public/fonts/'+path,import.meta.url))).toString('base64')})}`)).then(values=>values.join(''));return fonts;}
const words=['nol','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
function spellInt(value){value=Math.floor(value);if(value<12)return words[value];if(value<20)return spellInt(value-10)+' belas';if(value<100)return spellInt(value/10)+' puluh'+(value%10?' '+spellInt(value%10):'');if(value<200)return 'seratus'+(value%100?' '+spellInt(value%100):'');if(value<1000)return spellInt(value/100)+' ratus'+(value%100?' '+spellInt(value%100):'');if(value<2000)return 'seribu'+(value%1000?' '+spellInt(value%1000):'');return spellInt(value/1000)+' ribu'+(value%1000?' '+spellInt(value%1000):'');}
const spell=value=>{const [whole,fraction]=String(Math.round(value*100)/100).split('.');return spellInt(Number(whole))+(fraction?' koma '+fraction.split('').map(digit=>words[Number(digit)]).join(' '):'');};

export async function diplomaPrintHtml(resource,row,student,event,{kind='print',hijri=diplomaHijri,cityArabic=student.tempat_lahir}={}){
 const config=diplomaDefinitions[resource],summary=diplomaSummary(resource,row),male=/^(l|laki[- ]?laki|laki|pria|male|1)$/i.test(String(student.jenis_kelamin).trim()),gender=male?'ikhwan':'akhwat',ma=resource==='ijazah-mahad-aly',di=resource==='ijazah-darul-ilmi';
 const template=kind==='transcript'?ma?`transkrip mahad aly ${gender}.jpg`:di?`transkrip darul ilmi ${gender}.jpg`:`transkrip nilai ijazah ${gender}.jpg`:ma?'ijazah mahad aly.jpg':di?'darul ilmi.jpg':'ijazah.jpg';
 const background=await readFile(new URL('../../public/template/'+template,import.meta.url)),{width,height}=await sharp(background).metadata();
 const qr=await QRCode.toDataURL('https://www.mahadalyusro.sch.id/mathaapp/ijazah/cek/'+encodeURIComponent(row.nomor_ijazah),{errorCorrectionLevel:'H',margin:2,width:512});
 const date=new Date(Date.UTC(Number(event.tahun),Number(event.bulan)-1,Number(event.tanggal),12));
 if(!Number.isFinite(date.getTime())||date.getUTCDate()!==Number(event.tanggal)||date.getUTCMonth()+1!==Number(event.bulan))throw new Error('Tanggal event tidak valid.');
 const dateId=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(date),h=await hijri(event),hId=`${h.day} ${hijriMonths[h.month-1]} ${h.year}`,hAr=`${arabic(h.day)} ${hijriArabic[h.month-1]} ${arabic(h.year)}`;
 const nis=di?student.nis_darul_ilmi || student.nis:ma?student.nis_mahad_aly || student.nis:student.nis;
 const year=`${Number(event.tahun)-1}/${event.tahun}`,yearH=`${h.year-1}/${h.year}`,birth=`${student.tempat_lahir}, ${student.tanggal_lahir} ${new Intl.DateTimeFormat('id-ID',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2000,Number(student.bulan_lahir)-1,1)))} ${student.tahun_lahir}`;
 const birthAr=`${cityArabic || student.tempat_lahir} ${arabic(student.tanggal_lahir)} ${monthArabic[Number(student.bulan_lahir)-1] || ''} ${arabic(student.tahun_lahir)} م`;
 const overlays=[];
 const text=(value,x,y,size=50,font='Arabic',align='center',maxWidth=1550)=>{if(value===null||value===undefined)return;overlays.push(`<div class="text" style="left:${x/10}%;top:calc(${y/10}% + ${size*.25}px);font-size:${size}px;font-family:${font};max-width:${maxWidth}px;transform:translate(${align==='left'?0:align==='right'?-100:-50}%,-50%);text-align:${align};${font.startsWith('Arabic')?'direction:rtl;':''}">${esc(value)}</div>`);};
 const image=(src,x,y,size)=>overlays.push(`<img class="overlay-image" style="left:${x/10}%;top:${y/10}%;width:${size/10}%" src="${src}">`);
 const latinProgram=ma?"Ma’had ‘Aly Al Yusro":di?"Darul 'Ilmi Ats-Tsanawiyyah":'Madrasah Al Yusro Al Mutawassithah',arProgram=ma?'معهد علي':di?'دار العلم الثانوية':'مدرسة اليسرى المتوسطة';
 const numeric=ma?summary.ipk:summary.average,numericText=decimal(numeric),predicateAr=ma?(numeric>3.75?'ممتاز':numeric>3?'جيد جداً':numeric>2.5?'جيد':numeric>2?'مقبول':'ضعيف'):predAr(numeric);
 if(kind==='print') {
  if(!ma){
   const latin=['Ma’had Tahfizh Al Yusro','menyatakan bahwa:',student.nama,`kebangsaan Indonesia, Lahir di ${birth}`,`NIS : ${nis || '-'}`,'Telah menyelesaikan pendidikan',`Program ${latinProgram}`,'selama tiga (3) tahun masa pendidikan',`dengan nilai rata-rata ${numericText} predikat ${summary.predicate}`,`Pada Tahun Pelajaran ${yearH} H / ${year} M`,`Diterbitkan di Bogor, ${hId} H /`,`${dateId} M`];
   const ar=['يشهد معهد اليسرى لتحفيظ القرآن',male?'أن الطالب:':'أن الطالبة:',student.nama_arab || student.nama,`${male?'إندونيسي الجنسية، المولود':'إندونيسية الجنسية، المولودة'} في ${birthAr}`,`رقم القيد: ${arabic(nis || '-')}`,male?'قد أنهى دراسته':'قد أنهت دراستها',`في برنامج ${arProgram}`,'لمدة ثلاث سنوات،',`بتقدير عام ${predicateAr} ومعدل تراكمي ${arabic(numericText)}`,`في العام الدراسي ${arabic(yearH)} هـ الموافق ${arabic(year)} م`,`حُررت في: بوغور بتاريخ ${hAr} هـ /`,`${arabic(event.tanggal)} ${monthArabic[Number(event.bulan)-1]} ${arabic(event.tahun)} م`];
   const ys=[371,391,432,466,491,516,541,566,591,616,666,691];
   for(let i=0;i<latin.length;i++){const nameSize=Buffer.byteLength(String(student.nama || ''))>40?70:95;text(latin[i],290,ys[i],i===2?nameSize:45,i===2?'Name':'Latin');text(ar[i],di?740:735,ys[i]+2,i===2?80:52,i===2?'ArabicBold':'Arabic');}
   text('Kementerian Agama Republik Indonesia',194,107,40,'Latin');text('Yayasan Al Yusro Mulia Bogor',194,129,40,'Latin');text('Ma’had Tahfizh Al Yusro',194,148,48,'Latin');text('NSP : 510232011594',194,182,40,'Latin');
   text('مدير المعهد',500,725,62);text('Mudir Ma’had',500,770,48,'Latin');text('أندي هدايت',500,860,60);text('Andi Hidayat, B.Sh., M.E.',500,882,45,'Latin');text(row.nomor_ijazah,500,940,38,'Latin');
  }else{
   const lines=[['يشهد معهد اليسرى لتحفيظ القرآن',305,48,'Arabic'],['Ma’had Tahfizh Al Yusro menyatakan bahwa:',340,45,'Latin'],[student.nama_arab || student.nama,361,80,'ArabicBold'],[student.nama,411,85,'Name'],[`${male?'المولود':'المولودة'} في ${birthAr}`,448,48,'Arabic'],[`kebangsaan Indonesia, Lahir di ${birth}`,485,45,'Latin'],[`رقم القيد: ${arabic(nis || '-')}`,503,48,'Arabic'],[`NIS : ${nis || '-'}`,540,45,'Latin'],[`قد أتم الدراسة في برنامج ${arProgram} لمدة ثلاث سنوات`,565,48,'Arabic'],[`Telah menyelesaikan pendidikan Program ${latinProgram} selama tiga (3) tahun`,607,45,'Latin'],[`بتقدير عام ${predicateAr} ومعدل تراكمي ${arabic(numericText)}`,632,48,'Arabic'],[`dengan IPK ${numericText} predikat ${summary.predicate}`,670,45,'Latin'],[`في العام الدراسي ${arabic(yearH)} هـ الموافق ${arabic(year)} م`,697,48,'Arabic'],[`Pada Tahun Pelajaran ${yearH} H / ${year} M`,735,45,'Latin'],[`حُررت في بوغور بتاريخ ${hAr} هـ`,757,48,'Arabic'],[`Diterbitkan di Bogor, ${dateId}`,795,45,'Latin'],['مدير المعهد',833,48,'Arabic'],['Mudir Ma’had',868,45,'Latin'],['أندي هدايت',940,56,'Arabic'],['Andi Hidayat, B.Sh., M.E.',975,45,'Latin']];
   for(const [value,y,size,font] of lines)if(y<833)text(value,500,y,size,font,'center',2200);
   for(const [x,arabicTitle,latinTitle,arabicName,latinName] of [[270,'مدير المعهد','Mudir Ma’had','أندي هدايت','Andi Hidayat, B.Sh., M.E.'],[730,'رئيس القسم','Kepala Program','محمد ديني أتماجا كوسوما بوترا','Moh. Deni Atmaja Kusuma Putra, Lc']]){text(arabicTitle,x,833,48);text(latinTitle,x,868,45,'Latin');text(arabicName,x,940,48,'Arabic','center',1250);text(latinName,x,975,40,'Latin','center',1250);}
   const stored=await studentFile(student.foto,studentRoot);const photo=await sharp(stored?await readFile(stored.file):await readFile(new URL('../../public/template/foto-default.jpg',import.meta.url))).rotate().resize(300,400,{fit:'cover'}).jpeg().toBuffer();image('data:image/jpeg;base64,'+photo.toString('base64'),500,932,48);text(row.nomor_ijazah,500,990,26,'Latin');
  }
  image(qr,ma?880:875,920,80);
 }else if(!ma){
  const header=di?[170,197,219]:[225,265,290],x=di?238:258;
  for(const [value,n] of [[student.nama,0],[nis || '-',1],[year,2]])text(value,x,header[n],n?55:56,'Arabic','left',650);
  for(const [value,n] of [[student.nama_arab || student.nama,0],[arabic(nis || '-'),1],[arabic(year),2]])text(value,di?780:750,header[n],n?60:68,'Arabic','right',650);
  config.grades.forEach((key,i)=>{const y=(di?272:370)+(di?27.5:35)*i;const value=Number(row[key]);text(arabic(decimal(value)),di?495:490,y,di?55:70);text(predAr(value),390,y,di?52:68,'Arabic','right',600);text('('+predId(value)+')',120,y,di?38:45,'Latin','left',600);});
  const ys=di?[776,798,820]:[687,723,760];
  [summary.total,summary.average,predicateAr].forEach((value,i)=>text(i<2?arabic(decimal(value)):value,492,ys[i],di?55:65));
  [spell(summary.total),spell(summary.average),summary.predicate].forEach((value,i)=>text('('+value+')',120,ys[i],di?34:44,'Latin','left',820));
  const sign=di?[870,892,915,953,976]:[821,836,861,922,947];
  [arabic(`${event.tanggal}/${event.bulan}/${event.tahun}`),'مدير المعهد','Mudir Ma’had','أندي هدايت','Andi Hidayat, B.Sh., M.E.'].forEach((value,i)=>text(value,685,sign[i],i===1||i===3?60:40,i===2||i===4?'Latin':'Arabic'));
  image(qr,880,900,95);
 }else{
  [student.nama,nis || '-',year].forEach((value,i)=>text(value,200,[125,149,166][i],40,'Arabic','left',650));
  [student.nama_arab || student.nama,arabic(nis || '-'),arabic(year)].forEach((value,i)=>text(value,820,[125,149,166][i],45,'Arabic','right',650));
  config.grades.forEach((key,i)=>{const y=215+15.2*i,value=Number(row[key]),letter=gradeLetter(value),ip={A:4,B:3,C:2,D:1}[letter];text(config.hours[key],516,y,38,'Arabic','right');text(decimal(value),401,y,38,'Arabic','right');text(arabic(decimal(value)),460,y,38,'Arabic','right');text(letter,176,y,38,'Arabic','right');text(ip,100,y,38,'Arabic','left');});
  text(summary.hours,656,815,38,'Arabic','center');text(numericText,160,829,38);text(arabic(numericText),370,829,38);text(numeric>3.75?'A':numeric>3?'B':numeric>2.5?'C':numeric>2?'D':'E',98,866,38);text(summary.predicate,195,866,38);text(predicateAr,410,866,38);
  text(row.judul_karya_ilmiyah_arab || '',480,890,40);text(row.judul_karya_ilmiyah_latin || '',480,902,30,'Latin');text('مدير المعهد',225,928,40);text('أندي هدايت',225,980,40);text('رئيس القسم',715,928,40);text('محمد ديني أتماجا كوسوما بوترا',715,980,40);text(arabic(`${event.tanggal}/${event.bulan}/${event.tahun}`),480,980,36);image(qr,890,938,75);
 }
 return {width,height,html:`<!doctype html><html><head><meta charset="utf-8"><style>${await fontCss()}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}.background{position:absolute;inset:0;width:100%;height:100%}.text{position:absolute;white-space:pre-wrap;overflow-wrap:anywhere;color:#1e1a19;line-height:1.15;width:max-content}.overlay-image{position:absolute;transform:translate(-50%,-50%);height:auto}</style></head><body><img class="background" src="data:image/jpeg;base64,${background.toString('base64')}">${overlays.join('')}</body></html>`};
}
export async function renderDiploma(resource,row,student,event,options={kind:'print'}){const {html,width,height}=await diplomaPrintHtml(resource,row,student,event,options);return {status:200,content:await renderDocument(html,{width,height,format:'png'}),type:'image/png',attachment:true,filename:`${options.kind}-${row.nomor_ijazah}.png`};}
