(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', {alpha:true});
  const fileInput = document.getElementById('fileInput');
  const zoomRange = document.getElementById('zoomRange');
  const zoomVal = document.getElementById('zoomVal');
  const lockRatio = document.getElementById('lockRatio');
  const resetBtn = document.getElementById('resetBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const frameInfo = document.getElementById('frameInfo');

  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const rotateLeftBtn = document.getElementById('rotateLeft');
  const rotateRightBtn = document.getElementById('rotateRight');
  const moveUpBtn = document.getElementById('moveUp');
  const moveDownBtn = document.getElementById('moveDown');
  const moveLeftBtn = document.getElementById('moveLeft');
  const moveRightBtn = document.getElementById('moveRight');

  // state
  let overlayImg = new Image(); // psb.png overlay (foreground)
  let userImg = new Image();    // uploaded image
  let hasUser = false;
  let frameBox = null; // {x,y,w,h} area transparent in overlay (in canvas coords)

  // transform for user image
  let tx = 0, ty = 0, scale = 1, rotation = 0;
  let origImgW = 0, origImgH = 0;

  // interaction
  let dragging = false, dragStart = {x:0,y:0}, lastPos = {x:0,y:0};

  // touch pinch
  let touchState = {pinch:false, startDist:0, startScale:1, center:{x:0,y:0}};

  // utility: get canvas pixel data from Image (used to detect transparent area)
  function detectTransparentArea(img){
    // draw to temp canvas (same size as our canvas after overlay load)
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext('2d', {alpha:true});
    // draw overlay scaled to canvas
    tctx.clearRect(0,0,tmp.width,tmp.height);
    tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
    // read pixels
    const data = tctx.getImageData(0,0,tmp.width,tmp.height).data;
    const w = tmp.width, h = tmp.height;
    let minX=w, minY=h, maxX=0, maxY=0;
    let found=false;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        const idx = (y*w + x)*4 + 3; // alpha channel
        const a = data[idx];
        // consider pixel transparent if alpha < 15 (near transparent)
        if(a < 15){
          found = true;
          if(x < minX) minX = x;
          if(y < minY) minY = y;
          if(x > maxX) maxX = x;
          if(y > maxY) maxY = y;
        }
      }
    }
    if(!found) return null;
    // return bounding box in canvas coords
    return { x: minX, y: minY, w: (maxX-minX+1), h: (maxY-minY+1) };
  }

  // load overlay psb.png
  overlayImg.onload = () => {
    // set canvas size to overlay intrinsic ratio but keep max width limit
    const maxW = 1000;
    const ratio = overlayImg.width / overlayImg.height;
    let w = overlayImg.width, h = overlayImg.height;
    if(w > maxW){
      w = maxW; h = Math.round(maxW / ratio);
    }
    canvas.width = w;
    canvas.height = h;

    // detect transparent box
    frameBox = detectTransparentArea(overlayImg);
    if(frameBox){
      frameInfo.textContent = `Frame terdeteksi: x=${frameBox.x}, y=${frameBox.y}, w=${frameBox.w}, h=${frameBox.h}`;
    } else {
      frameInfo.textContent = `Tidak ada area transparan terdeteksi. Menggunakan frame penuh (${canvas.width}×${canvas.height}).`;
      frameBox = { x:0, y:0, w:canvas.width, h:canvas.height };
    }

    resetTransforms();
    render();
  };
  overlayImg.onerror = () => {
    frameInfo.textContent = 'Gagal memuat psb.png. Pastikan file ada di folder yang sama.';
  };
    overlayImg.src = '/template/psb.png?v=' + Date.now();

  // reset transforms and center user image into frame
  function resetTransforms() {
    tx = canvas.width/2;
    ty = canvas.height/2;
    scale = 1;
    rotation = 0;
    if(hasUser){
      autoFitToFrame();
    }
    zoomRange.value = scale;
    zoomVal.textContent = Math.round(scale*100) + '%';
  }

  // auto fit userImg so it covers frameBox (cover mode) while preserving aspect ratio
  function autoFitToFrame(){
    if(!hasUser || !frameBox) return;
    const fw = frameBox.w, fh = frameBox.h;
    const iw = origImgW, ih = origImgH;
    // scale so image covers the frame (cover)
    const scaleW = fw / iw;
    const scaleH = fh / ih;
    const s = Math.max(scaleW, scaleH);
    scale = s;
    // place center of user image to center of frame
    tx = frameBox.x + frameBox.w/2;
    ty = frameBox.y + frameBox.h/2;
    zoomRange.value = scale;
    zoomVal.textContent = Math.round(scale*100) + '%';
    render();
  }

  // render pipeline: draw user image with transform, then overlay
  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // background neutral
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    if(hasUser){
      ctx.save();
      // move to center point tx,ty
      ctx.translate(tx, ty);
      ctx.rotate(rotation * Math.PI/180);
      ctx.scale(scale, scale);
      // draw image centered at origin
      ctx.drawImage(userImg, -origImgW/2, -origImgH/2, origImgW, origImgH);
      ctx.restore();
    }

    // draw overlay on top
    ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);

    // optionally show frame box
    if(frameBox){
      ctx.save();
      ctx.strokeStyle = 'rgba(37,99,235,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6,6]);
      ctx.strokeRect(frameBox.x+0.5, frameBox.y+0.5, frameBox.w, frameBox.h);
      ctx.restore();
    }
  }

  // helper: screen coordinate -> canvas coordinate
  function screenToCanvas(clientX, clientY){
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return {x,y};
  }

  // mouse interactions: drag image
  canvas.addEventListener('mousedown', (e) => {
    if(!hasUser) return;
    dragging = true;
    const pt = screenToCanvas(e.clientX, e.clientY);
    dragStart.x = pt.x;
    dragStart.y = pt.y;
    lastPos.x = tx; lastPos.y = ty;
    canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if(!dragging) return;
    const pt = screenToCanvas(e.clientX, e.clientY);
    const dx = pt.x - dragStart.x;
    const dy = pt.y - dragStart.y;
    tx = lastPos.x + dx;
    ty = lastPos.y + dy;
    render();
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    canvas.style.cursor = 'default';
  });

  // wheel zoom (zoom toward cursor)
  canvas.addEventListener('wheel', (e) => {
    if(!hasUser) return;
    e.preventDefault();
    const delta = - e.deltaY;
    const factor = delta>0 ? 1.08 : 0.92;
    const rectPt = screenToCanvas(e.clientX, e.clientY);

    // zoom around rectPt
    const beforeX = (rectPt.x - tx) / scale;
    const beforeY = (rectPt.y - ty) / scale;

    scale = clamp(scale * factor, 0.05, 10);

    const afterX = beforeX * scale;
    const afterY = beforeY * scale;

    // adjust tx,ty so that rectPt stays stationary
    tx += (rectPt.x - (tx + afterX - beforeX*scale)) - (0); // simplified below
    // simpler formula:
    tx = rectPt.x - beforeX*scale;
    ty = rectPt.y - beforeY*scale;

    zoomRange.value = scale;
    zoomVal.textContent = Math.round(scale*100) + '%';
    render();
  }, {passive:false});

  // simpler zoom via functions
  function setScaleCenteredAt(newScale, center){
    if(!hasUser) return;
    // center in canvas coords
    if(center==null){ center = {x: canvas.width/2, y: canvas.height/2}; }
    const beforeX = (center.x - tx) / scale;
    const beforeY = (center.y - ty) / scale;
    scale = clamp(newScale, 0.02, 20);
    tx = center.x - beforeX*scale;
    ty = center.y - beforeY*scale;
    zoomRange.value = scale;
    zoomVal.textContent = Math.round(scale*100) + '%';
    render();
  }

  // buttons & controls
  zoomRange.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    setScaleCenteredAt(val, {x: canvas.width/2, y: canvas.height/2});
  });

  zoomInBtn.addEventListener('click', ()=> setScaleCenteredAt(scale*1.12));
  zoomOutBtn.addEventListener('click', ()=> setScaleCenteredAt(scale/1.12));
  rotateLeftBtn.addEventListener('click', ()=> { rotation -= 15; render(); });
  rotateRightBtn.addEventListener('click', ()=> { rotation += 15; render(); });

  const nudgeAmount = 8;
  moveUpBtn.addEventListener('click', ()=> { ty -= nudgeAmount; render(); });
  moveDownBtn.addEventListener('click', ()=> { ty += nudgeAmount; render(); });
  moveLeftBtn.addEventListener('click', ()=> { tx -= nudgeAmount; render(); });
  moveRightBtn.addEventListener('click', ()=> { tx += nudgeAmount; render(); });

  // keyboard nudges
  window.addEventListener('keydown', (e) => {
    if(!hasUser) return;
    if(e.key === 'ArrowLeft'){ tx -= 5; render(); e.preventDefault(); }
    if(e.key === 'ArrowRight'){ tx += 5; render(); e.preventDefault(); }
    if(e.key === 'ArrowUp'){ ty -= 5; render(); e.preventDefault(); }
    if(e.key === 'ArrowDown'){ ty += 5; render(); e.preventDefault(); }
    if(e.key === ' '){ e.preventDefault(); } // avoid page scroll
  });

