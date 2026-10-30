/* Ochrana proti clickjackingu (GitHub Pages nevie poslať X-Frame-Options a CSP frame-ancestors v <meta> nefunguje) */
if (window.top !== window.self) { document.documentElement.style.display = 'none'; try { window.top.location = window.location.href; } catch (e) {} }

/* ================================================================
   KONFIGURÁCIA — len verejné hodnoty. Všetko citlivé (webhooky,
   role, bot token) žije v Supabase Edge Function `web-api`.
   ================================================================ */
const SUPABASE_URL      = "https://xguynguhxnxhrrebjnrw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rWdMnwGN5piUrwcMis9ioQ_bUPQJv0y";
const DISCORD_INVITE_URL = "DOPLN_DISCORD_POZVANKA"; // voliteľné — odkaz pre nečlenov
const API_URL = SUPABASE_URL + "/functions/v1/web-api";
/* ================================================================ */


/* --- Téma (svetlá/tmavá) --- */
const LS_THEME = 'vetark_theme';
function applyTheme(t){
  if(t === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try{ localStorage.setItem(LS_THEME, t); }catch(e){}
  const label = t === 'dark' ? '☀ Svetlý režim' : '🌙 Tmavý režim';
  const hint = t === 'dark' ? 'Prepnúť na svetlý vzhľad stránky' : 'Prepnúť na tmavý vzhľad stránky';
  const a = document.getElementById('themeToggleTop');
  const b = document.getElementById('themeToggleGate');
  if(a){ a.textContent = label; a.title = hint; a.setAttribute('aria-label', hint); }
  if(b){ b.textContent = label; b.title = hint; b.setAttribute('aria-label', hint); }
}
applyTheme((()=>{ try{ return localStorage.getItem(LS_THEME); }catch(e){ return null; } })() || 'light');
if(!DISCORD_INVITE_URL.startsWith('DOPLN')){
  document.getElementById('gateInvite').style.display = 'block';
  document.getElementById('gateInviteLink').href = DISCORD_INVITE_URL;
}
function toggleTheme(){
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
document.getElementById('themeToggleTop').addEventListener('click', toggleTheme);
document.getElementById('themeToggleGate').addEventListener('click', toggleTheme);

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce' } });

const gate = document.getElementById('gate');
const app = document.getElementById('app');
const gateError = document.getElementById('gateError');
const toast = document.getElementById('toast');

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 1800);
}
function copyText(text){
  navigator.clipboard.writeText(text).then(()=>showToast('Skopírované ✓'))
    .catch(()=>showToast('Kopírovanie zlyhalo'));
}
function showError(msg){ gateError.style.display='block'; gateError.textContent = msg; }

function enterApp(name, avatarUrl){
  window.currentUserName = name;
  document.getElementById('userName').textContent = name;
  const av = document.getElementById('userAvatar');
  if(avatarUrl){ av.src = avatarUrl; } else { av.style.display='none'; }
  gate.style.display='none';
  app.style.display='block';
}

/* --- API vrstva: všetky dáta idú cez Edge Function web-api (overuje prihlásenie aj rolu) --- */
async function api(action, p){
  const { data: { session } } = await sb.auth.getSession();
  if(!session) throw new Error('Nie si prihlásený');
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token,
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ action, p: p || {} })
  });
  let j = null;
  try{ j = await res.json(); }catch(e){}
  if(!res.ok || !j || !j.ok) throw new Error((j && j.error) || ('Chyba servera ' + res.status));
  return j.data;
}
window.userRole = 'member';
function isVet(){ return window.userRole === 'vet'; }

function applyRoleVisibility(role){
  window.userRole = role;
  document.body.classList.toggle('internal-access', role === 'vet');
}

let sessionHandled = false;
async function handleSession(session){
  if(!session || sessionHandled) return;
  sessionHandled = true;
  try{
    // server overí členstvo na serveri + rolu (cez bota) a vráti profil
    const me = await api('me');
    applyRoleVisibility(me.role);
    enterApp(me.name, me.avatar);
    renderArticles().then(()=> renderHomeTeasers());
    renderDbPhotos().then(()=> renderHomeTeasers());
    if(isVet()){ renderPatList(); updateOrdBadge(); }
  }catch(e){
    sessionHandled = false;
    await sb.auth.signOut();
    showError(e.message === 'NOT_MEMBER'
      ? 'Tento Discord účet nie je členom serveru VET ARK. Požiadaj o pozvánku a skús to znova.'
      : 'Prihlásenie zlyhalo: ' + e.message);
  }
}

document.getElementById('btnLogin').addEventListener('click', async ()=>{
  await sb.auth.signInWithOAuth({
    provider: 'discord',
    options: { scopes: 'identify', redirectTo: window.location.origin + window.location.pathname, queryParams: { scope: 'identify' } }
  });
});

document.getElementById('btnLogout').addEventListener('click', async ()=>{
  await sb.auth.signOut();
  location.reload();
});

sb.auth.getSession().then(({data})=> handleSession(data.session));
sb.auth.onAuthStateChange((_e, session)=> handleSession(session));


/* --- Galéria lightbox (delegovaný — funguje aj pre nové fotky) --- */
const lb = document.getElementById('lightbox');
document.addEventListener('click', e=>{
  const f = e.target.closest('.gph');
  if(!f || e.target.closest('.ph-del')) return;
  document.getElementById('lbImg').src = f.querySelector('img').src;
  document.getElementById('lbCap').textContent = f.querySelector('figcaption') ? f.querySelector('figcaption').textContent : '';
  lb.classList.add('open');
});
lb.addEventListener('click', ()=> lb.classList.remove('open'));
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ lb.classList.remove('open'); document.getElementById('reader').classList.remove('open'); document.getElementById('privacy').classList.remove('open'); document.getElementById('evEdit').classList.remove('open'); } });


/* --- Ochrana osobných údajov --- */
document.getElementById('privacyOpen').addEventListener('click', ()=> document.getElementById('privacy').classList.add('open'));
document.getElementById('privacyClose').addEventListener('click', ()=> document.getElementById('privacy').classList.remove('open'));
document.getElementById('privacy').addEventListener('click', e=>{ if(e.target.id==='privacy') document.getElementById('privacy').classList.remove('open'); });

/* --- Články --- */
const ART_BUILTIN = [];

function artDate(d){ const dt = new Date(d); return isNaN(dt) ? '' : dt.toLocaleDateString('sk-SK'); }
function excerpt(b){ const first = (b||'').split(/\n\s*\n/)[0]; return first.length > 180 ? first.slice(0,180)+'…' : first; }

