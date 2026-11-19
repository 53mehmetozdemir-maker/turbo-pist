import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TP, N, WORLD, buildTrack, drawMinimapTrack, query, nearest } from './track.js';
import { buildCar, dentCar, repairCar, drawGauges, CAR } from './car.js';
import { Car } from './physics.js';
import { CarAudio } from './audio.js';
import { Particles, SkidMarks } from './effects.js';
import { Net } from './net.js';

const $=id=>document.getElementById(id);
const COLORS=['#e8202a','#1f6fe0','#ff9f1a','#20b956','#8e44ef','#f1f2f6','#202226','#ffd400'];
const LAPS=3;
const store={ get(k){ try{return localStorage.getItem(k);}catch(e){return null;} }, set(k,v){ try{localStorage.setItem(k,v);}catch(e){} } };
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;

// ---------------- settings ----------------
const settings={
  quality: store.get('tp3_quality') || (isTouch?'med':'high'),
  manual: store.get('tp3_manual')==='1',
  assists: store.get('tp3_assists')!=='0',
  name: store.get('tp_name')||'', color: store.get('tp3_color')||COLORS[0],
};
if(!COLORS.includes(settings.color)) settings.color=COLORS[0];

// ---------------- renderer / scene ----------------
const renderer=new THREE.WebGLRenderer({antialias:settings.quality!=='low', powerPreference:'high-performance'});
const DPR=window.devicePixelRatio||1;
renderer.setPixelRatio(settings.quality==='high'?Math.min(DPR,2):settings.quality==='med'?Math.min(DPR,1.25):Math.min(DPR,1)*0.85);
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.75;
renderer.shadowMap.enabled=settings.quality!=='low'; renderer.shadowMap.type=THREE.PCFShadowMap;
document.body.prepend(renderer.domElement); renderer.domElement.id='c';

const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xc9d9e8,260,1300);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.05,4000);
const mirrorCam=new THREE.PerspectiveCamera(50,3.2,0.1,800);
const pmrem=new THREE.PMREMGenerator(renderer);
scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture; scene.environmentIntensity=0.55;

const sky=new Sky(); sky.scale.setScalar(6000); scene.add(sky);
const sunDir=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-38),THREE.MathUtils.degToRad(140));
Object.assign(sky.material.uniforms,{}); const U=sky.material.uniforms;
U.turbidity.value=3; U.rayleigh.value=1.2; U.mieCoefficient.value=0.004; U.mieDirectionalG.value=0.8; U.sunPosition.value.copy(sunDir);
if(U.cloudCoverage){ U.cloudCoverage.value=0.35; U.cloudDensity.value=0.35; }
const hemi=new THREE.HemisphereLight(0xcfe3ff,0x4a6a35,0.75); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1dc,2.6); sun.castShadow=renderer.shadowMap.enabled;
const SH=settings.quality==='high'?2048:1024; sun.shadow.mapSize.set(SH,SH);
Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:400}); sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.03;
scene.add(sun); scene.add(sun.target);

const track=buildTrack(scene,settings.quality);
const smoke=new Particles(scene,settings.quality==='low'?250:700);
const skids=new SkidMarks(scene,settings.quality==='low'?1200:3500);
const audio=new CarAudio();

// ---------------- local car ----------------
const phys=new Car(); phys.manual=settings.manual; phys.assists=settings.assists;
let model=buildCar(settings.color); scene.add(model.root);
function setMyColor(c){ settings.color=c; model.paint.color.set(c); }

// remote cars
const remotes=new Map();
function nameSprite(text){
  const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d');
  g.font='bold 34px Inter,sans-serif'; const w=Math.min(250,g.measureText(text).width+28);
  g.fillStyle='rgba(10,12,18,.72)'; g.beginPath(); g.roundRect((256-w)/2,6,w,50,14); g.fill(); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,128,32);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:true,transparent:true})); s.scale.set(3.2,0.8,1); return s;
}

// ---------------- state ----------------
let mode='menu', online=false, ready=false, raceId=null, racers=[], seenRaces=new Set();
let countStart=0, raceStart=0, elapsed=0, lapStart=0, lastLap=0, bestLap=0, resultsShown=false, lightsShown=-1;
let camMode=+(store.get('tp3_cam')||0);
const CAM_NAMES=['Takip kamerası','Kokpit','Kaput kamerası'];
const me={lap:0,cp:0,idx:0,prevIdx:0,fin:false,ft:0};
let shake=0, respawnCool=0;

