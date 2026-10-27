import {locationInfo,localDate,followingDate,nextPrayer,prayers} from '/prayer-time.js';
const page=document.querySelector('.prayer-page');
if(page){
 const select=page.querySelector('#lokasi-dropdown');const info=locationInfo(page.dataset.location);
 const status=page.querySelector('#prayer-status');const countdown=page.querySelector('#countdown');
 const share=page.querySelector('#prayer-share');const remind=page.querySelector('#prayer-remind');
 const retry=page.querySelector('#prayer-retry');
 let today=null,tomorrow=null,date=null,loading=false,notifications=false,lastNotified=null,previousTick=Date.now();
 const setStatus=text=>status.textContent=text;
 select.addEventListener('change',()=>{location.href='/jadwal/shalat/'+encodeURIComponent(select.value);});
 const dateLabels=()=>{
  const now=new Date();page.querySelector('#tanggal').textContent=new Intl.DateTimeFormat('id-ID',{timeZone:info.timeZone,day:'numeric',month:'long',year:'numeric'}).format(now);
  page.querySelector('#tanggalHijriah').textContent=new Intl.DateTimeFormat('id-ID-u-ca-islamic-civil',{timeZone:info.timeZone,day:'numeric',month:'long',year:'numeric'}).format(now);
  page.querySelector('#clock').textContent=new Intl.DateTimeFormat('id-ID',{timeZone:info.timeZone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now);
 };
 async function getSchedule(day){
  const response=await fetch(`/api/jadwal-shalat?lokasi=${encodeURIComponent(info.name)}&tanggal=${day}`,{signal:AbortSignal.timeout(25000)});
  const body=await response.json();if(!response.ok)throw Error(body.message||'Jadwal belum dapat dimuat.');
  if(!prayers.every(([key])=>/^([01]\d|2[0-3]):[0-5]\d$/.test(body.jadwal?.[key]||'')))throw Error('Data jadwal tidak lengkap. Silakan coba lagi.');
  return body.jadwal;
 }
 async function load(){
  if(loading)return;loading=true;today=null;tomorrow=null;share.disabled=true;remind.disabled=true;retry.hidden=true;
  setStatus('Memuat jadwal shalat…');countdown.textContent='';
  for(const [key] of prayers)page.querySelector('#'+key).textContent='—';
  date=localDate(new Date(),info.timeZone);dateLabels();
  try{
   today=await getSchedule(date);
   for(const [key] of prayers)page.querySelector('#'+key).textContent=today[key];
   share.disabled=false;remind.disabled=false;setStatus('');tick();
   try{tomorrow=await getSchedule(followingDate(date));setStatus('');}
   catch{setStatus('Jadwal hari ini tersedia. Jadwal Subuh esok hari belum dapat dimuat.');retry.hidden=false;}
   tick();
  }catch(error){today=null;setStatus(error.name==='TimeoutError'?'Layanan jadwal belum merespons. Silakan coba lagi.':error.message);retry.hidden=false;}
  finally{loading=false;}
 }
 function tick(){
  const now=new Date();dateLabels();
  if(date&&localDate(now,info.timeZone)!==date){if(!loading)void load();return;}
  if(!today)return;
  const next=nextPrayer(now,date,today,tomorrow,info.offset);
  countdown.textContent=next ? `Waktu Shalat Berikutnya (${next.name}${next.tomorrow?' esok hari':''}): ${Math.floor((next.timestamp-now)/3600000)} j ${Math.floor((next.timestamp-now)%3600000/60000)} m ${Math.floor((next.timestamp-now)%60000/1000)} d` : 'Menunggu jadwal Subuh esok hari.';
  for(const [key] of prayers)page.querySelector('#'+key).closest('tr').classList.toggle('next-prayer',Boolean(next&&!next.tomorrow&&next.key===key));
  if(notifications&&'Notification' in window&&Notification.permission==='granted'){
   for(const [key,name] of prayers){const at=Date.parse(`${date}T${today[key]}:00+${String(info.offset).padStart(2,'0')}:00`);
    if(at>previousTick&&at<=now.getTime()&&now-at<60000&&lastNotified!==date+key){
     try{new Notification('Jadwal Shalat',{body:`Waktu shalat ${name} di ${info.name} (${today[key]} ${info.label}).`,icon:'/logo/logo_al_yusro.png'});lastNotified=date+key;}catch{page.querySelector('#reminder-status').textContent='Notifikasi tidak didukung di browser ini.';}
    }
   }
  }
  previousTick=now.getTime();
 }
 share.addEventListener('click',()=>{
  if(!today)return;
  const text=`Jadwal Shalat Hari Ini (${info.name})\n${page.querySelector('#tanggal').textContent}\n`+prayers.map(([key,name])=>`${name}: ${today[key]} ${info.label}`).join('\n')+'\nSumber: MyQuran / Kemenag';
  window.open('https://api.whatsapp.com/send?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
 });
 remind.addEventListener('click',async()=>{
  const message=page.querySelector('#reminder-status');
  if(!('Notification' in window)||!window.isSecureContext){message.textContent='Browser ini tidak mendukung notifikasi. Gunakan HTTPS atau localhost.';return;}
  try{const permission=await Notification.requestPermission();notifications=permission==='granted';previousTick=Date.now();message.textContent=notifications?'Pengingat aktif selama halaman ini tetap terbuka.':permission==='denied'?'Izin notifikasi ditolak. Anda bisa mengubahnya di pengaturan browser.':'Izin notifikasi belum diberikan.';}catch{message.textContent='Notifikasi belum dapat diaktifkan di browser ini.';}
 });
 retry.addEventListener('click',()=>void load());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
 void load();setInterval(tick,1000);
}
