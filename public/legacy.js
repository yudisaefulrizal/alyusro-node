document.querySelectorAll('.slideshow-container').forEach(container => {
 const slides = [...container.querySelectorAll('.slides')]; let current = 0;
 for (const [selector,delta] of [['.prev',-1],['.next',1]]) {const button=container.querySelector(selector); button.hidden=slides.length<2; button.addEventListener('click',()=>{slides[current].hidden=true;current=(current+delta+slides.length)%slides.length;slides[current].hidden=false;});}
});
document.querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.classList.add('missing-image'); img.alt = img.alt || 'Gambar belum tersedia di penyimpanan lokal'; }, {once:true}));