// ---------------- UI: menu ----------------
const nameIn=$('name'), codeIn=$('code');
nameIn.value=settings.name;
function randCode(){ const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<4;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; }
codeIn.value=store.get('tp_code')||randCode();
{ const q=new URLSearchParams(location.search).get('oda'); if(q) codeIn.value=q.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); }
$('newCode').onclick=()=>{ codeIn.value=randCode(); };
codeIn.addEventListener('input',()=>{ codeIn.value=codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });
const sws=$('swatches');
COLORS.forEach(c=>{ const d=document.createElement('div'); d.className='sw'+(c===settings.color?' on':''); d.style.background=c; d.onclick=()=>{ setMyColor(c); store.set('tp3_color',c); [...sws.children].forEach(x=>x.classList.remove('on')); d.classList.add('on'); }; sws.appendChild(d); });
function seg(id,val,on){ const el=$(id); [...el.children].forEach(b=>{ b.classList.toggle('on',b.dataset.v===val); b.onclick=()=>{ [...el.children].forEach(x=>x.classList.remove('on')); b.classList.add('on'); on(b.dataset.v); }; }); }
seg('qSeg',settings.quality,v=>{ store.set('tp3_quality',v); if(v!==settings.quality){ toast('Grafik ayarı uygulanıyor…'); setTimeout(()=>location.reload(),400); } });
seg('gSeg',settings.manual?'manual':'auto',v=>{ settings.manual=v==='manual'; phys.manual=settings.manual; store.set('tp3_manual',settings.manual?'1':'0'); });
seg('aSeg',settings.assists?'on':'off',v=>{ settings.assists=v==='on'; phys.assists=settings.assists; store.set('tp3_assists',settings.assists?'1':'0'); });
function cleanName(){ return (nameIn.value.trim()||'Pilot').slice(0,14); }
function show(id){ ['menu','lobby','results'].forEach(p=>$(p).classList.toggle('hidden',p!==id)); }
function toast(msg,ms=2500){ const t=$('toast'); t.textContent=msg; t.style.opacity=1; clearTimeout(toast._t); toast._t=setTimeout(()=>t.style.opacity=0,ms); }
function saveName(){ settings.name=cleanName(); store.set('tp_name',settings.name); }

// ---------------- network ----------------
let peers=[];
const net=new Net(ps=>{ peers=ps; onPeersChanged(); }, ()=>{ goMenu(); }, toast);
const netNote=$('netNote');
if(net.available){ $('joinBtn').disabled=false; netNote.innerHTML='Aynı oda kodunu giren herkes aynı yarışa katılır. Lobideki <b>Davet linkini kopyala</b> ile arkadaşına link gönder.'; }
else netNote.innerHTML='<span class="warn">Bağlantı kütüphanesi yüklenemedi.</span> İnterneti kontrol edip sayfayı yenile. Antrenman yapabilirsin.';
const myPres=()=>({name:settings.name,color:settings.color});

$('joinBtn').onclick=async()=>{
  if(!net.available) return; saveName(); audio.start();
  const code=(codeIn.value||randCode()).toUpperCase(); codeIn.value=code; store.set('tp_code',code);
  $('joinBtn').disabled=true; $('joinBtn').textContent='Bağlanıyor…';
  try{ await net.join(code); }
  catch(e){ $('joinBtn').disabled=false; $('joinBtn').textContent='Odaya Gir'; toast('Odaya bağlanılamadı ('+((e&&e.type)||'hata')+')',4000); return; }
  $('joinBtn').disabled=false; $('joinBtn').textContent='Odaya Gir';
  online=true; seenRaces=new Set(); $('lobbyCode').textContent=code;
  net.set({...myPres(), ready:false, st:'lobby', raceId:null, race:null});
  if(net.isHost) net.rebuild();
  enterLobby();
};
$('soloBtn').onclick=()=>{ saveName(); audio.start(); online=false; startRace({id:'solo'+Date.now(), p:['me']}); };
$('copyBtn').onclick=async()=>{ const url=location.origin+location.pathname+'?oda='+encodeURIComponent($('lobbyCode').textContent);
  try{ await navigator.clipboard.writeText(url); toast('Link kopyalandı ✓ Arkadaşına gönder'); }catch(e){ toast(url,6000); } };
function enterLobby(){
  mode='lobby'; ready=false; resultsShown=false; raceId=null; clearRemotes();
  net.set({ready:false, st:'lobby', raceId:null, fin:null, x:null});
  $('readyBtn').textContent='Hazırım'; $('readyBtn').classList.add('go');
  show('lobby'); hud(false); renderLobby();
}
$('readyBtn').onclick=()=>{ ready=!ready; net.set({ready}); $('readyBtn').textContent=ready?'Hazır değilim':'Hazırım'; $('readyBtn').classList.toggle('go',!ready); renderLobby(); checkHost(); };
$('leaveBtn').onclick=()=>goMenu();
function goMenu(){ net.leave(); online=false; peers=[]; clearRemotes(); mode='menu'; resultsShown=false; show('menu'); hud(false); }
function hud(on){ $('hud').classList.toggle('hidden',!on); $('touch').classList.toggle('hidden',!(on&&isTouch)); $('lights').classList.add('hidden'); }