async function fetchArticles(){
  try{ return await api('articles.list'); }catch(e){ return []; }
}
let ALL_ARTICLES = [];
async function renderArticles(){
  const db = await fetchArticles();
  ALL_ARTICLES = db.concat(ART_BUILTIN);
  const list = document.getElementById('artList');
  list.innerHTML = ALL_ARTICLES.map(function(a,i){ return '<div class="art" data-art="'+esc(i)+'" tabindex="0" role="button">'
    + (a.id ? '<button class="art-del deletable" data-delart="'+esc(a.id)+'" title="Zmazať článok">×</button>' : '')
    + '<h3>'+esc(a.title)+'</h3>'
    + '<div class="art-meta">'+artDate(a.created_at)+(a.author ? ' · '+esc(a.author) : '')+'</div>'
    + '<div class="art-excerpt">'+esc(excerpt(a.body))+'</div></div>'; }).join('');
  document.getElementById('artEmpty').style.display = ALL_ARTICLES.length ? 'none' : 'block';
  document.querySelector('.tab[data-tab="clanky"]').classList.toggle('tab-nocontent', !ALL_ARTICLES.length);
}
document.getElementById('artList').addEventListener('click', async e=>{
  const del = e.target.closest('[data-delart]');
  if(del){
    if(!confirm('Zmazať tento článok?')) return;
    try{ await api('articles.delete', { id: del.dataset.delart }); showToast('Článok zmazaný'); renderArticles(); }
    catch(e){ showToast('Zmazanie zlyhalo'); }
    return;
  }
  const card = e.target.closest('[data-art]');
  if(!card) return;
  const a = ALL_ARTICLES[+card.dataset.art];
  document.getElementById('rdTitle').textContent = a.title;
  document.getElementById('rdMeta').textContent = [artDate(a.created_at), a.author].filter(Boolean).join(' · ');
  document.getElementById('rdBody').innerHTML = a.body.split(/\n\s*\n/).map(function(p){ return '<p>'+esc(p)+'</p>'; }).join('');
  document.getElementById('reader').classList.add('open');
});
document.querySelector('#reader .rd-close').addEventListener('click', ()=> document.getElementById('reader').classList.remove('open'));
document.getElementById('reader').addEventListener('click', e=>{ if(e.target.id==='reader') document.getElementById('reader').classList.remove('open'); });

document.getElementById('artAdd').addEventListener('click', ()=>{
  document.getElementById('artForm').classList.add('open');
  document.getElementById('artForm').scrollIntoView({behavior:'smooth'});
});
document.getElementById('artCancel').addEventListener('click', ()=> document.getElementById('artForm').classList.remove('open'));
document.getElementById('artSave').addEventListener('click', async ()=>{
  const title = document.getElementById('artTitle').value.trim();
  const body = document.getElementById('artBody').value.trim();
  if(!title || !body){ showToast('Doplň nadpis aj text'); return; }
  try{ await api('articles.create', { title, body }); }
  catch(e){ showToast('Uloženie zlyhalo: ' + e.message); return; }
  document.getElementById('artTitle').value=''; document.getElementById('artBody').value='';
  document.getElementById('artForm').classList.remove('open');
  showToast('Článok uverejnený ✓');
  renderArticles();
});

/* --- Fotky od členov --- */
async function renderDbPhotos(){
  let data = [];
  try{ data = await api('photos.list'); }catch(e){ data = []; }
  const gal = document.querySelector('.gal');
  document.querySelectorAll('.gph[data-dbid]').forEach(n=>n.remove());
  document.getElementById('galEmpty').style.display = data.length ? 'none' : 'block';
  document.querySelector('.tab[data-tab="galeria"]').classList.toggle('tab-nocontent', !data.length);
  data.forEach(p=>{
    const fig = document.createElement('figure');
    fig.className = 'gph'; fig.dataset.dbid = p.id;
    fig.innerHTML = '<button class="ph-del deletable" data-delph="'+esc(p.id)+'" title="Zmazať">×</button><img src="'+esc(p.url)+'" alt="" loading="lazy"><figcaption>'+esc(p.caption||'')+'</figcaption>';
    gal.appendChild(fig);
  });
}
document.addEventListener('click', async e=>{
  const del = e.target.closest('[data-delph]');
  if(!del) return;
  if(!confirm('Zmazať túto fotku?')) return;
  try{ await api('photos.delete', { id: del.dataset.delph }); showToast('Fotka zmazaná'); renderDbPhotos(); }
  catch(e){ showToast('Zmazanie zlyhalo'); }
});
document.getElementById('phAdd').addEventListener('click', ()=>{
  document.getElementById('phForm').classList.add('open');
  document.getElementById('phForm').scrollIntoView({behavior:'smooth'});
});
document.getElementById('phCancel').addEventListener('click', ()=> document.getElementById('phForm').classList.remove('open'));
document.getElementById('phSave').addEventListener('click', async ()=>{
  const file = document.getElementById('phFile').files[0];
  if(!file){ showToast('Vyber fotku'); return; }
  if(file.size > 4*1024*1024){ showToast('Fotka je príliš veľká (max 4 MB)'); return; }
  const b64 = await new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=> res(String(r.result).split(',')[1]);
    r.onerror = ()=> rej(new Error('Čítanie súboru zlyhalo'));
    r.readAsDataURL(file);
  });
  showToast('Nahrávam…');
  try{
    await api('photos.upload', { name: file.name, type: file.type, data: b64, caption: document.getElementById('phCap').value.trim() });
  }catch(e){ showToast('Nahranie zlyhalo: ' + e.message); return; }
  document.getElementById('phFile').value=''; document.getElementById('phCap').value='';
  document.getElementById('phForm').classList.remove('open');
  showToast('Fotka pridaná ✓');
  renderDbPhotos();
});



document.addEventListener('keydown', e=>{
  if(e.key === 'Enter' && e.target.matches('[data-open],[data-art],[data-rec],.gph')) e.target.click();
});
/* --- Taby --- */
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.section').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    t.scrollIntoView({block:'nearest', inline:'center', behavior:'smooth'});
    document.getElementById(t.dataset.tab).classList.add('active');
    window.scrollTo({top:0});
  });
});




/* --- Objednávky (zákaznícka časť) --- */
const KONTROLY = [
  'Vstupná prehliadka pre registráciu',
  'Preventívna prehliadka',
  'Profesná prehliadka pre pracovné psy',
  'Predoperačná a pooperačná kontrola',
  'Kontrola zdravotného stavu pri podozrení na problém'
];
const ZAKROKY = [
  'Čipovanie a kontrola čipu',
  'Očkovanie',
  'Odčervenie',
  'Základné ošetrenie rán a poranení',
  'Vyšetrenie po úrazoch v RP situáciách'
];
let bookingKind = 'Kontrola';
function openBooking(kind){
  bookingKind = kind;
  const isMsg = kind === 'Správa';
  ['wPet','wType','wWhen','wPlace'].forEach(id=> document.getElementById(id).style.display = isMsg ? 'none' : 'flex');
  document.getElementById('bNoteLabel').textContent = isMsg ? 'Správa / otázka' : 'Poznámka / popis problému';
  document.getElementById('bookingTitle').textContent = isMsg ? 'Napíšte nám' :
    ('Objednať ' + (kind === 'Kontrola' ? 'kontrolu' : 'zákrok'));
  if(!isMsg){
    const list = kind === 'Kontrola' ? KONTROLY : ZAKROKY;
    const sel = document.getElementById('bType');
    sel.innerHTML = list.map(o=>`<option>${o}</option>`).join('');
  }
  document.getElementById('booking').classList.add('open');
  document.getElementById('booking').scrollIntoView({behavior:'smooth', block:'start'});
}

document.querySelectorAll('[data-hero]').forEach(b=>{
  b.addEventListener('click', ()=> openBooking(
    b.dataset.hero === 'kontrola' ? 'Kontrola' : b.dataset.hero === 'zakrok' ? 'Zákrok' : 'Správa'));
});
document.getElementById('bGen').addEventListener('click', async ()=>{
  const v = id => document.getElementById(id).value.trim();
  const isMsg = bookingKind === 'Správa';
  const order = {
    kind: bookingKind,
    meno: v('bName'), kontakt: v('bContact'),
    milacik: isMsg ? '' : v('bPet'),
    typ: isMsg ? '' : document.getElementById('bType').value,
    cas: isMsg ? '' : v('bWhen'),
    miesto: isMsg ? '' : v('bPlace'),
    poznamka: v('bNote')
  };
  if(!order.meno){ showToast('Doplň meno klienta'); return; }
  try{
    await api('orders.create', order);
    showToast(isMsg ? 'Správa odoslaná ✓ Ozveme sa vám.' : 'Objednávka odoslaná ✓ Ozveme sa s termínom.');
    ['bName','bContact','bPet','bWhen','bPlace','bNote'].forEach(id=> document.getElementById(id).value='');
    document.getElementById('booking').classList.remove('open');
    if(isVet()) updateOrdBadge();
  }catch(e){
    showToast('Odoslanie zlyhalo: ' + e.message);
  }
});
/* dlaždice → prepnutie záložky */
document.querySelectorAll('[data-goto]').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelector(`.tab[data-tab="${t.dataset.goto}"]`).click();
  });
});




