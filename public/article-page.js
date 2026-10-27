const article=document.querySelector('.article-detail');
if(article){
 const status=article.querySelector('#article-action-status');const copy=article.querySelector('#copy-url-btn');
 // Share the current development host, unless PUBLIC_URL explicitly supplied by the server.
 const target=new URL(copy.dataset.url);if(target.hostname==='127.0.0.1'&&target.port==='8075'){target.host=location.host;target.protocol=location.protocol;}
 copy.dataset.url=target.href;
 article.querySelector('[data-share="whatsapp"]').href='https://api.whatsapp.com/send?text='+encodeURIComponent(article.querySelector('.judul_artikel').textContent+' - '+target.href);
 article.querySelector('[data-share="facebook"]').href='https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(target.href);
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(copy.dataset.url);status.textContent='URL artikel telah disalin.';}catch{status.textContent='Belum dapat menyalin otomatis. Salin alamat berikut: '+copy.dataset.url;}});
 const like=article.querySelector('#article-like');const key='alyusro-liked:'+article.dataset.slug;
 try{like.setAttribute('aria-pressed',String(localStorage.getItem(key)==='1'));}catch{}
 like.addEventListener('click',()=>{const selected=like.getAttribute('aria-pressed')!=='true';try{if(selected)localStorage.setItem(key,'1');else localStorage.removeItem(key);like.setAttribute('aria-pressed',String(selected));status.textContent=selected?'Disukai di perangkat ini. Statistik database tetap mengikuti sistem lama.':'Tanda suka di perangkat ini dibatalkan.';}catch{status.textContent='Penyimpanan browser tidak tersedia.';}});
}
