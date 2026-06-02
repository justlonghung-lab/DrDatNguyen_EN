
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const state = { data:null, reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches, facilityIndex:0, galleryType:null, galleryIndex:0, baPosition:50, parallaxItems:[] };
document.addEventListener('DOMContentLoaded', init);

async function init(){
  document.body.classList.add('preloading');
  try{
    state.data = await fetch('data.json?v=loaderfix2').then(r=>{ if(!r.ok) throw new Error('data.json '+r.status); return r.json(); });
    render();
  }catch(err){ console.warn('Static hero fallback is running because data could not be loaded:', err); }

  setupReveal(); setupHeader(); setupProgress(); setupCanvas(); setupParallax(); setupBackTop(); setupServiceModal(); setupTechModal(); setupGalleryModal(); setupFacilitySlider(); setupForm();

  await runAssetPreloader();
  revealSiteAfterAssets();
}

function forceFirstFold(){
  const selectors = ['.site-header','#home','#home .hero-grid','#home .hero-media','#home .hero-copy','#home .hero-card','#home .ticker-shell'];
  selectors.forEach(s=> $$(s).forEach(el=>{ el.style.opacity='1'; el.style.visibility='visible'; el.style.transform='none'; el.style.filter='none'; }));
  const header=$('.site-header'); if(header){ header.style.position='relative'; header.style.top='auto'; header.style.bottom='auto'; header.style.margin='14px auto 0'; }
  if(!location.hash && scrollY>4) scrollTo({top:0,behavior:'auto'});
}

function revealSiteAfterAssets(){
  document.body.classList.add('site-ready','assets-loaded');
  document.body.classList.remove('preloading');
  forceFirstFold();
  setTimeout(()=>{ const loader=$('#assetLoader'); if(loader) loader.remove(); }, 900);
}

function wait(ms){ return new Promise(resolve=>setTimeout(resolve, ms)); }

