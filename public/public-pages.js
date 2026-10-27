const form = document.querySelector('#name-conversion');
form?.addEventListener('submit',async event=>{
 event.preventDefault();const result=document.querySelector('#conversion-result');result.textContent='Memproses…';
 try{const r=await fetch('/api/konversi-nama-latin-to-arabic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nama_latin:form.elements.nama_latin.value})});const data=await r.json();result.textContent=data.nama_arab||data.message;}catch{result.textContent='Koneksi gagal. Coba lagi.';}
});
const canvas=document.querySelector('#greeting-canvas');
if(canvas){
 const image=new Image();const context=canvas.getContext('2d');const name=document.querySelector('#greeting-name');const status=document.querySelector('#greeting-status');const button=document.querySelector('#greeting-download');button.disabled=true;
 const draw=()=>{context.drawImage(image,0,0);context.fillStyle=canvas.dataset.color;let size=Math.round(canvas.width*.027);context.font=`bold ${size}px Georgia`;while(context.measureText(name.value||'Nama Anda').width>canvas.width*.88&&size>8){size--;context.font=`bold ${size}px Georgia`;}context.textAlign='center';context.fillText(name.value||'Nama Anda',canvas.width/2,canvas.height*Number(canvas.dataset.y));};
 image.onload=()=>{canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;draw();button.disabled=false;};image.onerror=()=>{status.textContent='Template belum tersedia.';};image.src=canvas.dataset.image;
 name.addEventListener('input',()=>{if(image.complete&&image.naturalWidth)draw();});
 button.addEventListener('click',()=>{const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download='alyusro-'+location.pathname.split('/').at(-1)+'.png';a.click();});
}
const shorten=document.querySelector('#shortener-form');
shorten?.addEventListener('submit',async event=>{event.preventDefault();const result=document.querySelector('#short-result');const button=shorten.querySelector('button');button.disabled=true;try{const response=await fetch('/shorten',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:shorten.elements.url.value,slug:shorten.elements.slug.value})});const body=await response.json();result.replaceChildren();if(response.ok){const a=document.createElement('a');a.href=body.short_url;a.textContent=location.origin+body.short_url;result.append(a);}else result.textContent=body.message;}catch{result.textContent='Koneksi gagal.';}finally{button.disabled=false;}});
const seo=document.querySelector('#seo-form');
seo?.addEventListener('submit',event=>{event.preventDefault();const target=new URL(seo.elements.url.value);if(!['https:','http:'].includes(target.protocol))return;window.open('https://pagespeed.web.dev/analysis?url='+encodeURIComponent(target.href),'_blank','noopener,noreferrer');});
const remove=document.querySelector('#remove-bg');
remove?.addEventListener('submit',async event=>{event.preventDefault();const button=remove.querySelector('button');const result=document.querySelector('#bg-result');const file=remove.elements.file.files[0];if(file.size>2*1024*1024){result.textContent='Maksimal 2 MB.';return;}button.disabled=true;result.textContent='Memproses…';try{const r=await fetch('/app/hapus-bg',{method:'POST',body:new FormData(remove)});const data=await r.json();if(!r.ok)throw Error(data.message);const a=document.createElement('a');a.href='data:image/png;base64,'+data.image_base64;a.download='alyusro-tanpa-background.png';a.textContent='Unduh hasil PNG';result.replaceChildren(a);}catch(error){result.textContent=error.message;}finally{button.disabled=false;}});