// file upload
fileInput.addEventListener('change', (ev) => {
  const f = ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      userImg = img;
      hasUser = true;
      origImgW = img.width;
      origImgH = img.height;
      autoFitToFrame();
      render();
    };
    img.onerror = ()=> alert('Gagal memuat gambar.');
    img.src = e.target.result; // ini data: bukan blob:
  };
  reader.readAsDataURL(f);
});

  // reset button
  resetBtn.addEventListener('click', () => {
    if(hasUser) autoFitToFrame();
    rotation = 0;
    render();
  });

  // download result
  downloadBtn.addEventListener('click', () => {
    // create offscreen canvas same size
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const octx = out.getContext('2d');

    // draw white bg (optional)
    octx.fillStyle = '#ffffff';
    octx.fillRect(0,0,out.width,out.height);

    if(hasUser){
      octx.save();
      octx.translate(tx, ty);
      octx.rotate(rotation * Math.PI/180);
      octx.scale(scale, scale);
      octx.drawImage(userImg, -origImgW/2, -origImgH/2, origImgW, origImgH);
      octx.restore();
    }

    // draw overlay
    octx.drawImage(overlayImg, 0, 0, out.width, out.height);

    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = 'bagikan-informasi-alyusro.png';
    a.click();
  });

  // touch: drag & pinch-to-zoom
  canvas.addEventListener('touchstart', (e) => {
    if(e.touches.length === 1){
      // single finger drag
      dragging = true;
      const t = e.touches[0];
      const pt = screenToCanvas(t.clientX, t.clientY);
      dragStart.x = pt.x; dragStart.y = pt.y;
      lastPos.x = tx; lastPos.y = ty;
    } else if(e.touches.length === 2 && hasUser){
      touchState.pinch = true;
      const t0 = e.touches[0], t1 = e.touches[1];
      touchState.startDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      touchState.startScale = scale;
      // center point in canvas coords
      const rect = canvas.getBoundingClientRect();
      const cx = ((t0.clientX + t1.clientX)/2 - rect.left) * (canvas.width / rect.width);
      const cy = ((t0.clientY + t1.clientY)/2 - rect.top) * (canvas.height / rect.height);
      touchState.center = {x:cx,y:cy};
    }
  }, {passive:false});

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if(dragging && e.touches.length === 1){
      const t = e.touches[0];
      const pt = screenToCanvas(t.clientX, t.clientY);
      const dx = pt.x - dragStart.x;
      const dy = pt.y - dragStart.y;
      tx = lastPos.x + dx;
      ty = lastPos.y + dy;
      render();
    } else if(touchState.pinch && e.touches.length === 2){
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const ratio = dist / touchState.startDist;
      setScaleCenteredAt(touchState.startScale * ratio, touchState.center);
    }
  }, {passive:false});

  canvas.addEventListener('touchend', (e) => {
    if(e.touches.length === 0){ dragging=false; touchState.pinch=false; }
  });

  // helpers
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // initial render fallback while loading overlay
  ctx.fillStyle='#f3f4f6';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#94a3b8';
  ctx.font = '16px sans-serif';
  ctx.textAlign='center';
  ctx.fillText('Memuat psb.png ...', canvas.width/2, canvas.height/2);

})();