/* --- Verejný cenník (generuje sa z internej tabuľky) --- */
(function buildPublicPrices(){
  const src = document.getElementById('priceTable');
  const wrap = document.getElementById('pubPriceWrap');
  const t = document.createElement('table');
  t.innerHTML = '<thead><tr><th>Výkon</th><th style="text-align:right;width:140px">Cena</th></tr></thead>';
  const tb = document.createElement('tbody');
  src.querySelectorAll('tbody tr').forEach(r=>{
    const nr = document.createElement('tr');
    if(r.classList.contains('tbl-group')){
      nr.className = 'tbl-group';
      nr.innerHTML = '<td colspan="2">' + esc(r.cells[0].textContent) + '</td>';
    }else{
      nr.innerHTML = '<td>' + esc(r.cells[0].textContent) + '</td><td class="price">' + esc(r.cells[1].textContent) + '</td>';
    }
    tb.appendChild(nr);
  });
  t.appendChild(tb);
  wrap.appendChild(t);
})();

/* --- Živé náhľady na domove --- */
function renderHomeTeasers(){
  if(ALL_ARTICLES.length){
    const a = ALL_ARTICLES[0];
    document.getElementById('homeArtTitle').textContent = a.title;
    document.getElementById('homeArtExcerpt').textContent = excerpt(a.body);
    document.getElementById('homeArt').style.display = 'block';
  }
  const imgs = document.querySelectorAll('#galeria .gph img');
  if(imgs.length){
    const strip = document.getElementById('homePhotos');
    strip.innerHTML = '';
    Array.from(imgs).slice(0,3).forEach(im=>{
      const c = document.createElement('img');
      c.src = im.src; c.alt = im.alt || ''; c.loading = 'lazy';
      strip.appendChild(c);
    });
    document.getElementById('homePhotosWrap').style.display = 'block';
  }
}
document.getElementById('homeArt').addEventListener('click', ()=>{
  document.querySelector('.tab[data-tab="clanky"]').click();
});


/* ================= ŽIADOSTI (cez API, len veterinár) ================= */
async function dbOrders(){ try{ return await api('orders.list'); }catch(e){ return []; } }
async function dbAddOrder(o){ return api('orders.create', o); }
async function dbOrderStatus(id, status){ try{ await api('orders.status', { id, status }); return true; }catch(e){ return false; } }
async function dbDeleteOrder(id){ try{ await api('orders.delete', { id }); return true; }catch(e){ return false; } }
const ORD_KIND_CLASS = { 'Kontrola':'kontrola', 'Zákrok':'zakrok', 'Správa':'karta' };
function ordDate(d){ const t = new Date(d); return isNaN(t) ? '' : t.toLocaleDateString('sk-SK') + ' ' + t.toLocaleTimeString('sk-SK',{hour:'2-digit',minute:'2-digit'}); }
async function renderOrders(){
  const list = document.getElementById('ordList');
  const ords = await dbOrders();
  document.getElementById('ordEmpty').style.display = ords.length ? 'none' : 'block';
  list.innerHTML = ords.map(o=>{
    const lines = [];
    if(o.milacik) lines.push('<b>Miláčik:</b> ' + esc(o.milacik));
    if(o.typ) lines.push('<b>Typ:</b> ' + esc(o.typ));
    if(o.cas) lines.push('<b>Čas:</b> ' + esc(o.cas));
    if(o.miesto) lines.push('<b>Miesto:</b> ' + esc(o.miesto));
    if(o.poznamka) lines.push('<b>' + (o.kind==='Správa' ? 'Správa' : 'Poznámka') + ':</b> ' + esc(o.poznamka));
    const st = o.status === 'vybavena' ? 'vybavena' : 'nova';
    return `<div class="ord">
      <div class="ord-top">
        <span class="rec-type ${ORD_KIND_CLASS[o.kind]||'karta'}">${esc(o.kind)}</span>
        <span class="ord-date">${ordDate(o.created_at)}</span>
        <button class="ord-status ${st}" data-ost="${esc(o.id)}" data-cur="${st}">${st==='nova'?'Nová':'Vybavená'}</button>
        <button class="ord-del" data-odel="${esc(o.id)}" title="Zmazať">×</button>
      </div>
      <div class="ord-body"><b>Klient:</b> ${esc(o.meno)||'—'} · <b>Kontakt:</b> ${esc(o.kontakt)||'—'}${lines.length?'<br>'+lines.join('<br>'):''}</div>
    </div>`;
  }).join('');
}
document.getElementById('ordList').addEventListener('click', async e=>{
  const st = e.target.closest('[data-ost]');
  if(st){
    await dbOrderStatus(st.dataset.ost, st.dataset.cur === 'nova' ? 'vybavena' : 'nova');
    renderOrders(); updateOrdBadge(); return;
  }
  const del = e.target.closest('[data-odel]');
  if(del && confirm('Zmazať túto žiadosť?')){ await dbDeleteOrder(del.dataset.odel); renderOrders(); updateOrdBadge(); }
});
document.querySelector('.tab[data-tab="ziadosti"]').addEventListener('click', renderOrders);
async function updateOrdBadge(){
  if(!isVet()) return;
  const ords = await dbOrders();
  const n = ords.filter(o=>o.status !== 'vybavena').length;
  const b = document.getElementById('ordBadge');
  b.style.display = n ? 'inline-block' : 'none';
  b.textContent = n;
}