const safeColor=c=>COLORS.includes(c)?c:'#888';
const safeName=s=>(typeof s==='string'?s:'Pilot').replace(/[\u0000-\u001f]/g,'').slice(0,14)||'Pilot';
const named=()=>peers.filter(p=>p.p && typeof p.p.name==='string');
function renderLobby(){
  if(mode!=='lobby') return;
  const ul=$('plist'); ul.innerHTML='';
  for(const p of named()){
    const li=document.createElement('li');
    const dot=document.createElement('span'); dot.className='dot'; dot.style.background=safeColor(p.p.color);
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=safeName(p.p.name)+(p.me?' (sen)':'');
    const tag=document.createElement('span'); tag.className='tag';
    if(p.p.st==='race') tag.textContent='yarışta'; else if(p.p.ready){ tag.textContent='hazır ✓'; tag.classList.add('ok'); } else tag.textContent='bekliyor';
    li.append(dot,nm,tag); ul.appendChild(li);
  }
  const n=named().filter(p=>p.p.st==='lobby').length;
  $('lobbyNote').textContent = n<2 ? 'Arkadaşının bu oda koduyla girmesini bekle…' : 'Herkes "Hazırım" deyince yarış başlar.';
}
function onPeersChanged(){
  for(const p of peers){ const r=p.p&&p.p.race; if(r && typeof r.id==='string' && Array.isArray(r.p)) handleRace(r); }
  if(raceId){
    const alive=new Set();
    for(const p of peers){ if(p.me) continue; const s=p.p||{}; if(s.raceId!==raceId || typeof s.x!=='number') continue;
      alive.add(p.id); let r=remotes.get(p.id);
      if(!r){ const m=buildCar(safeColor(s.color)); scene.add(m.root); const label=nameSprite(safeName(s.name)); label.position.y=2.1; m.root.add(label);
        r={model:m,x:s.x,y:s.y,a:s.a||0,v:0,vx:0,vy:0,steer:0,t:performance.now(),wheel:0,dmg:0}; remotes.set(p.id,r); }
      if(r.tx!==s.x||r.ty!==s.y||r.ta!==s.a) r.t=performance.now();
      r.tx=s.x; r.ty=s.y; r.ta=s.a||0; r.v=+s.v||0; r.sr=+s.sr||0; r.bk=!!s.bk; r.nt=!!s.nt; r.dm=+s.dm||0;
      r.name=safeName(s.name); r.color=safeColor(s.color); r.lap=s.lap|0; r.cp=s.cp|0; r.idx=s.idx|0; r.fin=!!s.fin; r.ft=+s.ft||0; r.best=+s.best||0;
    }
    for(const [k,r] of [...remotes]) if(!alive.has(k)){ scene.remove(r.model.root); remotes.delete(k); }
  }
  renderLobby(); checkHost();
}
function clearRemotes(){ for(const r of remotes.values()) scene.remove(r.model.root); remotes.clear(); }
function checkHost(){
  if(!online||mode!=='lobby'||!net.isHost) return;
  const lp=named().filter(p=>p.p.st==='lobby'); if(lp.length<2 || !lp.every(p=>p.p.ready)) return;
  const race={id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), p:lp.map(p=>p.id).sort()};
  net.set({race}); handleRace(race);
}
function handleRace(r){ if(seenRaces.has(r.id)) return; seenRaces.add(r.id); if(mode!=='lobby' || !r.p.includes(net.myId)) return; startRace(r); }

