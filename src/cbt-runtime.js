import { randomInt,randomBytes } from 'node:crypto';
import { pool } from './db.js';
import { esc } from './dashboard-shell.js';
import { slots } from './cbt-resources.js';
const base='/dashboard/ujian';
const shuffle=items=>{const result=[...items];for(let i=result.length-1;i>0;i--){const j=randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;};
export function cbtRuntimeRoute(path){const match=path.match(/^\/dashboard\/ujian(?:\/([1-9]\d{0,14})\/(instructions|start|run|save|submit|result))?$/);return match?{id:match[1],action:match[2] || 'list'}:null;}
export function createCbtRuntime(db=pool,now=()=>Math.floor(Date.now()/1000)) {
 return async function runtime({user,action='list',id,csrf='',data}) {
  const message=(status,text)=>({status,title:'Ujian Online',body:`<section><p>${esc(text)}</p><a href="${base}">Kembali ke daftar ujian</a></section>`});
  const kk=String(user?.nomor_kk || '').trim();if(!kk)return message(404,'Lengkapi nomor KK untuk melihat ujian santri Anda.');
  const c=await db.getConnection();let transaction=false;
  try {
   if(action==='list') {
    const [rows]=await c.execute('SELECT p.id,p.status,p.nilai,p.nilai_essay,p.nilai_total,s.nama,u.nama_ujian,u.durasi,u.aktif FROM cbt_peserta p JOIN santris s ON s.nomor_pendaftaran=p.nomor_pendaftaran JOIN cbt_ujian u ON u.id=p.ujian_id WHERE s.no_kk=? ORDER BY p.id DESC',[kk]);
    return {status:200,title:'Ujian Online',body:`<section><p>Pilih ujian untuk santri Anda. Waktu dihitung sejak tombol mulai ditekan dan tetap berjalan saat halaman ditutup.</p>${rows.length?rows.map(row=>`<article class="widget"><h2>${esc(row.nama_ujian)}</h2><p>${esc(row.nama)} · ${esc(row.durasi)} menit · ${esc(row.status)}</p>${row.status==='finished'?`<p>Nilai PG: ${esc(row.nilai ?? '-')} · Essay: ${esc(row.nilai_essay ?? 'Belum dinilai')} · Total: ${esc(row.nilai_total ?? row.nilai ?? '-')}</p><a href="${base}/${row.id}/result">Lihat hasil</a>`:row.status==='ongoing'?`<a href="${base}/${row.id}/run">Lanjutkan ujian</a>`:row.aktif?`<a href="${base}/${row.id}/instructions">Petunjuk dan mulai ujian</a>`:'<p>Ujian belum aktif.</p>'}</article>`).join(''):'<p>Belum ada ujian yang ditugaskan.</p>'}<a href="/dashboard">Kembali ke dasbor</a></section>`};
   }
   if(!['instructions','start','run','save','submit','result'].includes(action))return message(404,'Halaman tidak ditemukan.');
   if(['start','save','submit'].includes(action)&&!data)return message(405,'Gunakan formulir ujian.');
   if(data||action==='run'){await c.beginTransaction();transaction=true;}
   const [participants]=await c.execute(`SELECT p.*,s.nama,UNIX_TIMESTAMP(p.started_at) AS started_epoch FROM cbt_peserta p JOIN santris s ON s.nomor_pendaftaran=p.nomor_pendaftaran WHERE p.id=? AND s.no_kk=?${transaction?' FOR UPDATE':''}`,[id,kk]);
   if(!participants.length)return message(404,'Peserta ujian tidak ditemukan.');const participant=participants[0];
   const [exams]=await c.execute('SELECT * FROM cbt_ujian WHERE id=?',[participant.ujian_id]);if(!exams.length)return message(404,'Ujian tidak ditemukan.');const exam=exams[0];
   if(action==='result'||participant.status==='finished') {
    if(participant.status!=='finished')return message(409,'Ujian belum selesai.');
    if(data)return message(409,'Ujian sudah selesai. Jawaban tidak diubah.');
    return {status:200,title:'Hasil Ujian',body:`<section><h2>${esc(exam.nama_ujian)}</h2><p>${esc(participant.nama)}</p><dl><dt>Nilai PG</dt><dd>${esc(participant.nilai ?? '-')}</dd><dt>Nilai Essay</dt><dd>${esc(participant.nilai_essay ?? 'Belum dinilai')}</dd><dt>Nilai Total</dt><dd>${esc(participant.nilai_total ?? participant.nilai ?? '-')}</dd></dl><a href="${base}">Kembali ke daftar ujian</a></section>`};
   }
   if(action==='instructions')return {status:200,title:'Petunjuk Ujian',body:`<section><h2>${esc(exam.nama_ujian)}</h2><p>Peserta: ${esc(participant.nama)} · Durasi: ${exam.durasi} menit · ${slots.filter(i=>exam['q'+i]).length} soal.</p><p>Pilih jawaban atau ketik jawaban essay. Gunakan nomor soal dan tombol Sebelumnya/Berikutnya untuk berpindah. Jawaban disimpan ke server dan salinan lokal. Waktu tetap berjalan saat halaman ditutup; ujian dikumpulkan saat waktu habis. Jangan berpindah tab atau melakukan copy/paste saat ujian. Tiga kali meninggalkan tab atau lima peringatan akan mengirim jawaban yang sudah dikerjakan.</p><form method="post" action="${base}/${id}/start"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button>Mulai dan jalankan waktu ujian</button></form><a href="${base}">Batal</a></section>`};
   const initialize=async(startEpoch,preserve=false)=>{
    if(!Number.isFinite(startEpoch)||startEpoch<=0)return message(409,'Waktu mulai tidak valid. Hubungi operator untuk reset.');
     const questionIds=slots.map(i=>exam['q'+i]).filter(Boolean);if(!questionIds.length)return message(422,'Ujian belum memiliki soal.');
     const [bank]=await c.execute(`SELECT * FROM cbt_soal WHERE id IN (${questionIds.map(()=>'?').join(',')})`,questionIds);
     const questions=slots.filter(i=>exam['q'+i]).map(i=>{const question=bank.find(row=>String(row.id)===String(exam['q'+i]));if(!question)return null;return {slot:i,id:question.id,type:question.tipe_soal,question:question.pertanyaan,weight:Number(question.bobot),correct:question.jawaban_benar,options:question.tipe_soal==='essay'?[]:shuffle([...new Set([question.jawaban_benar,...Array.from({length:6},(_,i)=>question['jawaban_salah_'+(i+1)])].filter(value=>value!==null&&value!==''))])};});
     if(questions.some(question=>!question || (question.type!=='essay'&&!String(question.correct).trim())))return message(422,'Ada soal yang tidak tersedia. Hubungi operator.');
     const deadline=startEpoch+Number(exam.durasi)*60;
     const initialAnswers=preserve?Object.fromEntries(questions.filter(question=>participant['j'+question.slot]!==null).map(question=>['j'+question.slot,participant['j'+question.slot]])):{};
     await c.execute('DELETE FROM node_cbt_attempts WHERE peserta_id=?',[id]);
     await c.execute('INSERT INTO node_cbt_attempts (peserta_id,snapshot,answers,deadline,attempt_key) VALUES (?,?,?,?,?)',[id,JSON.stringify(questions),JSON.stringify(initialAnswers),deadline,randomBytes(16).toString('hex')]);
    return null;
   };
   if(action==='start') {
    if(!exam.aktif)return message(409,'Ujian belum aktif.');
    if(participant.status==='pending') {
     const error=await initialize(now());if(error)return error;
     await c.execute("UPDATE cbt_peserta SET status='ongoing',started_at=FROM_UNIXTIME(?),finished_at=NULL WHERE id=?",[now(),id]);
    }else{
     const [attempts]=await c.execute('SELECT peserta_id FROM node_cbt_attempts WHERE peserta_id=?',[id]);
     if(!attempts.length){const error=await initialize(Number(participant.started_epoch),true);if(error)return error;}
    }
    await c.commit();transaction=false;return {status:303,redirect:`${base}/${id}/run`};
   }
   if(participant.status!=='ongoing')return message(409,'Mulai ujian terlebih dahulu.');
   let [attempts]=await c.execute('SELECT * FROM node_cbt_attempts WHERE peserta_id=?'+(transaction?' FOR UPDATE':''),[id]);
   if(!attempts.length){const error=await initialize(Number(participant.started_epoch),true);if(error)return error;[attempts]=await c.execute('SELECT * FROM node_cbt_attempts WHERE peserta_id=?',[id]);if(action==='run'){await c.commit();transaction=false;}}
   const attempt=attempts[0],questions=JSON.parse(attempt.snapshot),answers=JSON.parse(attempt.answers),deadline=Number(attempt.deadline);
   if(action==='run') {
    const fields=questions.map((question,index)=>`<fieldset class="cbt-question" data-question="${index}" ${index?'hidden':''}><legend>${index+1}. ${esc(question.question)}</legend><p>Bobot: ${question.weight}</p>${question.type==='essay'?`<textarea class="cbt-answer" name="j${question.slot}" maxlength="65535" rows="7">${esc(answers['j'+question.slot] || '')}</textarea>`:question.options.map((option,n)=>`<label class="cbt-option"><input class="cbt-answer" type="radio" name="j${question.slot}" value="${esc(option)}" ${answers['j'+question.slot]===option?'checked':''}> ${String.fromCharCode(65+n)}. ${esc(option)}</label>`).join('')}</fieldset>`).join('');
    return {status:200,title:exam.nama_ujian,body:`<section class="cbt-session" data-cbt data-deadline="${deadline}" data-now="${now()}" data-peserta="${id}" data-user="${esc(user.id)}" data-attempt="${esc(attempt.attempt_key || deadline)}"><p>Peserta: ${esc(participant.nama)}</p><p>Sisa waktu: <strong data-cbt-timer></strong> · <span data-cbt-progress></span></p><p role="alert" data-cbt-warning></p><p role="status" data-cbt-save-status>Jawaban tersimpan di server saat Anda mengisi.</p><form method="post" action="${base}/${id}/submit" data-cbt-form><input type="hidden" name="_csrf" value="${esc(csrf)}">${fields}<nav class="cbt-numbers" aria-label="Nomor soal">${questions.map((question,i)=>`<button type="button" data-cbt-go="${i}">${i+1}</button>`).join('')}</nav><p><button type="button" data-cbt-prev>Sebelumnya</button> <button type="button" data-cbt-next>Berikutnya</button></p><button type="submit">Kirim jawaban dan selesai</button></form><script src="/cbt.js" defer></script></section>`};
   }
   if(Object.keys(data).some(key=>key!=='_csrf'&&!questions.some(question=>'j'+question.slot===key)))return message(422,'Kolom jawaban tidak valid.');
   if(now()<deadline)for(const question of questions) {
    const key='j'+question.slot;if(data[key]===undefined)continue;const value=data[key];
    if(typeof value!=='string'||Buffer.byteLength(value)>65535||(question.type!=='essay'&&value!==''&&!question.options.includes(value)))return message(422,'Jawaban tidak valid.');answers[key]=value;
   }
   if(action==='save') {
    if(now()>=deadline)return message(409,'Waktu ujian habis. Kirim jawaban untuk menyelesaikan ujian.');
    await c.execute('UPDATE node_cbt_attempts SET answers=? WHERE peserta_id=?',[JSON.stringify(answers),id]);await c.commit();transaction=false;return {status:200,json:{saved:true,deadline}};
   }
   let points=0,total=0;
   for(const question of [...questions].sort((a,b)=>Number(a.id)-Number(b.id))) {
    if(question.type==='essay')continue;
    const correct=Boolean(String(answers['j'+question.slot] || '').trim()) && String(answers['j'+question.slot] || '').trim().toLowerCase()===String(question.correct).trim().toLowerCase();
    total+=question.weight;if(correct)points+=question.weight;
    await c.execute(`UPDATE cbt_soal SET ${correct?'jumlah_benar=jumlah_benar+1':'jumlah_salah=jumlah_salah+1'},updated_at=NOW() WHERE id=?`,[question.id]);
   }
   const grade=total?Math.round(points/total*100):0;
   const keys=questions.map(question=>'j'+question.slot);
   await c.execute(`UPDATE cbt_peserta SET ${keys.map(key=>'`'+key+'`=?').join(',')},status='finished',finished_at=FROM_UNIXTIME(?),nilai=?,nilai_total=?,updated_at=NOW() WHERE id=?`,[...keys.map(key=>answers[key] || null),now(),grade,grade,id]);
   await c.execute('UPDATE node_cbt_attempts SET answers=? WHERE peserta_id=?',[JSON.stringify(answers),id]);
   await c.commit();transaction=false;return {status:303,redirect:`${base}/${id}/result`};
  }finally{if(transaction)await c.rollback();c.release();}
 };
}
export const cbtRuntime=createCbtRuntime();