/* ================= KALENDÁR (cez API, len veterinár) ================= */
async function dbEvents(){ try{ return await api('events.list'); }catch(e){ return []; } }
async function dbAddEvent(ev){ try{ return await api('events.create', ev); }catch(e){ showToast('Uloženie zlyhalo'); return null; } }
async function dbUpdateEvent(id, ev){ try{ await api('events.update', { id, ...ev }); return true; }catch(e){ showToast('Uloženie zlyhalo'); return false; } }
async function dbDeleteEvent(id){ try{ await api('events.delete', { id }); return true; }catch(e){ return false; } }
const CAL_H0 = 7, CAL_H1 = 22, CAL_CELL = 36;
function mondayOf(d){
  const x = new Date(d); x.setHours(0,0,0,0);
  x.setDate(x.getDate() - ((x.getDay()+6)%7));
  return x;
}
let calMonday = mondayOf(new Date());
function isoDate(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
const DAY_N = ['Po','Ut','St','Št','Pi','So','Ne'];
let EV_CACHE = [];
async function renderCal(){
  EV_CACHE = await dbEvents();
  const days = [];
  for(let i=0;i<7;i++){ const d = new Date(calMonday); d.setDate(d.getDate()+i); days.push(d); }
  const todayIso = isoDate(new Date());
  document.getElementById('calRange').textContent =
    days[0].toLocaleDateString('sk-SK') + ' – ' + days[6].toLocaleDateString('sk-SK');
  let head = '<div class="c-head"></div>';
  days.forEach((d,i)=>{
    head += `<div class="c-head${isoDate(d)===todayIso?' today':''}">${DAY_N[i]}<small>${d.getDate()}.${d.getMonth()+1}.</small></div>`;
  });
  document.getElementById('calHead').innerHTML = head;
  let body = '<div class="c-timecol">';
  for(let hh=CAL_H0; hh<CAL_H1; hh++) body += `<div class="c-time">${hh}:00</div>`;
  body += '</div>';
  days.forEach(d=>{
    const iso = isoDate(d);
    const wknd = (d.getDay()===0 || d.getDay()===6) ? ' weekend' : '';
    body += `<div class="c-day${iso===todayIso?' today':''}${wknd}" data-date="${iso}">`;
    for(let hh=CAL_H0; hh<CAL_H1; hh++) body += `<div class="c-cell" data-h="${hh}"></div>`;
    EV_CACHE.filter(ev=>ev.date===iso).forEach(ev=>{
      const sh  = Math.min(CAL_H1, Math.max(CAL_H0, parseInt(ev.start_h, 10) || CAL_H0));
      const du  = Math.min(CAL_H1 - CAL_H0, Math.max(0.5, parseFloat(ev.dur) || 1));
      const top = (sh - CAL_H0) * CAL_CELL + 1;
      const hgt = du * CAL_CELL - 3;
      body += `<div class="c-ev" data-ev="${esc(ev.id)}" style="top:${top}px;height:${hgt}px">${esc(ev.title)}<small>${sh}:00 · ${du} h</small></div>`;
    });
    if(iso===todayIso){
      const now = new Date();
      const hFrac = now.getHours() + now.getMinutes()/60;
      if(hFrac >= CAL_H0 && hFrac <= CAL_H1){
        body += `<div class="c-nowline" style="top:${(hFrac-CAL_H0)*CAL_CELL}px"></div>`;
      }
    }
    body += '</div>';
  });
  document.getElementById('calBody').innerHTML = body;
}
document.getElementById('calPrev').addEventListener('click', ()=>{ calMonday.setDate(calMonday.getDate()-7); renderCal(); });
document.getElementById('calNext').addEventListener('click', ()=>{ calMonday.setDate(calMonday.getDate()+7); renderCal(); });
document.getElementById('calToday').addEventListener('click', ()=>{ calMonday = mondayOf(new Date()); renderCal(); });
document.querySelector('.tab[data-tab="kalendar"]').addEventListener('click', renderCal);

let evCtx = null;
(function fillStartSelect(){
  const sel = document.getElementById('evStart');
  for(let hh=CAL_H0; hh<CAL_H1; hh++) sel.innerHTML += `<option value="${hh}">${hh}:00</option>`;
})();
function openEv(id, date, hh){
  evCtx = { id };
  document.getElementById('evTitle').textContent = id ? 'Upraviť udalosť' : 'Nová udalosť';
  document.getElementById('evDelete').style.display = id ? 'inline-block' : 'none';
  if(id){
    let ev = EV_CACHE.find(x=>String(x.id)===String(id));
    if(!ev){ dbEvents().then(all=>{ EV_CACHE = all; const e2 = all.find(x=>String(x.id)===String(id)); if(e2) openEv(id); }); return; }
    document.getElementById('evName').value = ev.title;
    document.getElementById('evDate').value = ev.date;
    document.getElementById('evStart').value = ev.start_h;
    document.getElementById('evDur').value = ev.dur;
  }else{
    document.getElementById('evName').value = '';
    document.getElementById('evDate').value = date;
    document.getElementById('evStart').value = hh;
    document.getElementById('evDur').value = 1;
  }
  document.getElementById('evEdit').classList.add('open');
}
document.getElementById('calBody').addEventListener('click', e=>{
  if(dragJustEnded){ dragJustEnded = false; return; }
  if(e.target.closest('[data-ev]')) return; // udalosti rieši pointer logika nižšie
  const cell = e.target.closest('.c-cell');
  if(cell){
    const day = cell.closest('[data-date]');
    openEv(null, day.dataset.date, +cell.dataset.h);
  }
});

/* --- drag & drop udalostí --- */
let dragState = null;
let dragJustEnded = false;
document.getElementById('calBody').addEventListener('pointerdown', e=>{
  const el = e.target.closest('.c-ev');
  if(!el) return;
  e.preventDefault();
  const r = el.getBoundingClientRect();
  dragState = { id: el.dataset.ev, el, sx: e.clientX, sy: e.clientY,
    offX: e.clientX - r.left, offY: e.clientY - r.top, w: r.width, moved:false };
});
document.addEventListener('pointermove', e=>{
  if(!dragState) return;
  if(!dragState.moved){
    if(Math.abs(e.clientX - dragState.sx) < 5 && Math.abs(e.clientY - dragState.sy) < 5) return;
    dragState.moved = true;
    const el = dragState.el;
    el.style.position = 'fixed';
    el.style.width = dragState.w + 'px';
    el.style.right = 'auto';
    el.style.zIndex = '300';
    el.style.pointerEvents = 'none';
    el.style.opacity = '.85';
    el.style.boxShadow = '0 12px 30px rgba(0,0,0,.35)';
  }
  dragState.el.style.left = (e.clientX - dragState.offX) + 'px';
  dragState.el.style.top = (e.clientY - dragState.offY) + 'px';
});
document.addEventListener('pointerup', async e=>{
  if(!dragState) return;
  const st = dragState; dragState = null;
  if(!st.moved){ openEv(st.id); return; }
  dragJustEnded = true;
  const day = document.elementFromPoint(e.clientX, e.clientY)?.closest('.c-day');
  if(day){
    const r = day.getBoundingClientRect();
    let hh = CAL_H0 + Math.floor((e.clientY - r.top) / CAL_CELL);
    hh = Math.max(CAL_H0, Math.min(CAL_H1 - 1, hh));
    const ok = await dbUpdateEvent(st.id, { date: day.dataset.date, start_h: hh });
    if(ok) showToast('Udalosť presunutá ✓');
  }
  renderCal();
});
document.getElementById('evClose').addEventListener('click', ()=> document.getElementById('evEdit').classList.remove('open'));
document.getElementById('evEdit').addEventListener('click', e=>{ if(e.target.id==='evEdit') document.getElementById('evEdit').classList.remove('open'); });
document.getElementById('evSave').addEventListener('click', async ()=>{
  const ev = {
    title: document.getElementById('evName').value.trim() || 'Vyšetrenie',
    date: document.getElementById('evDate').value,
    start_h: +document.getElementById('evStart').value,
    dur: parseFloat(document.getElementById('evDur').value) || 1
  };
  if(!ev.date){ showToast('Doplň dátum'); return; }
  if(evCtx && evCtx.id) await dbUpdateEvent(evCtx.id, ev);
  else await dbAddEvent(ev);
  document.getElementById('evEdit').classList.remove('open');
  showToast('Udalosť uložená ✓');
  renderCal();
});
document.getElementById('evDelete').addEventListener('click', async ()=>{
  if(!evCtx || !evCtx.id) return;
  if(!confirm('Zmazať túto udalosť?')) return;
  const ok = await dbDeleteEvent(evCtx.id);
  document.getElementById('evEdit').classList.remove('open');
  showToast(ok ? 'Udalosť zmazaná ✓' : 'Zmazanie zlyhalo — skús znova');
  renderCal();
});

/* --- Kartotéka pacientov (Supabase; lokálny fallback pre ukážkový režim) --- */
const LS_DOC = 'vetark_doctor';
const docInput = document.getElementById('doctorName');
docInput.value = localStorage.getItem(LS_DOC) || 'Marcus John Hickman D.V.M.';
docInput.addEventListener('input', ()=> localStorage.setItem(LS_DOC, docInput.value));
function docName(){ return (localStorage.getItem(LS_DOC)||'Marcus John Hickman D.V.M.').trim() || 'Marcus John Hickman D.V.M.'; }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* dátová vrstva kartotéky — všetko cez API (server overuje rolu veterinára) */
async function dbPatients(){ try{ return await api('patients.list'); }catch(e){ return []; } }
async function dbRecords(p){ try{ return await api('records.list', { patient_id: p.id }); }catch(e){ showToast('Načítanie záznamov zlyhalo'); return []; } }
async function dbCreatePatient(base){ try{ return await api('patients.create', base); }catch(e){ showToast('Uloženie pacienta zlyhalo'); return null; } }
async function dbUpdatePatient(id, base){ try{ await api('patients.update', { id, ...base }); return true; }catch(e){ showToast('Uloženie zlyhalo'); return false; } }
async function dbDeletePatient(id){ try{ await api('patients.delete', { id }); return true; }catch(e){ showToast('Zmazanie zlyhalo'); return false; } }
async function dbAddRecord(patientId, rec){ try{ return await api('records.create', { patient_id: patientId, ...rec }); }catch(e){ showToast('Uloženie záznamu zlyhalo'); return null; } }
async function dbUpdateRecord(patientId, recId, text){ try{ await api('records.update', { id: recId, text }); return true; }catch(e){ showToast('Uloženie zlyhalo'); return false; } }
async function dbDeleteRecord(patientId, recId){ try{ await api('records.delete', { id: recId }); return true; }catch(e){ showToast('Zmazanie zlyhalo'); return false; } }

/* šablóny */
function skDate(){ const d=new Date(); return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear(); }
function sex(p){
  const f = p.pohlavie === 'Fena';
  return { kto:f?'Fena':'Pes', ktoV:f?'Fenka':'Pes', komu:f?'Fene':'Psovi', bol:f?'bola':'bol',
    podrobeny:f?'podrobená':'podrobený', cipovany:f?'čipovaná':'čipovaný',
    ockovany:f?'očkovaná':'očkovaný', odcerveny:f?'odčervená':'odčervený',
    osetreny:f?'ošetrená':'ošetrený', vnimavy:f?'vnímavá, hravá':'vnímavý, hravý' };
}
const SEP = '--------------------------------------------------------------------------';
const SEPL = '--------------------------------------------------------------------------------------------------------------------------------------------';
function dataBlock(p){
  return '```\nMajiteľ: ' + (p.majitel||'') + '\nTel. kontakt: ' + (p.tel||'') + '\nAdresa: ' + (p.adresa||'') +
    '\nDruh: ' + (p.druh||'') + '\nMeno zvieraťa: ' + (p.meno||'') + '\nVek: ' + (p.vek||'') +
    '\nPohlavie: ' + (p.pohlavie||'') + '\nPlemeno: ' + (p.plemeno||'') + '\nČíslo čipu: ' + (p.cip||'') + '\n```';
}
/* definície polí formulárov */
function todayStr(){ return skDate(); }
function FIELDS_VITALS(){ return [
  ['datum','Dátum prehliadky', todayStr()],
  ['tep','Tep','Bez abnormalít'],
  ['selest','Šelest na srdci','Bez nálezu'],
  ['plucne','Pľúcne a dýchacie cesty','Čisté, bez šelestov'],
  ['brucho','Brucho','Bez nálezu, bez abnormalít'],
  ['chrup','Chrup','Bez nálezu, bez abnormalít'],
  ['ustna','Ústna dutina','Bez nálezu, bez abnormalít'],
  ['nufak','Ňufák','Bez nálezu, bez výtoku, bez abnormalít'],
  ['srst','Srsť','Lesklá a susediaca - bez abnormalít'],
  ['vyziva','Výživa','V poriadku, bez abnormalít'],
  ['hmotnost','Hmotnosť (kg)',''],
  ['teplota','Teplota (°C)','37,5'],
  ['dkk','DKK (Dysplázia kĺbov)','Bez nálezu'],
  ['hemat','Hematológia','Bez nálezu, bez abnormalít. Hodnoty v norme'],
  ['bioch','Biochémia','Bez nálezu, bez abnormalít. Hodnoty v norme'],
]; }
function FIELDS_FOR(type, p){
  const s = sex(p);
  const closing = [
    ['doplnenie','🗒️ Doplnenie — voliteľná poznámka, zobrazí sa až na konci záznamu (NIE správanie)','','ta'],
    ['vypisal','Vypísal (meno, D.V.M.)', docName()],
    ['datum_vypisu','Dátum vypísania', todayStr()],
  ];
  if(type === 'karta') return [
    ['datum_reg','Dátum registrácie', todayStr()],
  ].concat(FIELDS_VITALS(), [
    ['spravanie','🐾 Správanie — prepíš vlastným popisom (ide do sekcie Správanie)', s.kto + ' je ' + s.vnimavy + '. Nejaví známky nadmernej agresie, svojho pána si chráni.','ta'],
    ['datum_cip','Dátum čipovania / kontroly čipu', todayStr()],
    ['cip_veta','Čipovanie — veta (bez dátumu)', s.komu + ' bol skontrolovaný certifikovaný čip'],
    ['ockovanie','Očkovacia správa (text alebo „čakám na doplnenie")','čakám na doplnenie','ta'],
  ], closing);
  if(type === 'kontrola') return FIELDS_VITALS().concat([
    ['rozdiely','Zaznamenané rozdiely','','ta'],
  ], closing);
  return [
    ['datum_os','Dátum ošetrenia', todayStr()],
    ['datum_zak','Dátum zákroku', todayStr()],
    ['diagnoza','Diagnóza','','ta'],
    ['zakrok','Vykonaný zákrok','','ta'],
    ['lieciva','Podané liečivá','','ta'],
    ['postup','Ďalší postup','','ta'],
    ['poznamka','Poznámka','','ta'],
  ].concat(closing);
}
function vitalsBlock(v){
  return '```\nTep: ' + v.tep + '\nŠelest na srdci: ' + v.selest + '\nPlúcne a dýchacie cesty: ' + v.plucne +
    '\nBrucho: ' + v.brucho + '\nChrup: ' + v.chrup + '\nÚstna dutina: ' + v.ustna +
    '\nŇufák: ' + v.nufak + '\nSrsť: ' + v.srst + '\nVýživa: ' + v.vyziva +
    '\nHmotnosť: ' + v.hmotnost + 'kg\nTeplota: ' + v.teplota + '°C\n```';
}
function labBlock(v){
  return '**DKK **\n```\n(Dysplázia klbov): ' + v.dkk + '\n```\n```\nHematológia: ' + v.hemat + '\nBiochémia: ' + v.bioch + '\n```';
}
function footer(v){
  const d = (v && v.datum_vypisu) || skDate();
  const m = (v && v.vypisal) || docName();
  return SEPL + '\n## Vypísané dňa ' + d + ' ' + m;
}
function doplnenie(v){ return (v && v.doplnenie && v.doplnenie.trim()) ? SEP + '\n`Doplnenie`\n\n' + v.doplnenie.trim() + '\n\n' : ''; }
function tplKarta(p, v){
  const s = sex(p);
  let t = '`Zaregistrovaný ' + v.datum_reg + '`\n';
  if(p.sluzobne) t += '`Zaregistrovaný ako službu konajúce zviera u S.O.S./ E.M.R.S.`\n';
  t += SEP + '\n' + dataBlock(p) + '\n' + SEP + '\n';
  t += '`Vstupná lekárska správa`\n\n';
  t += '**' + s.kto + ' ' + s.bol + ' ' + s.podrobeny + ' vstupnej lekárskej prehliadke dňa ' + v.datum + '.**\n';
  t += vitalsBlock(v) + '\n\n';
  t += '**' + v.spravanie + '**\n\n';
  t += labBlock(v) + '\n' + SEP + '\n';
  t += '`Čipovanie`\n\n';
  t += '**' + v.cip_veta + ' dňa ' + v.datum_cip + '.**\n\n';
  t += 'Zobrazované informácie na čipe:\n';
  t += '```\nMajiteľ: ' + (p.majitel||'') + '\nTel. kontakt: ' + (p.tel||'') + '\nAdresa: ' + (p.adresa||'') + '\nMeno zvieraťa: ' + (p.meno||'') + '\nČíslo čipu: ' + (p.cip||'') + '\n```\n' + SEP + '\n';
  const ock = (v.ockovanie || '').trim();
  t += '`Očkovacia správa`' + (ock.includes('\n') ? '\n' + ock : ' - ' + ock) + '\n\n';
  t += doplnenie(v);
  t += footer(v);
  return t;
}
function tplKontrola(p, v){
  const s = sex(p);
  let t = '`Lekárska správa z kontrolnej prehliadky`\n\n';
  t += '**' + s.kto + ' ' + s.bol + ' ' + s.podrobeny + ' kontrolnej prehliadke dňa ' + v.datum + '.**\n';
  t += vitalsBlock(v) + '\n' + labBlock(v) + '\n\n';
  t += '`Zaznamenané rozdiely`\n' + (v.rozdiely || '') + '\n';
  t += doplnenie(v);
  t += footer(v);
  return t;
}
function tplZakrok(p, v){
  const s = sex(p);
  let t = '`Lekárska správa zákroku`\n\n';
  t += '**' + s.kto + ' ' + s.bol + ' ' + s.osetreny + ' dňa ' + v.datum_os + '.**\n';
  t += '```\n**Dátum zákroku:** ' + v.datum_zak + '\n**Diagnóza:** ' + v.diagnoza + '\n \n**Vykonaný zákrok:** ' + v.zakrok + '\n**Podané liečivá:** ' + v.lieciva + '\n**Ďalší postup:** ' + v.postup + '\n```\n';
  t += 'Poznámka: ' + v.poznamka + '\n';
  t += doplnenie(v);
  t += footer(v);
  return t;
}
const TPL = { karta: tplKarta, kontrola: tplKontrola, zakrok: tplZakrok };
const REC_LABEL = { karta:'Hlavná karta', kontrola:'Kontrolná prehliadka', zakrok:'Záznam o zákroku' };

/* zoznam pacientov */
let PATS = [];
let RECS = [];
let currentPat = null;
let editId = null;

function initials(name){ return (name||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase() || '?'; }
async function renderPatList(){
  PATS = await dbPatients();
  const q = (document.getElementById('patSearch').value||'').toLowerCase();
  const list = document.getElementById('patList');
  const filtered = PATS.filter(p=> !q || ((p.meno||'')+' '+(p.majitel||'')).toLowerCase().includes(q));
  document.getElementById('patEmpty').style.display = PATS.length ? 'none' : 'block';
  list.innerHTML = filtered.map(p=>`
    <div class="pat-row" data-open="${esc(p.id)}" tabindex="0" role="button">
      <div class="pr-avatar">${esc(initials(p.meno))}</div>
      <div class="pr-meta"><b>${esc(p.meno)||'Bez mena'}${p.sluzobne?' <span class="pat-badge">Služobné</span>':''}</b>
      <span>${esc(p.pohlavie)} · ${esc(p.plemeno)||'—'} · majiteľ: ${esc(p.majitel)||'—'}</span></div>
      <div class="pr-count">${esc(p.recCount)} zázn.</div>
    </div>`).join('');
  const sel = document.getElementById('recPat');
  sel.innerHTML = PATS.map(p=>`<option value="${esc(p.id)}">${esc(p.meno)||'Bez mena'} (${esc(p.majitel)||'—'})</option>`).join('');
}
document.getElementById('patSearch').addEventListener('input', renderPatList);
document.getElementById('patList').addEventListener('click', e=>{
  const row = e.target.closest('[data-open]');
  if(row) openPatDetail(row.dataset.open);
});

/* detail pacienta */
async function openPatDetail(id){
  const p = PATS.find(x=>String(x.id)===String(id));
  if(!p) return;
  currentPat = p;
  document.getElementById('patListView').style.display='none';
  document.getElementById('patDetail').style.display='block';
  document.getElementById('patInfo').innerHTML = `
    <span class="tag">${p.sluzobne ? 'Služobné zviera · S.O.S./E.M.R.S.' : 'Karta pacienta'}</span>
    <h3>${esc(p.meno)||'Bez mena'}</h3>
    <div class="pi-grid">
      <div><b>Majiteľ</b>${esc(p.majitel)||'—'}</div>
      <div><b>Tel. kontakt</b>${esc(p.tel)||'—'}</div>
      <div><b>Adresa</b>${esc(p.adresa)||'—'}</div>
      <div><b>Druh</b>${esc(p.druh)||'—'}</div>
      <div><b>Vek</b>${esc(p.vek)||'—'}</div>
      <div><b>Pohlavie</b>${esc(p.pohlavie)||'—'}</div>
      <div><b>Plemeno</b>${esc(p.plemeno)||'—'}</div>
      <div><b>Číslo čipu</b>${esc(p.cip)||'—'}</div>
    </div>`;
  await refreshRecords();
  window.scrollTo({top:0});
}
async function refreshRecords(){
  RECS = await dbRecords(currentPat);
  const list = document.getElementById('recList');
  document.getElementById('recEmpty').style.display = RECS.length ? 'none' : 'block';
  list.innerHTML = [...RECS].reverse().map(r=>`
    <div class="rec-row" data-rec="${esc(r.id)}" tabindex="0" role="button">
      <span class="rec-type ${esc(r.type)}">${esc(REC_LABEL[r.type]||r.type)}</span>
      <span class="rc-date">${esc(r.date)}</span>
    </div>`).join('');
}
document.getElementById('patBack').addEventListener('click', ()=>{
  currentPat = null;
  document.getElementById('patDetail').style.display='none';
  document.getElementById('patListView').style.display='block';
  renderPatList();
});
document.getElementById('recList').addEventListener('click', e=>{
  const row = e.target.closest('[data-rec]');
  if(!row) return;
  const r = RECS.find(x=>String(x.id)===row.dataset.rec);
  if(r) openEditor(currentPat, r.type, r.id, r.text);
});
document.getElementById('pdKontrola').addEventListener('click', ()=> openEditor(currentPat, 'kontrola', null));
document.getElementById('pdZakrok').addEventListener('click', ()=> openEditor(currentPat, 'zakrok', null));
document.getElementById('pdKarta').addEventListener('click', ()=> openEditor(currentPat, 'karta', null));
document.getElementById('pdEdit').addEventListener('click', ()=>{
  openPatForm(currentPat);
  document.querySelector('.tab[data-tab="novakarta"]').click();
});
document.getElementById('pdDelete').addEventListener('click', async ()=>{
  if(!confirm('Zmazať pacienta „' + (currentPat.meno||'') + '" aj so všetkými záznamami?')) return;
  const ok = await dbDeletePatient(currentPat.id);
  if(ok){ showToast('Pacient zmazaný'); document.getElementById('patBack').click(); }
});

/* nová karta / úprava */
function openPatForm(p){
  editId = p ? p.id : null;
  const d = p || {druh:'Pes', pohlavie:'Pes'};
  document.getElementById('nkTitle').textContent = editId===null ? 'Nová karta pacienta' : 'Upraviť kartu — ' + (d.meno||'');
  document.getElementById('patCancel').style.display = editId===null ? 'none' : 'inline-block';
  const set=(id,v)=>document.getElementById(id).value=v||'';
  set('pMajitel',d.majitel); set('pTel',d.tel); set('pAdresa',d.adresa);
  set('pDruh',d.druh||'Pes'); set('pMeno',d.meno); set('pVek',d.vek);
  document.getElementById('pPohlavie').value = d.pohlavie||'Pes';
  set('pPlemeno',d.plemeno); set('pCip',d.cip);
  document.getElementById('pSluzobne').checked = !!d.sluzobne;
  document.getElementById('nkKarta').style.display = editId===null ? 'block' : 'none';
  if(editId===null) buildNkKarta();
}
function buildNkKarta(){
  const p = { pohlavie: document.getElementById('pPohlavie').value };
  const wrap = document.getElementById('nkKartaFields');
  wrap.innerHTML = FIELDS_FOR('karta', p).map(f=>{
    const [key, label, def, kind] = f;
    const inp = kind === 'ta'
      ? `<textarea data-nk="${key}" data-auto="1" style="min-height:60px">${esc(def)}</textarea>`
      : `<input data-nk="${key}" value="${esc(def)}">`;
    return `<div class="field${kind==='ta'?' full':''}"><label>${esc(label)}</label>${inp}</div>`;
  }).join('');
  wrap.querySelectorAll('[data-auto]').forEach(el=> el.addEventListener('input', ()=> el.removeAttribute('data-auto')));
}
document.getElementById('pPohlavie').addEventListener('change', ()=>{
  if(editId!==null) return;
  const p = { pohlavie: document.getElementById('pPohlavie').value };
  const s = sex(p);
  const beh = document.querySelector('#nkKartaFields [data-nk="spravanie"]');
  if(beh && beh.hasAttribute('data-auto')){
    beh.value = s.kto + ' je ' + s.vnimavy + ' a na podnety reaguje primerane. Žiadne abnormality či výkyvy správania neboli pozorované.';
  }
});
function collectNkKarta(){
  const v = {};
  document.querySelectorAll('#nkKartaFields [data-nk]').forEach(el=>{ v[el.dataset.nk] = el.value.trim(); });
  return v;
}
document.getElementById('patCancel').addEventListener('click', ()=>{
  openPatForm(null);
  showToast('Úprava zrušená');
});
document.getElementById('patSave').addEventListener('click', async ()=>{
  const g=id=>document.getElementById(id).value.trim();
  const base = { majitel:g('pMajitel'), tel:g('pTel'), adresa:g('pAdresa'), druh:g('pDruh'),
    meno:g('pMeno'), vek:g('pVek'), pohlavie:document.getElementById('pPohlavie').value,
    plemeno:g('pPlemeno'), cip:g('pCip'), sluzobne:document.getElementById('pSluzobne').checked };
  if(!base.meno){ showToast('Doplň meno zvieraťa'); return; }
  let p;
  if(editId===null){
    p = await dbCreatePatient(base);
    if(!p) return;
  }else{
    const ok = await dbUpdatePatient(editId, base);
    if(!ok) return;
    p = { ...base, id: editId };
  }
  let savedRec = null;
  if(editId===null){
    const v = collectNkKarta();
    const text = tplKarta(p, v);
    savedRec = await dbAddRecord(p.id, { type:'karta', date: skDate(), text });
  }
  showToast(editId===null ? 'Karta pacienta aj hlavná karta uložené ✓' : 'Karta uložená ✓');
  openPatForm(null);
  await renderPatList();
  document.querySelector('.tab[data-tab="pacienti"]').click();
  await openPatDetail(p.id);
  if(savedRec) openEditor(currentPat, 'karta', savedRec.id, savedRec.text);
});

/* sekcia Záznamy — polia priamo na stránke */
function zzSelectedPatient(){
  const id = document.getElementById('recPat').value;
  return PATS.find(x=>String(x.id)===String(id)) || null;
}
function buildZzFields(){
  const wrap = document.getElementById('zzFields');
  const empty = document.getElementById('zzEmpty');
  const btn = document.getElementById('recGen');
  const p = zzSelectedPatient();
  if(!p){
    wrap.innerHTML = ''; wrap.style.display='none';
    empty.style.display = 'block'; btn.style.display='none';
    return;
  }
  empty.style.display='none'; wrap.style.display='grid'; btn.style.display='inline-block';
  const type = document.getElementById('recType').value;
  wrap.innerHTML = FIELDS_FOR(type, p).map(f=>{
    const [key, label, def, kind] = f;
    const inp = kind === 'ta'
      ? `<textarea data-zz="${key}" style="min-height:60px">${esc(def)}</textarea>`
      : `<input data-zz="${key}" value="${esc(def)}">`;
    return `<div class="field${kind==='ta'?' full':''}"><label>${esc(label)}</label>${inp}</div>`;
  }).join('');
}
document.getElementById('recType').addEventListener('change', buildZzFields);
document.getElementById('recPat').addEventListener('change', buildZzFields);
document.querySelector('.tab[data-tab="zaznamy"]').addEventListener('click', ()=>{
  if(!document.getElementById('zzFields').innerHTML) buildZzFields();
  else if(!zzSelectedPatient()) buildZzFields();
});
document.getElementById('recGen').addEventListener('click', async ()=>{
  const p = zzSelectedPatient();
  if(!p){ showToast('Najprv založ kartu pacienta'); return; }
  const type = document.getElementById('recType').value;
  const v = {};
  document.querySelectorAll('#zzFields [data-zz]').forEach(el=>{ v[el.dataset.zz] = el.value.trim(); });
  const text = TPL[type](p, v);
  const rec = await dbAddRecord(p.id, { type, date: skDate(), text });
  if(!rec) return;
  showToast('Záznam uložený do karty ✓');
  buildZzFields();
  await renderPatList();
  document.querySelector('.tab[data-tab="pacienti"]').click();
  await openPatDetail(p.id);
  openEditor(currentPat, type, rec.id, rec.text);
});

/* editor záznamu */
let edCtx = null;
function buildEdForm(type, p){
  const wrap = document.getElementById('edForm');
  wrap.innerHTML = FIELDS_FOR(type, p).map(f=>{
    const [key, label, def, kind] = f;
    const inp = kind === 'ta'
      ? `<textarea data-ek="${key}" style="min-height:60px">${esc(def)}</textarea>`
      : `<input data-ek="${key}" value="${esc(def)}">`;
    return `<div class="field${kind==='ta'?' full':''}"><label>${esc(label)}</label>${inp}</div>`;
  }).join('');
}
function collectEdForm(){
  const v = {};
  document.querySelectorAll('#edForm [data-ek]').forEach(el=>{ v[el.dataset.ek] = el.value.trim(); });
  return v;
}
function generatePreview(){
  document.getElementById('edText').value = TPL[edCtx.type](edCtx.p, collectEdForm());
  document.getElementById('edText').style.display = 'block';
}
function openEditor(p, type, recId, textExisting){
  edCtx = { p, type, recId };
  document.getElementById('edTitle').textContent = REC_LABEL[type] + ' — ' + (p.meno||'');
  const isNew = !recId;
  document.getElementById('edForm').style.display = isNew ? 'grid' : 'none';
  document.getElementById('edGen').style.display = isNew ? 'inline-block' : 'none';
  if(isNew){
    document.getElementById('edMeta').textContent = 'Vyplň hodnoty — všetko je predvyplnené, zmeň len to, čo treba. Potom vygeneruj náhľad a ulož.';
    buildEdForm(type, p);
    document.getElementById('edText').value = '';
    document.getElementById('edText').style.display = 'none';
  }else{
    document.getElementById('edMeta').textContent = 'Uložený záznam — úpravy sa prepíšu do karty';
    document.getElementById('edText').value = textExisting || '';
    document.getElementById('edText').style.display = 'block';
  }
  document.getElementById('edSend').style.display = 'inline-block';
  const lastCh = localStorage.getItem('vetark_last_channel') || '';
  document.getElementById('edChannel').value = lastCh;
  const lc = loadChannels().find(x=>x.id===lastCh);
  document.getElementById('edChannelName').value = lc ? (lc.name||'') : '';
  document.getElementById('edDelete').style.display = recId ? 'inline-block' : 'none';
  document.getElementById('editor').classList.add('open');
}
document.getElementById('edGen').addEventListener('click', generatePreview);
function closeEditor(){ document.getElementById('editor').classList.remove('open'); edCtx = null; }

/* --- Prístupnosť: fokus v dialógoch a stav tabov --- */
(function(){
  let lastFocus = null;
  const dialogs = document.querySelectorAll('.reader, .editor, .lightbox, .booking');
  const obs = new MutationObserver(muts => muts.forEach(m => {
    const el = m.target;
    if(el.classList.contains('open')){
      lastFocus = document.activeElement;
      el.setAttribute('aria-modal', 'true');
      const f = el.querySelector('input:not([type=hidden]), textarea, select, button:not([aria-label="Zavrieť"]), [href]') || el.querySelector('button');
      if(f) setTimeout(()=> f.focus(), 0);
    }else if(m.oldValue && m.oldValue.includes('open')){
      el.removeAttribute('aria-modal');
      if(lastFocus && document.contains(lastFocus)) lastFocus.focus();
      lastFocus = null;
    }
  }));
  dialogs.forEach(d => obs.observe(d, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }));
  const syncTabs = () => document.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', t.classList.contains('active') ? 'true' : 'false'));
  syncTabs();
  document.querySelectorAll('[role="tablist"]').forEach(tl => new MutationObserver(syncTabs).observe(tl, { attributes: true, subtree: true, attributeFilter: ['class'] }));
})();
document.getElementById('edClose').addEventListener('click', closeEditor);
document.getElementById('editor').addEventListener('click', e=>{ if(e.target.id==='editor') closeEditor(); });
document.getElementById('edSave').addEventListener('click', async ()=>{
  if(!edCtx) return;
  if(!edCtx.recId && !document.getElementById('edText').value.trim()) generatePreview();
  const text = document.getElementById('edText').value;
  if(edCtx.recId){
    await dbUpdateRecord(edCtx.p.id, edCtx.recId, text);
  }else{
    const r = await dbAddRecord(edCtx.p.id, { type: edCtx.type, date: skDate(), text });
    if(!r) return;
    edCtx.recId = r.id;
    document.getElementById('edDelete').style.display = 'inline-block';
    document.getElementById('edMeta').textContent = 'Uložený záznam — úpravy sa prepíšu do karty';
  }
  if(currentPat && String(currentPat.id)===String(edCtx.p.id)) await refreshRecords();
  renderPatList();
  showToast('Záznam uložený do karty ✓');
});
document.getElementById('edCopy').addEventListener('click', ()=> copyText(document.getElementById('edText').value));
/* --- zapamätané Discord kanály (ID + názov) v tomto prehliadači --- */
const LS_CH = 'vetark_channels';
function loadChannels(){ try{ return JSON.parse(localStorage.getItem(LS_CH)) || []; }catch(e){ return []; } }
function saveChannels(list){ localStorage.setItem(LS_CH, JSON.stringify(list.slice(0,20))); }
function renderChannelList(){
  const dl = document.getElementById('edChannelList');
  dl.innerHTML = loadChannels().map(c=>`<option value="${esc(c.id)}">${esc(c.name||'')}</option>`).join('');
}
function rememberChannel(id, name){
  const list = loadChannels().filter(c=>c.id!==id);
  list.unshift({ id, name: name || (list.find(c=>c.id===id)||{}).name || '' });
  saveChannels(list);
  localStorage.setItem('vetark_last_channel', id);
  renderChannelList();
}
renderChannelList();
document.getElementById('edChannel').addEventListener('change', ()=>{
  const c = loadChannels().find(x=>x.id===document.getElementById('edChannel').value.trim());
  if(c && c.name) document.getElementById('edChannelName').value = c.name;
});

document.getElementById('edSend').addEventListener('click', async ()=>{
  const text = document.getElementById('edText').value;
  if(!text.trim()){ showToast('Najprv vygeneruj náhľad správy'); return; }
  const chId = document.getElementById('edChannel').value.trim();
  const chName = document.getElementById('edChannelName').value.trim();
  if(!/^\d{15,25}$/.test(chId)){ showToast('Zadaj ID Discord kanála (len číslice)'); return; }
  try{
    showToast('Odosielam…');
    await api('records.post', { channel_id: chId, text, title: (edCtx ? (REC_LABEL[edCtx.type] + ' — ' + (edCtx.p.meno||'')) : 'Záznam'), kind: edCtx ? edCtx.type : '', patient_id: edCtx ? edCtx.p.id : '' });
    rememberChannel(chId, chName);
    showToast('Záznam odoslaný do kanála ✓');
  }catch(e){
    showToast('Odoslanie zlyhalo: ' + e.message);
  }
});
document.getElementById('edDelete').addEventListener('click', async ()=>{
  if(!edCtx || !edCtx.recId) return;
  if(!confirm('Zmazať tento záznam z karty?')) return;
  await dbDeleteRecord(edCtx.p.id, edCtx.recId);
  if(currentPat && String(currentPat.id)===String(edCtx.p.id)) await refreshRecords();
  renderPatList();
  closeEditor();
  showToast('Záznam zmazaný');
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeEditor(); });

openPatForm(null);

/* --- Cenník kalkulačka --- */
const fmt = n => '$ ' + n.toLocaleString('sk-SK');
const rows = [...document.querySelectorAll('#priceTable tr[data-price]')];
const discountToggle = document.getElementById('discountToggle');

function recalc(){
  let total = 0, items = 0;
  rows.forEach(r=>{
    const qty = parseInt(r.querySelector('.qty span').textContent, 10);
    total += qty * parseInt(r.dataset.price, 10);
    items += qty;
    r.classList.toggle('selected', qty > 0);
  });
  const discounted = discountToggle.checked ? Math.round(total * 0.8) : total;
  document.getElementById('calcTotal').textContent = fmt(discounted);
  document.getElementById('calcDetail').textContent = items === 0 ? 'žiadne výkony'
    : `${items} výkonov` + (discountToggle.checked ? ` · pôvodne ${fmt(total)}` : '');
}

rows.forEach(r=>{
  const span = r.querySelector('.qty span');
  r.querySelector('.plus').addEventListener('click', ()=>{ span.textContent = +span.textContent + 1; recalc(); });
  r.querySelector('.minus').addEventListener('click', ()=>{ span.textContent = Math.max(0, +span.textContent - 1); recalc(); });
});
discountToggle.addEventListener('change', recalc);
document.getElementById('calcReset').addEventListener('click', ()=>{
  rows.forEach(r=> r.querySelector('.qty span').textContent = '0');
  discountToggle.checked = false;
  recalc();
});
document.getElementById('calcCopy').addEventListener('click', ()=>{
  const lines = [];
  let total = 0;
  rows.forEach(r=>{
    const qty = parseInt(r.querySelector('.qty span').textContent, 10);
    if(qty > 0){
      const name = r.cells[0].textContent;
      const price = parseInt(r.dataset.price, 10);
      total += qty * price;
      lines.push(`• ${name} ×${qty} — ${fmt(qty*price)}`);
    }
  });
  if(lines.length === 0){ showToast('Najprv naklikaj výkony'); return; }
  let text = `**VET ARK — účet**\n${lines.join('\n')}\n`;
  if(discountToggle.checked){
    text += `Medzisúčet: ${fmt(total)}\nZľava 20 % (dohoda)\n**Spolu: ${fmt(Math.round(total*0.8))}**`;
  }else{
    text += `**Spolu: ${fmt(total)}**`;
  }
  copyText(text);
});

