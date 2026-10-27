const root=document.querySelector('[data-cbt]');
if(root){
 const form=root.querySelector('[data-cbt-form]'),questions=[...form.querySelectorAll('[data-question]')],status=root.querySelector('[data-cbt-save-status]');
 const storageKey='alyusro-cbt-'+root.dataset.user+'-'+root.dataset.peserta+'-'+root.dataset.attempt,serverOffset=Number(root.dataset.now)*1000-Date.now();let index=0,finished=false,saving=Promise.resolve(),queued=false,submitting=false;
 const values=()=>new URLSearchParams(new FormData(form));
 const show=i=>{index=Math.max(0,Math.min(i,questions.length-1));questions.forEach((question,n)=>question.hidden=n!==index);root.querySelectorAll('[data-cbt-go]').forEach((button,n)=>button.setAttribute('aria-current',n===index?'step':'false'));};
 const progress=()=>{let answered=0;questions.forEach((question,n)=>{const selected=[...question.querySelectorAll('.cbt-answer')].some(input=>input.type==='radio'?input.checked:input.value.trim());if(selected)answered++;root.querySelector(`[data-cbt-go="${n}"]`).classList.toggle('answered',selected);});root.querySelector('[data-cbt-progress]').textContent=`${answered}/${questions.length} dijawab`;return answered;};
 const save=()=>{
  try{localStorage.setItem(storageKey,JSON.stringify([...values()]));}catch{}
  queued=true;
  saving=saving.catch(()=>{}).then(async()=>{
   if(!queued||finished)return;queued=false;
   try{const response=await fetch(form.action.replace('/submit','/save'),{method:'POST',body:values(),credentials:'same-origin'});if(!response.ok||response.redirected||!response.headers.get('content-type')?.includes('application/json'))throw new Error('save');const result=await response.json();if(result.saved!==true)throw new Error('save');status.textContent='Jawaban tersimpan di server.';}catch{status.textContent='Belum tersimpan ke server. Periksa koneksi; salinan lokal tetap tersedia.';}
  });return saving;
 };
 // Local drafts are scoped to this participant and never replace the server deadline.
 try{const draft=JSON.parse(localStorage.getItem(storageKey) || 'null');if(Array.isArray(draft)&&Date.now()+serverOffset<Number(root.dataset.deadline)*1000)for(const [key,value] of draft){if(!/^j\d+$/.test(key))continue;for(const input of form.querySelectorAll(`[name="${key}"]`)){if(input.type==='radio')input.checked=input.value===value;else input.value=value;}}}catch{}
 form.addEventListener('input',()=>{progress();save();});
 root.querySelectorAll('[data-cbt-go]').forEach(button=>button.addEventListener('click',()=>show(Number(button.dataset.cbtGo))));
 root.querySelector('[data-cbt-prev]').addEventListener('click',()=>show(index-1));root.querySelector('[data-cbt-next]').addEventListener('click',()=>show(index+1));
 async function submit(auto=false){
  if(submitting)return;if(!auto&&!confirm(progress()<questions.length?'Masih ada soal belum dijawab. Selesaikan ujian?':'Kirim jawaban dan selesaikan ujian?'))return;
  submitting=true;await saving.catch(()=>{});
  try{const response=await fetch(form.action,{method:'POST',body:values(),credentials:'same-origin'});if(response.redirected&&response.url.endsWith('/result')){finished=true;try{localStorage.removeItem(storageKey);}catch{}location.assign(response.url);return;}if(response.status===409){status.textContent='Ujian sudah selesai atau perlu dimuat ulang. Periksa hasil dari daftar ujian.';}else status.textContent='Jawaban belum berhasil dikirim. Periksa koneksi dan coba lagi.';}catch{status.textContent='Koneksi terputus. Jawaban lokal dipertahankan; coba kirim lagi.';}finally{submitting=false;}
 }
 let warningCount=0,tabCount=0;
 try{const saved=JSON.parse(sessionStorage.getItem(storageKey+'-warnings') || '{}');warningCount=Number(saved.total)||0;tabCount=Number(saved.tabs)||0;}catch{}
 const warn=(message,tab=false)=>{if(finished||submitting)return;warningCount++;if(tab)tabCount++;try{sessionStorage.setItem(storageKey+'-warnings',JSON.stringify({total:warningCount,tabs:tabCount}));}catch{}root.querySelector('[data-cbt-warning]').textContent=message+` Peringatan ${warningCount}/5; keluar tab ${tabCount}/3.`;if(warningCount>=5||tabCount>=3)submit(true);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)warn('Tetap berada pada tab ujian.',true);});
 for(const event of ['copy','cut','paste','contextmenu'])root.addEventListener(event,e=>{e.preventDefault();warn('Copy/paste dan menu konteks tidak digunakan selama ujian.');});
 document.addEventListener('keydown',e=>{if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C'].includes(e.key.toUpperCase()))){e.preventDefault();warn('Tetap fokus pada halaman ujian.');}});
 form.addEventListener('submit',event=>{event.preventDefault();submit();});
 const tick=()=>{const remaining=Math.max(0,Math.ceil((Number(root.dataset.deadline)*1000-Date.now()-serverOffset)/1000));root.querySelector('[data-cbt-timer]').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;if(!remaining&&!finished)submit(true);};
 show(0);progress();tick();setInterval(tick,1000);
 if(Date.now()+serverOffset<Number(root.dataset.deadline)*1000)save();
}