function extractAssetUrlsFromData(value, set=new Set()){
  if(!value) return set;
  if(typeof value === 'string'){
    if(/^assets\//.test(value) && /\.(webp|svg|mp4)(\?.*)?$/i.test(value)) set.add(value);
    return set;
  }
  if(Array.isArray(value)){ value.forEach(item=>extractAssetUrlsFromData(item,set)); return set; }
  if(typeof value === 'object'){ Object.values(value).forEach(item=>extractAssetUrlsFromData(item,set)); }
  return set;
}

function collectLandingAssetUrls(){
  const urls = new Set();
  const add = value => { if(value && /^assets\//.test(value) && /\.(webp|svg|mp4)(\?.*)?$/i.test(value)) urls.add(value); };

  /* Preload only visible/near-visible assets so loader does not trap users for a century. */
  $$('link[rel="preload"][href]').forEach(link => add(link.getAttribute('href')));
  $$('.site-header img[src], #home img[src], #home video[src], #home video[poster]').forEach(el => {
    add(el.getAttribute('src'));
    add(el.getAttribute('poster'));
  });

  if(state.data){
    add(state.data.doctor?.heroVideo);
    add(state.data.doctor?.heroImage);
    state.data.doctor?.socials?.forEach(item => add(item.icon));
    state.data.services?.forEach(item => add(item.image));
    state.data.technology?.forEach(item => add(item.main));
    state.data.customers?.categories?.forEach(item => add(item.cover));
    if(state.data.facility?.images?.[0]) add(state.data.facility.images[0]);
  }

  return [...urls].filter(Boolean);
}

function preloadOneAsset(url){
  const src = url;
  const core = url.split('?')[0].toLowerCase();
  const timeout = wait(2500).then(()=>({url, status:'timeout'}));
  let task;
  if(core.endsWith('.mp4')){
    task = Promise.resolve({url,status:'skipped-video'});
  }else{
    task = new Promise(resolve=>{
      const img = new Image();
      img.decoding = 'async';
      img.onload = ()=>resolve({url,status:'ok'});
      img.onerror = ()=>resolve({url,status:'error'});
      img.src = src;
      if(img.complete) resolve({url,status:'cached'});
    });
  }
  return Promise.race([task, timeout]);
}

async function preloadQueue(urls, onProgress, concurrency=8){
  let index=0, done=0;
  const total=Math.max(urls.length,1);
  const worker=async()=>{
    while(index < urls.length){
      const current = urls[index++];
      await preloadOneAsset(current);
      done++;
      onProgress?.(done,total);
    }
  };
  await Promise.all(Array.from({length:Math.min(concurrency, urls.length || 1)}, worker));
}

async function runAssetPreloader(){
  const bar = $('#assetLoaderProgress');
  const update=(done,total)=>{ if(bar) bar.style.width = `${Math.min(100, Math.round(done/total*100))}%`; };
  const urls = collectLandingAssetUrls();
  update(0, Math.max(urls.length,1));
  const preloadTask = preloadQueue(urls, update, 10);
  const minShow = wait(900);
  const hardLimit = wait(4200);
  await Promise.all([minShow, Promise.race([preloadTask, hardLimit])]);
  update(1,1);
}
function normalizeVimeoEmbed(url){
  try{
    const u=new URL(url, location.href);
    u.searchParams.set('title','0');
    u.searchParams.set('byline','0');
    u.searchParams.set('portrait','0');
    u.searchParams.set('badge','0');
    u.searchParams.set('dnt','1');
    u.searchParams.set('transparent','0');
    return u.toString();
  }catch(err){
    const join=url.includes('?')?'&':'?';
    return url+join+'title=0&byline=0&portrait=0&badge=0&dnt=1&transparent=0';
  }
}
function render(){
  const d=state.data; if(!d) return;
  const hv=$('#heroVideo'); if(hv) hv.src=d.doctor.heroVideo || d.doctor.heroImage || 'assets/doctor/AVT.mp4';
  const nameEl=$('#doctorName');
  if(nameEl){
    nameEl.classList.add('doctor-name-split');
    nameEl.innerHTML='<span class="name-line">DR Nguyen</span><span class="name-line">Tien Dat</span>';
  }
  $('#doctorSummary').textContent=d.doctor.summary || $('#doctorSummary').textContent;
  if(d.doctor.socials) $('#socialCtas').innerHTML=d.doctor.socials.map((item,idx)=>`<a class="social-pill ${idx===0?'primary':''}" href="${item.url}" target="_blank" rel="noopener"><img src="${item.icon}" alt="${item.label}"><span>${item.label}</span></a>`).join('');
  if(d.doctor.credentials) $('#credentialGrid').innerHTML=d.doctor.credentials.map(item=>`<div class="credential-item">${item}</div>`).join('');
  if(d.ticker) $('#tickerTrack').innerHTML=Array.from({length:8},()=>d.ticker).flat().map(item=>`<div class="ticker-item"><span class="ticker-dot"></span><span>${item}</span></div>`).join('');
  $('#serviceGrid').innerHTML=d.services.map(item=>`<article class="service-card reveal-section"><div class="card-thumb"><img src="${item.image}" alt="${item.title}" loading="lazy" decoding="async"></div><h3>${item.title}</h3><p>${item.subtitle}</p><button type="button" class="card-action" data-open-service="${item.id}">View Process</button></article>`).join('');
  $('#serviceSelect').innerHTML += d.services.map(item=>`<option value="${item.title}">${item.title}</option>`).join('');
  $('#techGrid').innerHTML=d.technology.map(item=>`<article class="tech-card reveal-section"><div class="card-thumb"><img src="${item.main}" alt="${item.name}" loading="lazy" decoding="async"></div><span class="tech-tag">${item.category}</span><h3>${item.name}</h3><p>${item.description}</p><button type="button" class="card-action" data-open-tech="${item.id}">View Device Info</button></article>`).join('');
  $('#facilityTitle').textContent=d.facility.title; $('#facilityAddress').textContent=d.facility.address; $('#facilityDescription').textContent=d.facility.description; $('#facilityList').innerHTML=d.facility.items.map(item=>`<li>${item}</li>`).join(''); renderFacilitySlide(false);
  $('#categoryGrid').innerHTML=d.customers.categories.map(item=>`<article class="category-card reveal-section"><div class="card-thumb"><img src="${item.cover}" alt="${item.label}" loading="lazy" decoding="async"></div><h3>${item.label}</h3><p>Click to view more details.</p><button type="button" class="card-action" data-open-gallery="${item.id}">View More</button></article>`).join('');
  $('#pressList').innerHTML=d.media.articles.map(article=>`<a class="press-item" href="${article.url}" target="_blank" rel="noopener"><strong>${article.title}</strong><span class="press-source">${article.source}</span></a>`).join(''); const vf=$('#vimeoFrame'); if(vf) vf.src=normalizeVimeoEmbed(d.media.vimeoEmbed);
}
function setupReveal(){ const obs=new IntersectionObserver(entries=>{entries.forEach(e=>e.target.classList.toggle('visible',e.isIntersecting));},{threshold:.14,rootMargin:'0px 0px -8% 0px'}); $$('.reveal-section').forEach(el=>obs.observe(el)); }
function setupHeader(){ const nav=$('.nav'), toggle=$('.menu-toggle'), links=$$('.nav a'); if(toggle) toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open));}); links.forEach(link=>link.addEventListener('click',()=>nav.classList.remove('open'))); addEventListener('scroll',()=>{let current='home'; $$('main section[id]').forEach(sec=>{ if(scrollY>=sec.offsetTop-180) current=sec.id;}); links.forEach(link=>link.classList.toggle('active', link.getAttribute('href')==='#'+current || (current==='home'&&link.getAttribute('href')==='#intro')));},{passive:true}); }
function setupProgress(){ const bar=$('.scroll-progress'); addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight; if(bar) bar.style.width=`${max?(scrollY/max)*100:0}%`;},{passive:true}); }
function setupCanvas(){ if(state.reduceMotion) return; const canvas=$('#motionCanvas'); if(!canvas) return; const ctx=canvas.getContext('2d'); let blobs=[], strands=[]; function resize(){const dpr=Math.min(devicePixelRatio||1,2); canvas.width=innerWidth*dpr; canvas.height=innerHeight*dpr; canvas.style.width=innerWidth+'px'; canvas.style.height=innerHeight+'px'; ctx.setTransform(dpr,0,0,dpr,0,0); blobs=Array.from({length:24},(_,i)=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:36+Math.random()*96,vx:(Math.random()-.5)*.16,vy:(Math.random()-.5)*.16,color:i%2?'rgba(181,82,146,.13)':'rgba(249,212,159,.08)'})); strands=Array.from({length:8},()=>({points:Array.from({length:4},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight})),dx:(Math.random()-.5)*.07,dy:(Math.random()-.5)*.07}));} function frame(){ctx.clearRect(0,0,innerWidth,innerHeight); blobs.forEach(b=>{b.x+=b.vx;b.y+=b.vy;if(b.x<-120||b.x>innerWidth+120)b.vx*=-1;if(b.y<-120||b.y>innerHeight+120)b.vy*=-1;const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);g.addColorStop(0,b.color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}); strands.forEach(s=>{s.points.forEach(p=>{p.x+=s.dx;p.y+=s.dy;if(p.x<-80)p.x=innerWidth+80;if(p.x>innerWidth+80)p.x=-80;if(p.y<-80)p.y=innerHeight+80;if(p.y>innerHeight+80)p.y=-80;});const [a,b,c,d]=s.points;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(b.x,b.y,c.x,c.y,d.x,d.y);ctx.strokeStyle='rgba(249,212,159,.045)';ctx.lineWidth=1;ctx.stroke();});requestAnimationFrame(frame);} resize(); addEventListener('resize',resize); frame(); }
function setupParallax(){ if(state.reduceMotion) return; state.parallaxItems=$$('.parallax-item').map(el=>({el,speed:parseFloat(el.dataset.parallax||'.08'),current:0,target:0})); const update=()=>state.parallaxItems.forEach(item=>{const r=item.el.getBoundingClientRect(); item.target=(r.top-innerHeight/2)*item.speed*-0.14;}); const loop=()=>{state.parallaxItems.forEach(item=>{item.current+=(item.target-item.current)*.08; item.el.style.transform=`translate3d(0,${item.current}px,0)`;}); requestAnimationFrame(loop);}; addEventListener('scroll',update,{passive:true}); addEventListener('resize',update); update(); loop(); }
function setupBackTop(){ const btn=$('#backTop'); if(!btn) return; addEventListener('scroll',()=>btn.classList.toggle('show',scrollY>620),{passive:true}); btn.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'})); }
function openModal(id){ const m=$('#'+id); if(!m) return; m.classList.add('active'); m.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open'); }
function closeModal(id){ const m=$('#'+id); if(!m) return; m.classList.remove('active'); m.setAttribute('aria-hidden','true'); document.body.classList.remove('modal-open'); }
document.addEventListener('click',e=>{ const close=e.target.getAttribute('data-close'); if(close) closeModal(close); }); document.addEventListener('keydown',e=>{ if(e.key==='Escape') $$('.modal.active').forEach(m=>closeModal(m.id)); });
function setupServiceModal(){ document.addEventListener('click',e=>{ const btn=e.target.closest('[data-open-service]'); if(!btn || !state.data) return; e.preventDefault(); const item=state.data.services.find(s=>s.id===btn.dataset.openService); if(!item)return; $('#serviceEyebrow').textContent=item.subtitle; $('#serviceTitle').textContent=item.title; $('#serviceDescription').textContent=item.description; $('#serviceImage').src=item.image; $('#serviceSteps').innerHTML=item.steps.map((step,i)=>`<article class="step-item"><div class="step-num">${String(i+1).padStart(2,'0')}</div><div><h4>${step}</h4></div></article>`).join(''); openModal('serviceModal'); }); }
function setupTechModal(){ document.addEventListener('click',e=>{ const btn=e.target.closest('[data-open-tech]'); if(!btn || !state.data) return; e.preventDefault(); const item=state.data.technology.find(s=>s.id===btn.dataset.openTech); if(!item)return; $('#techEyebrow').textContent=item.category; $('#techTitle').textContent=item.name; $('#techDescription').textContent=item.description; $('#techImage').src=item.broll; $('#techDetails').innerHTML=item.details.map(t=>`<li>${t}</li>`).join(''); openModal('techModal'); }); }
function setupFacilitySlider(){ const prev=$('#facilityPrev'), next=$('#facilityNext'); if(prev) prev.addEventListener('click',()=>changeFacility(-1)); if(next) next.addEventListener('click',()=>changeFacility(1)); setInterval(()=>{ if(!state.data) return; const sec=$('#facility').getBoundingClientRect(); if(document.hidden||sec.bottom<0||sec.top>innerHeight)return; changeFacility(1,false); },2000); }
function changeFacility(delta,user=true){ const imgs=state.data.facility.images; state.facilityIndex=(state.facilityIndex+delta+imgs.length)%imgs.length; renderFacilitySlide(user); }
function renderFacilitySlide(animated=true){ if(!state.data) return; const imgs=state.data.facility.images, img=$('#facilityStage'); if(!img) return; if(animated){img.style.opacity='0';img.style.transform='scale(1.08)';} setTimeout(()=>{img.src=imgs[state.facilityIndex];img.style.opacity='1';img.style.transform='scale(1.02)';},animated?110:0); $('#facilityDots').innerHTML=imgs.map((_,i)=>`<button class="slider-dot ${i===state.facilityIndex?'active':''}" data-facility-dot="${i}" type="button" aria-label="Image ${i+1}"></button>`).join(''); $$('.slider-dot',$('#facilityDots')).forEach(dot=>dot.addEventListener('click',()=>{state.facilityIndex=+dot.dataset.facilityDot;renderFacilitySlide();})); }
function setupGalleryModal(){ document.addEventListener('click',e=>{ const btn=e.target.closest('[data-open-gallery]'); if(!btn || !state.data)return; e.preventDefault(); state.galleryType=btn.dataset.openGallery; state.galleryIndex=0; state.baPosition=50; renderGallery(); openModal('galleryModal'); }); }
function renderGallery(){ const type=state.galleryType, body=$('#galleryBody'), cat=state.data.customers.categories.find(c=>c.id===type); $('#galleryTitle').textContent=cat.label; if(type==='ba'){ const item=state.data.customers.ba[state.galleryIndex]; body.innerHTML=`<div class="ba-shell"><div class="ba-stage" id="baStage"><img src="${item.before}" class="ba-before" alt="Before" loading="lazy" decoding="async"><img src="${item.after}" class="ba-after" alt="After" loading="lazy" decoding="async"><div class="ba-divider"></div><div class="ba-handle">↔</div><button class="ba-side prev" id="galleryPrev" type="button" aria-label="Previous case">‹</button><button class="ba-side next" id="galleryNext" type="button" aria-label="Next case">›</button></div><input class="ba-range" id="baRange" type="range" min="0" max="100" value="${state.baPosition}" aria-label="Drag to compare before and after"></div>`; attachBaInteractions(); } else { const list=state.data.customers[type], src=list[state.galleryIndex]; body.innerHTML=`<div class="gallery-shell"><div class="gallery-stage"><img src="${src}" alt="${cat.label}" loading="lazy" decoding="async"><button class="gallery-side prev" id="galleryPrev" type="button" aria-label="Previous image">‹</button><button class="gallery-side next" id="galleryNext" type="button" aria-label="Next image">›</button></div></div>`; $('#galleryPrev').addEventListener('click',e=>{e.preventDefault();changeGallery(-1)}); $('#galleryNext').addEventListener('click',e=>{e.preventDefault();changeGallery(1)}); } }
function attachBaInteractions(){ const stage=$('#baStage'), range=$('#baRange'), after=$('.ba-after',stage), divider=$('.ba-divider',stage), handle=$('.ba-handle',stage), prev=$('#galleryPrev'), next=$('#galleryNext'); const sync=()=>{const v=Math.max(0,Math.min(100,Number(range.value)));state.baPosition=v;after.style.clipPath=`inset(0 ${100-v}% 0 0)`;divider.style.left=`${v}%`;handle.style.left=`${v}%`;}; const setX=x=>{const r=stage.getBoundingClientRect(); range.value=Math.max(0,Math.min(100,((x-r.left)/r.width)*100)); sync();}; let dragging=false; const end=e=>{dragging=false; try{stage.releasePointerCapture?.(e?.pointerId)}catch{}}; stage.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return; dragging=true; stage.setPointerCapture?.(e.pointerId); setX(e.clientX);}); stage.addEventListener('pointermove',e=>{if(dragging)setX(e.clientX)}); stage.addEventListener('pointerup',end); stage.addEventListener('pointercancel',end); range.addEventListener('input',sync); prev.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();dragging=false;changeGallery(-1)}); next.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();dragging=false;changeGallery(1)}); sync(); }
function changeGallery(delta){ const len=state.galleryType==='ba'?state.data.customers.ba.length:state.data.customers[state.galleryType].length; state.galleryIndex=(state.galleryIndex+delta+len)%len; if(state.galleryType==='ba')state.baPosition=50; renderGallery(); }
function setupForm(){ const form=$('#consultForm'); if(!form) return; form.addEventListener('submit',e=>{e.preventDefault();localStorage.setItem('bsdat_consult_latest',JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries())));$('#formStatus').textContent='Your information has been recorded. The consultation team will contact you soon.';e.currentTarget.reset();}); }