// ---------------- race ----------------
function gridPos(slot){ const row=Math.floor(slot/2), col=slot%2; const gi=(N-6-row*3+N)%N; const p=TP[gi]; const off=(col?1:-1)*2.8; return {x:p.x+p.nx*off, y:p.y+p.ny*off, a:p.a, i:gi}; }
function startRace(r){
  raceId=r.id; racers=r.p.slice(0,8); clearRemotes(); skids.clear(); repairCar(model);
  const me_id=online?net.myId:'me'; const g=gridPos(Math.max(0,racers.indexOf(me_id)));
  phys.reset(g.x,g.y,g.a); phys.manual=settings.manual; phys.assists=settings.assists; phys.hint=g.i;
  Object.assign(me,{lap:0,cp:0,idx:g.i,prevIdx:g.i,fin:false,ft:0}); lastLap=0; bestLap=0; elapsed=0; resultsShown=false; lightsShown=-1;
  mode='countdown'; countStart=performance.now(); show(null); hud(true); $('lights').classList.remove('hidden');
  toast(`${CAM_NAMES[camMode]} · C ile değiştir`,2500);
  net.set({...myPres(), st:'race', ready:false, raceId, x:+g.x.toFixed(2), y:+g.y.toFixed(2), a:+g.a.toFixed(3), v:0, lap:0, cp:0, idx:g.i, fin:false, ft:0});
}
function respawn(){
  if(mode!=='race'||me.fin||respawnCool>0) return; respawnCool=3;
  const i=nearest(phys.x,phys.y); const p=TP[i]; phys.x=p.x; phys.y=p.y; phys.a=p.a; phys.vx=phys.vy=phys.yawRate=0; phys.hint=i; phys.steer=0; toast('Piste geri dönüldü');
}
function progOf(lap,cp,idx){ return lap*N + ((cp===0 && idx>N/2) ? idx-N : idx); }
function standings(){
  const list=[{name:settings.name,color:settings.color,me:true,prog:progOf(me.lap,me.cp,me.idx),fin:me.fin,ft:me.ft,best:bestLap}];
  for(const r of remotes.values()) list.push({name:r.name,color:r.color,prog:progOf(r.lap,r.cp,r.idx),fin:r.fin,ft:r.ft,best:r.best});
  list.sort((a,b)=>(a.fin&&b.fin)?a.ft-b.ft:a.fin?-1:b.fin?1:b.prog-a.prog); return list;
}
const fmt=ms=>{ if(!ms) return '-:--.---'; const m=Math.floor(ms/60000), s=Math.floor(ms/1000)%60, c=Math.floor(ms)%1000; return m+':'+String(s).padStart(2,'0')+'.'+String(c).padStart(3,'0'); };
function lapLogic(){
  const ni=phys.hint; me.prevIdx=me.idx; me.idx=ni;
  if(me.fin) return;
  if(me.cp<3){ const lo=Math.floor((me.cp+1)*N/4); if(ni>=lo && ni<lo+Math.floor(N*0.12)) me.cp++; }
  else if(me.prevIdx>N*0.85 && ni<N*0.15){
    const now=performance.now(); const lt=now-lapStart; lapStart=now; lastLap=lt; if(!bestLap||lt<bestLap){ bestLap=lt; }
    me.lap++; me.cp=0;
    if(me.lap>=LAPS){ me.fin=true; me.ft=elapsed; toast('🏁 Bitiş! '+fmt(elapsed),3500); setTimeout(showResults,1500); }
    else toast((lt===bestLap?'🟣 En iyi tur ':'Tur ')+fmt(lt)+(me.lap===LAPS-1?' · Son tur! 🔥':''),3000);
  }
}
function showResults(){ resultsShown=true; show('results'); $('touch').classList.add('hidden'); $('againBtn').textContent=online?'Lobiye Dön':'Tekrar Yarış'; renderResults(); }
function renderResults(){
  if(!resultsShown) return; const st=standings(), ul=$('rlist'); ul.innerHTML='';
  const rank=st.findIndex(x=>x.me)+1;
  $('resSub').textContent=online?(rank===1&&st.length>1&&st.every(x=>x.fin)?'Kazandın! 🏆':'Sıran: '+rank+'/'+st.length):'Süren: '+fmt(me.ft)+' · En iyi tur: '+fmt(bestLap);
  st.forEach((x,i)=>{ const li=document.createElement('li');
    const rk=document.createElement('span'); rk.className='rk'; rk.textContent=i+1;
    const dot=document.createElement('span'); dot.className='dot'; dot.style.background=x.color;
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=x.name+(x.me?' (sen)':'');
    const bl=document.createElement('span'); bl.className='tag'; bl.textContent='⏱ '+fmt(x.best);
    const tag=document.createElement('span'); tag.className='tag'+(x.fin?' ok':''); tag.textContent=x.fin?fmt(x.ft):'yarışıyor…';
    li.append(rk,dot,nm,bl,tag); ul.appendChild(li); });
}
setInterval(renderResults,500);
$('againBtn').onclick=()=>{ if(online) enterLobby(); else startRace({id:'solo'+Date.now(),p:['me']}); };
$('menuBtn').onclick=()=>goMenu();

// ---------------- input ----------------
const keys={}, tkeys={}; const edges=[];
addEventListener('keydown',e=>{ if(document.activeElement&&document.activeElement.tagName==='INPUT') return;
  if(!keys[e.code]) edges.push(e.code); keys[e.code]=true;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup',e=>{ keys[e.code]=false; });
addEventListener('blur',()=>{ for(const k in keys) keys[k]=false; });
document.querySelectorAll('.tb').forEach(b=>{ const k=b.dataset.k;
  const on=e=>{ e.preventDefault(); if(k==='cam'){ edges.push('KeyC'); return; } tkeys[k]=true; b.classList.add('on'); };
  const off=e=>{ e.preventDefault(); tkeys[k]=false; b.classList.remove('on'); };
  b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off); b.addEventListener('pointercancel',off); b.addEventListener('pointerleave',off); });
let padPrev=[];
function readInput(){
  let steer=((keys.ArrowRight||keys.KeyD||tkeys.right)?1:0)-((keys.ArrowLeft||keys.KeyA||tkeys.left)?1:0);
  let gas=(keys.ArrowUp||keys.KeyW||tkeys.gas)?1:0, brake=(keys.ArrowDown||keys.KeyS||tkeys.down)?1:0;
  let hand=!!(keys.Space||tkeys.hand), nitro=!!(keys.ShiftLeft||keys.ShiftRight||keys.KeyN||tkeys.nitro), analog=false;
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  for(const gp of pads){ if(!gp) continue;
    const ax=gp.axes[0]||0; if(Math.abs(ax)>0.08){ steer=Math.sign(ax)*Math.pow((Math.abs(ax)-0.08)/0.92,1.4); analog=true; }
    const b=i=>gp.buttons[i]?gp.buttons[i].value||(gp.buttons[i].pressed?1:0):0;
    gas=Math.max(gas,b(7)); brake=Math.max(brake,b(6)); hand=hand||b(0)>0.5; nitro=nitro||b(1)>0.5;
    const press=i=>b(i)>0.5 && !padPrev[i]; if(press(3)) edges.push('KeyC'); if(press(5)) edges.push('KeyE'); if(press(4)) edges.push('KeyQ'); if(press(2)) edges.push('KeyR');
    padPrev=gp.buttons.map(x=>x.pressed); break; }
  return {steer,gas,brake,hand,nitro,analog};
}
const BOT=new URLSearchParams(location.search).has('bot');
function botInput(){
  const c=phys, i=c.hint<0?nearest(c.x,c.y):c.hint, look=Math.round(8+c.speed*0.5);
  const p=TP[(i+look)%N]; let da=Math.atan2(p.y-c.y,p.x-c.x)-c.a; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI;
  let curv=0; for(let k=5;k<60;k+=5){ let d=TP[(i+k+5)%N].a-TP[(i+k)%N].a; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; curv=Math.max(curv,Math.abs(d)); }
  const vmax=Math.max(14,Math.min(80,Math.sqrt(9.0*15/Math.max(curv/15,0.002))));
  return {steer:Math.max(-1,Math.min(1,da*4)), gas:c.speed<vmax?1:0, brake:c.speed>vmax+3?1:0, hand:false, nitro:false, analog:true};
}
function handleEdges(){
  while(edges.length){ const k=edges.shift();
    if(k==='KeyC'){ camMode=(camMode+1)%3; store.set('tp3_cam',camMode); toast(CAM_NAMES[camMode],1500); }
    else if(k==='KeyM'){ audio.setMuted(!audio.muted); toast(audio.muted?'Ses kapalı':'Ses açık',1200); }
    else if(k==='KeyR') respawn();
    else if((k==='KeyE'||k==='KeyX') && phys.manual && mode==='race'){ phys.shift(1); audio.shiftBlip(); }
    else if((k==='KeyQ'||k==='KeyZ') && phys.manual && mode==='race'){ phys.shift(-1); audio.shiftBlip(); }
  }
}

// ---------------- per-frame car visuals ----------------
const _v=new THREE.Vector3(), _q=new THREE.Quaternion(), _m=new THREE.Matrix4();
function placeCar(m,x,y,a,pitch,roll,steer,wheelAng,brake,nitro){
  m.root.position.set(x,0,y); m.root.rotation.y=-a;
  m.body.rotation.set(-roll,0,-pitch); m.body.position.y=0.02;
  for(let i=0;i<4;i++){ const w=m.wheels[i]; if(w.front) w.pivot.rotation.y=-steer; w.spin.rotation.z=-wheelAng[i]; }
  m.steer.rotation.x=steer*12;
  m.brakeMat.emissiveIntensity=brake?4:0.6;
  for(const f of m.flames){ f.visible=nitro; if(nitro){ const s=0.8+Math.random()*0.5; f.scale.set(s,1,1); } }
}
function worldOf(m,lx,ly,lz){ _v.set(lx,ly,lz); return m.body.localToWorld(_v); }
function carEffects(dt){
  const c=phys; const ca=Math.cos(c.a), sa=Math.sin(c.a);
  const wheelsXY=[[CAR.a,-CAR.track],[CAR.a,CAR.track],[-CAR.b,-CAR.track],[-CAR.b,CAR.track]].map(([lx,lz])=>[c.x+ca*lx-sa*lz,c.y+sa*lx+ca*lz]);
  const slideR=Math.max(0,Math.abs(c.slipR)-0.11)*5 + c.spinR + (c.hand&&c.speed>3?0.7:0);
  const slideF=Math.max(0,Math.abs(c.slipF)-0.16)*4;
  for(let i=0;i<4;i++){
    const rear=i>=2, s=rear?slideR:slideF; const [x,z]=wheelsXY[i]; const surf=rear?c.surfR:c.surfF;
    skids.add(i,x,z,c.a, surf!==2 && c.speed>2 ? Math.min(1,s) : 0);
    if(c.speed>2 && surf!==2 && s>0.45 && Math.random()<Math.min(1,s-0.35)*0.8*dt*60) smoke.emit(x,0.25,z,(Math.random()-.5)*1.5-c.vx*0.1,0.6+Math.random(),(Math.random()-.5)*1.5-c.vy*0.1,{size:0.8,grow:2.2,life:1.2+Math.random(),alpha:0.24});
    if(surf===2 && c.speed>3 && Math.random()<0.5*dt*60) smoke.emit(x,0.3,z,-c.vx*0.2+(Math.random()-.5)*2,1+Math.random()*1.5,-c.vy*0.2+(Math.random()-.5)*2,{color:[0.72,0.62,0.45],size:1.1,grow:2.8,life:1.2,alpha:0.4});
  }
  if(c.scrape>0.2 || c.impact>3){ const p=c.impactAt||{lx:0,lz:0}; const wx=c.x+ca*p.lx-sa*p.lz, wz=c.y+sa*p.lx+ca*p.lz;
    for(let k=0;k<(c.impact>3?14:2);k++) smoke.emit(wx,0.5,wz,(Math.random()-.5)*6,1+Math.random()*3,(Math.random()-.5)*6,{color:[1,0.65,0.2],size:0.12,grow:0,life:0.35+Math.random()*0.3,alpha:1,grav:9}); }
  if(c.damage>55 && Math.random()<dt*20*(c.damage/100)){ const p=worldOf(model,1.9,0.9,0); smoke.emit(p.x,p.y,p.z,c.vx*0.3,1.5,c.vy*0.3,{color:[0.25,0.25,0.27],size:0.8,grow:2,life:2,alpha:0.35}); }
}

// ---------------- camera ----------------
const camPos=new THREE.Vector3(), camLook=new THREE.Vector3(); let camInit=false, orbit=0;
function updateCamera(dt){
  const c=phys; const ca=Math.cos(c.a), sa=Math.sin(c.a);
  if(mode==='menu'||mode==='lobby'||mode==='results' && !resultsShown){
    orbit+=dt*0.18; const cx=c.x, cz=c.y; camera.fov=45;
    camera.position.set(cx+Math.cos(orbit)*8.5, 2.3, cz+Math.sin(orbit)*8.5); camera.lookAt(cx,0.7,cz); camera.updateProjectionMatrix(); camInit=false; return;
  }
  const sh=shake; shake=Math.max(0,shake-dt*3);
  const rx=(Math.random()-.5)*sh*0.12, ry=(Math.random()-.5)*sh*0.12;
  if(camMode===0){
    const back=6.6+c.speed*0.012, up=2.25;
    // follow the velocity direction a little when sliding
    const va=c.speed>4?Math.atan2(c.vy,c.vx):c.a; let da=va-c.a; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI; const ha=c.a+da*0.35;
    const tx=c.x-Math.cos(ha)*back, tz=c.y-Math.sin(ha)*back;
    if(!camInit){ camPos.set(tx,up,tz); camInit=true; }
    const k=1-Math.exp(-dt*7); camPos.x+=(tx-camPos.x)*k; camPos.z+=(tz-camPos.z)*k; camPos.y+=(up-camPos.y)*k;
    camera.position.set(camPos.x+rx,camPos.y+ry,camPos.z);
    camLook.set(c.x+ca*2.5,0.9,c.y+sa*2.5); camera.lookAt(camLook);
    camera.fov=60+Math.min(18,c.speed*0.22);
  } else {
    const local = camMode===1 ? [-0.22,1.13,-0.38] : [0.55,1.33,0];
    const p=worldOf(model,...local); camera.position.set(p.x+rx*0.3,p.y+ry*0.3,p.z);
    const look=camMode===1?worldOf(model,6,0.88,-0.38+phys.steer*2.5):worldOf(model,8,1.0,0);
    camera.lookAt(look);
    camera.fov=camMode===1?(70+Math.min(10,c.speed*0.12)):(66+Math.min(14,c.speed*0.18));
    camInit=false;
  }
  camera.updateProjectionMatrix();
  model.interior.visible = camMode===1;
}

// ---------------- HUD ----------------
const _txt={}; function setText(id,v){ v=String(v); if(_txt[id]!==v){ _txt[id]=v; $(id).textContent=v; } }
const mini=$('mini'), mctx=mini.getContext('2d'); let miniBg=null;
const ms=Math.min(mini.width/WORLD.w, mini.height/WORLD.h)*0.92, mox=(mini.width-WORLD.w*ms)/2, moy=(mini.height-WORLD.h*ms)/2;
function renderMini(){
  if(!miniBg){ miniBg=document.createElement('canvas'); miniBg.width=mini.width; miniBg.height=mini.height; const g=miniBg.getContext('2d'); g.translate(mox,moy);
    g.lineJoin='round'; g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=5; drawMinimapTrack(g,ms); g.stroke(); g.strokeStyle='rgba(30,32,38,1)'; g.lineWidth=2.5; drawMinimapTrack(g,ms); g.stroke(); }
  mctx.clearRect(0,0,mini.width,mini.height); mctx.drawImage(miniBg,0,0);
  const dot=(x,y,c,r)=>{ mctx.fillStyle=c; mctx.beginPath(); mctx.arc(mox+x*ms,moy+y*ms,r,0,7); mctx.fill(); mctx.strokeStyle='#000'; mctx.lineWidth=1.5; mctx.stroke(); };
  for(const r of remotes.values()) dot(r.x,r.y,r.color,4.5); dot(phys.x,phys.y,settings.color,6);
}
let frameNo=0, fps=0, fpsN=0, fpsT=performance.now();
function updateHud(){
  const st=standings(), pos=st.findIndex(x=>x.me)+1;
  setText('hLap',Math.min(me.lap+1,LAPS)+'/'+LAPS); setText('hPos',pos+'/'+st.length);
  const now=performance.now();
  setText('hTime',fmt(me.fin?me.ft:elapsed)); setText('hLast',fmt(lastLap)); setText('hBest',fmt(bestLap));
  setText('hCur',mode==='race'&&!me.fin?fmt(now-lapStart):'-:--.---');
  setText('hSpd',phys.kmh); setText('hGear',phys.gearLabel());
  $('rpmBar').style.width=Math.min(100,phys.rpm/80)+'%'; $('rpmBar').classList.toggle('red',phys.rpm>7000);
  $('nitroBar').style.width=(phys.nitro*100)+'%';
  setText('hDmg',Math.round(phys.damage)+'%'); $('hDmg').style.color=phys.damage>60?'#ff6b5a':phys.damage>25?'#ffd32a':'#9ee6a8';
  setText('hNet',fps+' FPS'+(online?(net.isHost?' · oda kurucusu':(net.ping!=null?' · '+net.ping+' ms':'')):'')+(phys.manual?' · manuel':'')+(phys.assists?'':' · yardımsız'));
  if(frameNo%3===0) renderMini();
}

// ---------------- main loop ----------------
const STEP=1/120; let acc=0, last=performance.now();
addEventListener('resize',()=>{ renderer.setSize(innerWidth,innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); });
// park the local car on the grid for the menu showcase
{ const g=gridPos(0); phys.reset(g.x,g.y,g.a); phys.hint=g.i; }

function frame(t){
  requestAnimationFrame(frame);
  const fdt=Math.min(0.1,Math.max(0,(t-last)/1000)); last=t; frameNo++;
  fpsN++; if(t-fpsT>1000){ fps=Math.round(fpsN*1000/(t-fpsT)); fpsN=0; fpsT=t; }
  handleEdges(); if(respawnCool>0) respawnCool-=fdt;
  const inp=BOT&&mode==='race'?botInput():readInput();
  const racing=mode==='race'||mode==='countdown';
  // countdown: five red lights, one per second, then lights out
  if(mode==='countdown'){
    const e=(t-countStart)/1000, n=Math.min(5,Math.floor(e)+0);
    if(n!==lightsShown && e<5){ lightsShown=n; audio.beep(false); }
    const on=e<5?Math.min(5,Math.floor(e)+1):0;
    [...$('lights').children].forEach((el,i)=>el.classList.toggle('on',i<on)); track.startLights.forEach((m,i)=>m.emissiveIntensity=i<on?4:0);
    if(e>=5.4){ mode='race'; raceStart=t; lapStart=t; audio.beep(true); [...$('lights').children].forEach(el=>el.classList.remove('on')); track.startLights.forEach(m=>m.emissiveIntensity=0);
      setTimeout(()=>{ if(mode==='race') $('lights').classList.add('hidden'); },900); }
  }
  if(mode==='race' && !me.fin) elapsed=t-raceStart;
  // physics
  if(racing){
    acc+=fdt; const others=[...remotes.values()];
    const drive = mode==='race' && !me.fin ? inp : {steer:me.fin?0:inp.steer,gas:mode==='countdown'?inp.gas:0,brake:me.fin?0.6:0,hand:false,nitro:false,analog:inp.analog};
    while(acc>=STEP){
      const hx=phys.x,hy=phys.y,ha=phys.a;
      phys.step(STEP,drive,others);
      if(mode==='countdown'){ phys.x=hx; phys.y=hy; phys.a=ha; phys.vx=phys.vy=phys.yawRate=0; }
      if(phys.impact>4){ dentCar(model,phys.impactAt.lx,phys.impactAt.lz,Math.min(3,phys.impact/8)); audio.impact(phys.impact); shake=Math.min(1.5,shake+phys.impact*0.06); phys.impact=0; }
      acc-=STEP;
    }
    if(mode==='race') lapLogic();
    if(online) net.set({x:+phys.x.toFixed(2),y:+phys.y.toFixed(2),a:+phys.a.toFixed(3),v:+phys.vLong.toFixed(2),sr:+phys.steer.toFixed(3),bk:phys.brake>0.1||phys.hand>0,nt:phys.nitroOn,dm:Math.round(phys.damage),lap:me.lap,cp:me.cp,idx:me.idx,fin:me.fin,ft:Math.round(me.ft),best:Math.round(bestLap)});
    if(phys.kerb||phys.surfF===2) shake=Math.max(shake,Math.min(0.35,phys.speed*0.01));
    carEffects(fdt);
  }
  placeCar(model,phys.x,phys.y,phys.a,phys.pitch,phys.rollA,phys.steer,phys.wheelAng,phys.brake>0.1||phys.hand>0,phys.nitroOn);
  // remote cars: dead-reckoning toward the predicted position
  const now=performance.now(), k=1-Math.exp(-fdt*16);
  for(const r of remotes.values()){
    const age=Math.min(0.25,(now-r.t)/1000); const px=r.tx+Math.cos(r.ta)*r.v*age, py=r.ty+Math.sin(r.ta)*r.v*age;
    const ox=r.x, oy=r.y;
    if(Math.hypot(px-r.x,py-r.y)>30){ r.x=px; r.y=py; } r.x+=(px-r.x)*k; r.y+=(py-r.y)*k;
    let da=r.ta-r.a; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI; r.a+=da*k;
    r.vx=fdt>0?(r.x-ox)/fdt:0; r.vy=fdt>0?(r.y-oy)/fdt:0;
    r.steer+=(r.sr-r.steer)*k; r.wheel+=r.v/CAR.wheelR*fdt;
    placeCar(r.model,r.x,r.y,r.a,0,0,r.steer,[r.wheel,r.wheel,r.wheel,r.wheel],r.bk,r.nt);
    r.model.interior.visible=false;
  }
  // sun & shadows follow the player
  sun.position.set(phys.x+sunDir.x*150, sunDir.y*150, phys.y+sunDir.z*150); sun.target.position.set(phys.x,0,phys.y);
  audio.update(phys,fdt,racing);
  updateCamera(fdt);
  smoke.update(fdt,renderer.domElement.height); skids.update();
  if(racing && camMode===1 && frameNo%3===0) drawGauges(model,phys.rpm,phys.kmh,phys.gearLabel(),phys.nitro);
  if(racing) updateHud();
  // render (plus rear-view mirror in cockpit)
  renderer.setScissorTest(false); renderer.setViewport(0,0,innerWidth,innerHeight);
  renderer.render(scene,camera);
  if(racing && camMode===1){
    const w=Math.round(innerWidth*0.26), h=Math.round(w/3.4), x=Math.round((innerWidth-w)/2), y=innerHeight-h-Math.round(innerHeight*0.035);
    const p=worldOf(model,0.3,1.2,0), back=worldOf(model,-20,0.9,0);
    mirrorCam.position.copy(p); mirrorCam.lookAt(back); mirrorCam.aspect=w/h; mirrorCam.updateProjectionMatrix();
    model.root.visible=false;
    renderer.setScissorTest(true); renderer.setScissor(x,y,w,h); renderer.setViewport(x,y,w,h); renderer.render(scene,mirrorCam);
    renderer.setScissorTest(false); model.root.visible=true;
    $('mirrorFrame').style.cssText=`display:block;left:${x-4}px;top:${innerHeight-y-h-4}px;width:${w+8}px;height:${h+8}px`;
  } else $('mirrorFrame').style.display='none';
}
requestAnimationFrame(frame);
window.__game={phys,me,get mode(){return mode;}};
