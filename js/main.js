import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { TP, N, WORLD, buildTrack, drawMinimapTrack, nearest, trackWorld } from './track.js';
import { buildCar, dentCar, repairCar, drawGauges, CAR, makeFleet, loadCarModel } from './car.js';
import { Car, OPTS as PHYS } from './physics.js';
import { CarAudio } from './audio.js';
import { Particles, SkidMarks } from './effects.js';
import { Net } from './net.js';
import { loadCityImages, buildCity, cityWorld, streetName, district, nearestLane, cityMapCanvas, SIZE, P as CP, LANES } from './city.js';
import { Traffic, Pedestrians } from './traffic.js';

const $=id=>document.getElementById(id);
const COLORS=['#e8202a','#1f6fe0','#ff9f1a','#20b956','#8e44ef','#f1f2f6','#202226','#ffd400'];
const LAPS=3, TRAFFIC_N=50;
const store={ get(k){ try{return localStorage.getItem(k);}catch(e){return null;} }, set(k,v){ try{localStorage.setItem(k,v);}catch(e){} } };
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;

const settings={
  quality: store.get('tp3_quality') || null,
  manual: store.get('tp3_manual')==='1', assists: store.get('tp3_assists')!=='0',
  name: store.get('tp_name')||'', color: store.get('tp3_color')||COLORS[0],
  map: store.get('tp4_map')||'city', time: store.get('tp4_time')||'day', weather: store.get('tp6_wx')||'clear',
};
if(!COLORS.includes(settings.color)) settings.color=COLORS[0];

// ---------------- renderer / scene ----------------
const renderer=new THREE.WebGLRenderer({antialias:settings.quality!=='low', powerPreference:'high-performance'});
const DPR=window.devicePixelRatio||1;
let GPU='';
try{ const gl=renderer.getContext(), dbg=gl.getExtension('WEBGL_debug_renderer_info'); GPU=dbg?String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)):''; }catch(e){}
if(!settings.quality){ const weak=/Intel|Mali|Adreno|PowerVR|Apple GPU|SwiftShader|llvmpipe|Radeon\(TM\) Graphics|Radeon Graphics/i.test(GPU); settings.quality=isTouch?'low':weak?'med':'high'; }
const BASE_PR=settings.quality==='high'?Math.min(DPR,1.5):settings.quality==='med'?Math.min(DPR,1.0):Math.min(DPR,1)*0.8;
let curPR=BASE_PR, lastModeT=0; renderer.setPixelRatio(curPR);
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.NeutralToneMapping; renderer.toneMappingExposure=0.9;
renderer.shadowMap.enabled=settings.quality!=='low'; renderer.shadowMap.type=THREE.PCFShadowMap;
document.body.prepend(renderer.domElement); renderer.domElement.id='c';
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xc9d9e8,200,1100);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.05,4000);
const mirrorCam=new THREE.PerspectiveCamera(50,3.2,0.1,500);
const mirrorRT=new THREE.WebGLRenderTarget(560,165,{type:THREE.HalfFloatType});
const mirScene=new THREE.Scene(), mirOrtho=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
{ const q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:mirrorRT.texture,depthTest:false,depthWrite:false,side:THREE.DoubleSide})); q.scale.x=-1; mirScene.add(q); }
const pmrem=new THREE.PMREMGenerator(renderer);
const sky=new Sky(); sky.scale.setScalar(6000); scene.add(sky);
const U=sky.material.uniforms;
const hemi=new THREE.HemisphereLight(0xcfe3ff,0x4a6a35,0.75); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff1dc,2.6); sun.castShadow=renderer.shadowMap.enabled;
const SH=settings.quality==='high'?2048:1024; sun.shadow.mapSize.set(SH,SH);
Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:600}); sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.04;
scene.add(sun); scene.add(sun.target);
const sunDir=new THREE.Vector3();
// stars for the night sky
const stars=(()=>{ const g=new THREE.BufferGeometry(), n=1500, p=new Float32Array(n*3); for(let i=0;i<n;i++){ const v=new THREE.Vector3().randomDirection(); v.y=Math.abs(v.y); v.multiplyScalar(3000); p.set([v.x,v.y,v.z],i*3); }
  g.setAttribute('position',new THREE.BufferAttribute(p,3)); const m=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,fog:false})); m.visible=false; scene.add(m); return m; })();

// post-processing (bloom) on high quality
let composer=null, bloom=null;
if(settings.quality==='high'){
  composer=new EffectComposer(renderer); composer.addPass(new RenderPass(scene,camera));
  try{ const ao=new GTAOPass(scene,camera,innerWidth,innerHeight); ao.updateGtaoMaterial({radius:0.6,distanceExponent:1.4,thickness:1,scale:1.1,samples:12}); ao.blendIntensity=0.85; composer.addPass(ao); }catch(e){ console.warn('AO yok',e); }
  bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),0.35,0.5,0.88); composer.addPass(bloom); composer.addPass(new OutputPass());
}

// ---------------- worlds (built lazily) ----------------
const worlds={};
await Promise.all([loadCarModel(), loadCityImages()]);
const fleet=makeFleet(scene,260,settings.quality);
function ensureWorld(map){
  if(worlds[map]) return worlds[map];
  if(map==='track'){ const t=buildTrack(scene,settings.quality); worlds.track={kind:'track',group:t.group,startLights:t.startLights,phys:trackWorld}; }
  else { const c=buildCity(scene,settings.quality,fleet); const traffic=new Traffic(fleet,TRAFFIC_N);
    const peds=new Pedestrians(scene,settings.quality==='high'?130:settings.quality==='med'?90:40);
    const lampLights=[]; if(settings.quality!=='low') for(let k=0;k<6;k++){ const L=new THREE.PointLight(0xffe2bf,0,32,1.6); scene.add(L); lampLights.push(L); }
    worlds.city={kind:'city',group:c.group,city:c,traffic,peds,phys:cityWorld,lampLights,map:cityMapCanvas()}; }
  return worlds[map];
}
let W=null;   // active world
function useWorld(map){
  W=ensureWorld(map); lastModeT=performance.now();
  for(const k in worlds){ const on=worlds[k]===W; worlds[k].group.visible=on; if(worlds[k].peds) for(const m of worlds[k].peds.meshes) m.visible=on; }
  for(const k of ['body','glass','dark','head','tail']) {}   // fleet only used in the city
  fleetVisible(map==='city');
  phys.world=W.phys; applyTime(settings.time); miniBg=null; $('mini').classList.toggle('sq',map==='track');
}
function fleetVisible(v){ scene.traverse(o=>{ if(o.isInstancedMesh && o.userData.fleet) o.visible=v; }); }

// ---------------- HDR environments (Poly Haven, CC0) ----------------
const ENV_FILES={day:'pedestrian_overpass_1k.hdr',dusk:'venice_sunset_1k.hdr',night:'moonless_golf_1k.hdr'}, envCache={};
const hdr=new HDRLoader();
function loadEnv(t){ if(envCache[t]) return envCache[t];
  envCache[t]=hdr.loadAsync('assets/'+ENV_FILES[t]).then(tex=>{ tex.mapping=THREE.EquirectangularReflectionMapping; const e=pmrem.fromEquirectangular(tex).texture; tex.dispose(); return e; }).catch(()=>null); return envCache[t]; }
// ---------------- time of day ----------------
let nightF=0;
function applyTime(t){
  const city=W&&W.kind==='city';
  if(t==='day'){ sunDir.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-40),THREE.MathUtils.degToRad(140)); sun.color.set(0xfff1dc); sun.intensity=2.6; hemi.intensity=0.75; hemi.color.set(0xcfe3ff); hemi.groundColor.set(0x4a6a35);
    U.turbidity.value=3; U.rayleigh.value=1.2; U.mieCoefficient.value=0.004; sky.visible=true; scene.background=null; scene.fog.color.set(0xc9d9e8); scene.fog.near=city?320:300; scene.fog.far=city?1500:1400; renderer.toneMappingExposure=city?0.82:0.9; nightF=0; }
  else if(t==='dusk'){ sunDir.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-6),THREE.MathUtils.degToRad(250)); sun.color.set(0xffa860); sun.intensity=1.7; hemi.intensity=0.42; hemi.color.set(0xffc9a0); hemi.groundColor.set(0x3a3040);
    U.turbidity.value=7; U.rayleigh.value=2.6; U.mieCoefficient.value=0.006; sky.visible=true; scene.background=null; scene.fog.color.set(0xd59c7c); scene.fog.near=120; scene.fog.far=850; renderer.toneMappingExposure=0.85; nightF=0.55; }
  else { sunDir.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-45),THREE.MathUtils.degToRad(200)); sun.color.set(0x9db4ff); sun.intensity=0.3; hemi.intensity=0.14; hemi.color.set(0x4a5f96); hemi.groundColor.set(0x0b0e14);
    sky.visible=false; scene.background=new THREE.Color(0x060a16); scene.fog.color.set(0x0a1020); scene.fog.near=60; scene.fog.far=650; renderer.toneMappingExposure=1.0; nightF=1; }
  const rainy=(typeof wet!=='undefined' && wet);
  if(rainy){ sun.intensity*=0.12; sun.color.set(0xc8ced6); hemi.intensity*=0.9; hemi.color.set(t==='night'?0x5a6680:0xb8c2cc); U.turbidity.value=12; U.rayleigh.value=0.4; U.mieCoefficient.value=0.02;
    scene.fog.color.set(t==='night'?0x0a0e16:t==='dusk'?0x6e6670:0x9aa3ad); scene.fog.near=t==='night'?40:60; scene.fog.far=t==='night'?420:520; renderer.toneMappingExposure*=0.95;
    sky.visible=false; scene.background=scene.fog.color.clone(); }
  U.sunPosition.value.copy(sunDir); if(U.cloudCoverage){ U.cloudCoverage.value=wet?0.95:0.35; U.cloudDensity.value=wet?0.8:0.35; }
  stars.visible=nightF===1 && !(typeof wet!=='undefined' && wet);
  // reflections & ambient light from a real HDR photo of the sky
  scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture; scene.environmentIntensity=t==='night'?0.06:0.35;
  const want=t; if(rainy && t!=='night'){ scene.environmentIntensity=t==='day'?0.55:0.35; } else loadEnv(t).then(e=>{ if(e && settings.time===want && !wet){ scene.environment=e; scene.environmentIntensity=(t==='day'?0.9:t==='dusk'?0.85:0.9)*(wet?0.6:1); } });
  for(const k in worlds) if(worlds[k].city){ worlds[k].city.setNight(nightF); worlds[k].city.setHaze(t,rainy); }
  smoke.mat.uniforms.lit.value=t==='night'?0.32:t==='dusk'?0.75:1;
  fleet.night=nightF>0.5; headlightsOn=nightF>0.5;
  if(bloom){ bloom.enabled=nightF>0; bloom.strength=nightF===1?0.32:0.18; bloom.radius=0.35; bloom.threshold=nightF===1?0.96:1.05; }
}

// ---------------- weather: rain, wet roads, light reflections ----------------
let wet=false;
const rain=(()=>{ const n=settings.quality==='low'?1500:4000, pos=new Float32Array(n*6), g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  const m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xaab4c0,transparent:true,opacity:0.38,fog:false})); m.frustumCulled=false; m.visible=false; scene.add(m);
  const drops=[]; for(let i=0;i<n;i++) drops.push({x:(Math.random()-.5)*60,y:Math.random()*30,z:(Math.random()-.5)*60,v:16+Math.random()*6});
  return {m,drops,pos,g};
})();
function updateRain(dt){
  if(!rain.m.visible) return; const cx=camera.position.x, cy=camera.position.y, cz=camera.position.z, P=rain.pos, wind=-1.2;
  const vx=phys.vx||0, vz=phys.vy||0;
  rain.drops.forEach((d,i)=>{ d.y-=d.v*dt; d.x+=wind*dt;
    if(d.y<cy-8||d.y<0.05){ d.y=cy+10+Math.random()*12; d.x=(Math.random()-.5)*60; d.z=(Math.random()-.5)*60; }
    const x=cx+d.x, z=cz+d.z, len=0.45+Math.min(0.6,Math.hypot(vx,vz)*0.01);
    P[i*6]=x; P[i*6+1]=d.y; P[i*6+2]=z; P[i*6+3]=x+wind*0.03-vx*0.012*len; P[i*6+4]=d.y+len; P[i*6+5]=z-vz*0.012*len; });
  rain.g.attributes.position.needsUpdate=true;
}
const streakTex=(()=>{ const c=document.createElement('canvas'); c.width=64; c.height=256; const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(0.15,'rgba(255,255,255,.9)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=gr; g.fillRect(0,0,64,256);
  const id=g.getImageData(0,0,64,256); for(let y=0;y<256;y++) for(let x=0;x<64;x++){ const k=Math.max(0,1-Math.abs(x-32)/32); id.data[(y*64+x)*4+3]*=k*k; } g.putImageData(id,0,0);
  return new THREE.CanvasTexture(c); })();
const STREAKS=64;
const streaks=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2).translate(0,0,-0.5),new THREE.MeshBasicMaterial({map:streakTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,fog:true}),STREAKS);
streaks.frustumCulled=false; streaks.visible=false; streaks.count=0; scene.add(streaks); streaks.renderOrder=3;
const _sm=new THREE.Object3D(), _sc=new THREE.Color();
function updateStreaks(){
  if(!streaks.visible || !W || W.kind!=='city') { streaks.count=0; return; }
  const cx=camera.position.x, cz=camera.position.z; const list=[];
  const night=nightF>0.3;
  if(night) for(const l of W.city.lamps){ const th=-l[2], x=l[0]+2*Math.sin(th), z=l[1]+2*Math.cos(th); if((x-cx)**2+(z-cz)**2<90*90) list.push([x,z,1.0,0.82,0.6,2.6,16]); }
  for(const c of W.traffic.cars){ const d=(c.x-cx)**2+(c.y-cz)**2; if(d>70*70) continue; const ca=Math.cos(c.a), sa=Math.sin(c.a);
    if(c.brake||night) list.push([c.x-ca*2.4,c.y-sa*2.4,c.brake?1.4:0.6,0.05,0.03,1.1,5]);
    if(night) list.push([c.x+ca*2.4,c.y+sa*2.4,0.9,0.85,0.7,1.2,5]); }
  list.sort((a,b)=>((a[0]-cx)**2+(a[1]-cz)**2)-((b[0]-cx)**2+(b[1]-cz)**2));
  const n=Math.min(STREAKS,list.length);
  for(let i=0;i<n;i++){ const [x,z,r,g,b,w,len]=list[i]; const ang=Math.atan2(cx-x,cz-z);
    _sm.position.set(x,0.03,z); _sm.rotation.set(0,ang+Math.PI,0); _sm.scale.set(w,1,len); _sm.updateMatrix(); streaks.setMatrixAt(i,_sm.matrix); streaks.setColorAt(i,_sc.setRGB(r*0.7,g*0.7,b*0.7)); }
  streaks.count=n; streaks.instanceMatrix.needsUpdate=true; if(streaks.instanceColor) streaks.instanceColor.needsUpdate=true;
}
// ---- raindrops on the windscreen + wiper sweep (cockpit / hood cameras) ----
const dropC=$('drops'), dctx=dropC.getContext('2d'); const drops=[]; let wiperT=0, dropsOn=false;
function drawDrops(dt,on){
  if(on!==dropsOn){ dropsOn=on; dropC.style.display=on?'block':'none'; if(!on){ drops.length=0; } }
  if(!on) return;
  const W=Math.round(innerWidth*0.5), H=Math.round(innerHeight*0.5); if(dropC.width!==W||dropC.height!==H){ dropC.width=W; dropC.height=H; } const g=dctx; g.clearRect(0,0,W,H);
  const sp=phys.speed||0; const rate=(40+sp*1.2)*dt; for(let i=0;i<rate;i++) if(drops.length<260) drops.push({x:Math.random(),y:Math.random()*0.72,r:0.6+Math.random()*2.2,v:0,life:1});
  wiperT+=dt; const period=sp>15?1.1:2.0, ph=(wiperT%period)/period, sweep=ph<0.5?ph*2:2-ph*2, wa=-Math.PI*0.08-sweep*Math.PI*0.84;
  const pivX=0.38*W, pivY=0.98*H, L=0.78*H;
  for(let i=drops.length-1;i>=0;i--){ const d=drops[i];
    d.y+=(sp>12? -sp*0.0009 : 0.004+d.r*0.002)*dt*10; d.x+=(d.x-0.5)*sp*0.0004*dt*10;
    const px=d.x*W, py=d.y*H; const dx=px-pivX, dy=py-pivY, da=Math.atan2(dy,dx); const dist=Math.hypot(dx,dy);
    if(dist<L && Math.abs(((da-wa+Math.PI*3)%(Math.PI*2))-Math.PI)<0.06) { drops.splice(i,1); continue; }
    if(d.y<-0.02||d.y>0.75||d.x<0||d.x>1){ drops.splice(i,1); continue; }
    const r=d.r*(W/700); const gr=g.createRadialGradient(px-r*0.3,py-r*0.4,r*0.1,px,py,r);
    gr.addColorStop(0,'rgba(255,255,255,.55)'); gr.addColorStop(0.45,'rgba(180,195,210,.18)'); gr.addColorStop(0.85,'rgba(20,25,30,.28)'); gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr; g.beginPath(); g.arc(px,py,r,0,Math.PI*2); g.fill(); }
  // wiper blade
  if(camMode===1){ g.strokeStyle='rgba(8,8,10,.92)'; g.lineWidth=Math.max(2,H*0.012); g.lineCap='round'; g.beginPath(); g.moveTo(pivX,pivY); g.lineTo(pivX+Math.cos(wa)*L,pivY+Math.sin(wa)*L); g.stroke(); }
}
function applyWeather(wx){
  settings.weather=wx; wet=wx==='rain'; PHYS.wet=wet; rain.m.visible=wet; streaks.visible=wet; audio.wet=wet;
  for(const k in worlds) if(worlds[k].city) worlds[k].city.setWet(wet);
  applyTime(settings.time);
}

// ---------------- local car ----------------
const phys=new Car(); phys.manual=settings.manual; phys.assists=settings.assists; phys.world=trackWorld;
const model=buildCar(settings.color); scene.add(model.root);
let mirrorPlane=null;
if(model.setPose){ const mg=new THREE.PlaneGeometry(0.228,0.058); const uv=mg.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i,1-uv.getX(i)); mg.rotateY(-Math.PI/2);
  const am=document.createElement('canvas'); am.width=256; am.height=64; { const g=am.getContext('2d'); g.fillStyle='#000'; g.fillRect(0,0,256,64); g.fillStyle='#fff'; g.beginPath(); g.roundRect(3,3,250,58,26); g.fill(); }
  mirrorPlane=new THREE.Mesh(mg,new THREE.MeshBasicMaterial({map:mirrorRT.texture,alphaMap:new THREE.CanvasTexture(am),alphaTest:0.5,fog:false})); mirrorPlane.position.set(0.471,1.0925,-0.007); mirrorPlane.rotation.y=-0.14; mirrorPlane.visible=false; model.body.add(mirrorPlane); }
const headSpot=new THREE.SpotLight(0xfff2d8,0,90,0.55,0.45,1.2); headSpot.position.set(2.1,0.7,0); model.body.add(headSpot);
const headTarget=new THREE.Object3D(); headTarget.position.set(25,-1.5,0); model.body.add(headTarget); headSpot.target=headTarget;
let headlightsOn=false;
let cubeRT=null, cubeCam=null;
if(settings.quality==='high' && model.setEnvMap){ cubeRT=new THREE.WebGLCubeRenderTarget(96,{type:THREE.HalfFloatType}); cubeCam=new THREE.CubeCamera(0.3,350,cubeRT); scene.add(cubeCam); }
function updateReflections(){
  if(!cubeCam) return; const au=renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate=false;
  model.root.visible=false; rain.m.visible=false; cubeCam.position.set(phys.x,1.0,phys.y); cubeCam.update(renderer,scene);
  model.root.visible=true; rain.m.visible=wet; renderer.shadowMap.autoUpdate=au;
  if(!updateReflections.on){ model.setEnvMap(cubeRT.texture); updateReflections.on=true; }
}
function setMyColor(c){ settings.color=c; model.paint.color.set(c); }
const smoke=new Particles(scene,settings.quality==='low'?250:700);
const skids=new SkidMarks(scene,settings.quality==='low'?1200:3500);
const audio=new CarAudio();

const remotes=new Map();
function nameSprite(text){
  const c=document.createElement('canvas'); c.width=256; c.height=64; const g=c.getContext('2d');
  g.font='bold 34px Inter,sans-serif'; const w=Math.min(250,g.measureText(text).width+28);
  g.fillStyle='rgba(10,12,18,.72)'; g.beginPath(); g.roundRect((256-w)/2,6,w,50,14); g.fill(); g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,128,32);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,toneMapped:false})); s.scale.set(3.2,0.8,1); return s;
}

// ---------------- state ----------------
let mode='menu', online=false, ready=false, raceId=null, racers=[], seenRaces=new Set();
let countStart=0, raceStart=0, elapsed=0, lapStart=0, lastLap=0, bestLap=0, resultsShown=false, lightsShown=-1;
let camMode=+(store.get('tp3_cam')||0);
const CAM_NAMES=['Takip kamerası','Kokpit','Kaput kamerası'];
const me={lap:0,cp:0,idx:0,prevIdx:0,fin:false,ft:0};
let shake=0, respawnCool=0, horn=false;

// ---------------- UI ----------------
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
seg('mSeg',settings.map,v=>{ settings.map=v; store.set('tp4_map',v); toast(v==='city'?'Harita yükleniyor…':'Pist yükleniyor…',1200); setTimeout(()=>{ useWorld(v); parkShowcase(); updateMenuLabels(); },30); });
seg('tSeg',settings.time,v=>{ settings.time=v; store.set('tp4_time',v); applyTime(v); });
seg('wSeg',settings.weather,v=>{ store.set('tp6_wx',v); applyWeather(v); if(online&&net.isHost) net.set({wx:v}); });
function setupMenuSegs(){ seg('gSeg',settings.manual?'manual':'auto',v=>{ settings.manual=v==='manual'; phys.manual=settings.manual; store.set('tp3_manual',settings.manual?'1':'0'); }); seg('tSeg',settings.time,v=>{ settings.time=v; store.set('tp4_time',v); applyTime(v); }); seg('wSeg',settings.weather,v=>{ store.set('tp6_wx',v); applyWeather(v); if(online&&net.isHost) net.set({wx:v}); }); }
function updateMenuLabels(){ $('soloBtn').textContent=settings.map==='city'?'Tek Başına Gez':'Tek Başına Antrenman'; }
function cleanName(){ return (nameIn.value.trim()||'Pilot').slice(0,14); }
function show(id){ ['menu','lobby','results','pause'].forEach(p=>$(p).classList.toggle('hidden',p!==id)); }
function toast(msg,ms=2500){ const t=$('toast'); t.textContent=msg; t.style.opacity=1; clearTimeout(toast._t); toast._t=setTimeout(()=>t.style.opacity=0,ms); }
function saveName(){ settings.name=cleanName(); store.set('tp_name',settings.name); }

// ---------------- network ----------------
let peers=[];
const net=new Net(ps=>{ peers=ps; onPeersChanged(); }, ()=>{ goMenu(); }, toast);
net.onExtra=d=>{ if(d.k==='tr' && W && W.traffic && !net.isHost) W.traffic.unpack(d.d); };
const netNote=$('netNote');
if(net.available){ $('joinBtn').disabled=false; netNote.innerHTML='Aynı oda kodunu giren herkes aynı haritaya katılır (haritayı odayı açan seçer). Lobideki <b>Davet linkini kopyala</b> ile arkadaşına link gönder.'; }
else netNote.innerHTML='<span class="warn">Bağlantı kütüphanesi yüklenemedi.</span> İnterneti kontrol edip sayfayı yenile.';
const myPres=()=>({name:settings.name,color:settings.color});

$('joinBtn').onclick=async()=>{
  if(!net.available) return; saveName(); audio.start();
  const code=(codeIn.value||randCode()).toUpperCase(); codeIn.value=code; store.set('tp_code',code);
  $('joinBtn').disabled=true; $('joinBtn').textContent='Bağlanıyor…';
  try{ await net.join(code); }
  catch(e){ $('joinBtn').disabled=false; $('joinBtn').textContent='Odaya Gir'; toast('Odaya bağlanılamadı ('+((e&&e.type)||'hata')+')',4000); return; }
  $('joinBtn').disabled=false; $('joinBtn').textContent='Odaya Gir';
  online=true; seenRaces=new Set(); $('lobbyCode').textContent=code;
  if(net.isHost){ net.set({...myPres(), map:settings.map, wx:settings.weather, ready:false, st:'lobby', raceId:null, race:null}); net.rebuild();
    if(settings.map==='city') startFree(); else enterLobby(); }
  else { net.set({...myPres(), ready:false, st:'lobby', raceId:null}); enterLobby(); $('lobbyNote').textContent='Oda kurucusunun haritası bekleniyor…'; }
};
$('soloBtn').onclick=()=>{ saveName(); audio.start(); online=false; if(settings.map==='city') startFree(); else startRace({id:'solo'+Date.now(), p:['me']}); };
$('copyBtn').onclick=async()=>{ const url=location.origin+location.pathname+'?oda='+encodeURIComponent($('lobbyCode').textContent);
  try{ await navigator.clipboard.writeText(url); toast('Link kopyalandı ✓ Arkadaşına gönder'); }catch(e){ toast(url,6000); } };
$('freeCopy').onclick=()=>$('copyBtn').onclick();
function enterLobby(){
  mode='lobby'; ready=false; resultsShown=false; raceId=null; clearRemotes();
  net.set({ready:false, st:'lobby', raceId:null, fin:null, x:null});
  $('readyBtn').textContent='Hazırım'; $('readyBtn').classList.add('go');
  show('lobby'); hud(false); renderLobby();
}
$('readyBtn').onclick=()=>{ ready=!ready; net.set({ready}); $('readyBtn').textContent=ready?'Hazır değilim':'Hazırım'; $('readyBtn').classList.toggle('go',!ready); renderLobby(); checkHost(); };
$('leaveBtn').onclick=()=>goMenu();
function goMenu(){ net.leave(); online=false; peers=[]; clearRemotes(); mode='menu'; resultsShown=false; show('menu'); hud(false); parkShowcase(); for(const id in (audio.horns||{})) audio.horn(id,false); }
function hud(on){ $('hud').classList.toggle('hidden',!on); $('touch').classList.toggle('hidden',!(on&&isTouch)); $('lights').classList.add('hidden');
  const free=mode==='free'; $('tl').classList.toggle('hidden',free); $('street').classList.toggle('hidden',!free); $('freeBar').classList.toggle('hidden',!free); }
$('resumeBtn').onclick=()=>{ show(null); paused=false; };
$('respawnBtn').onclick=()=>{ show(null); paused=false; respawnCool=0; respawn(); };
function openPause(){ paused=true; show('pause');
  const canWx=!online||net.isHost; $('pauseNote').textContent=canWx?'Esc ile devam edebilirsin.':'Saat ve havayı oda kurucusu belirler.';
  seg('pCam',String(camMode),v=>{ camMode=+v; store.set('tp3_cam',camMode); });
  seg('pTime',settings.time,v=>{ settings.time=v; store.set('tp4_time',v); applyTime(v); seg('tSeg',v,()=>{}); setupMenuSegs(); });
  seg('pWx',settings.weather,v=>{ store.set('tp6_wx',v); applyWeather(v); if(online&&net.isHost) net.set({wx:v}); setupMenuSegs(); });
  seg('pGear',settings.manual?'manual':'auto',v=>{ settings.manual=v==='manual'; phys.manual=settings.manual; store.set('tp3_manual',settings.manual?'1':'0'); setupMenuSegs(); });
  seg('pSnd',audio.muted?'off':'on',v=>{ audio.setMuted(v==='off'); });
  for(const id of ['pTime','pWx']) $(id).style.opacity=canWx?1:0.45, $(id).style.pointerEvents=canWx?'auto':'none'; }
$('pauseMenuBtn').onclick=()=>{ paused=false; goMenu(); };
let paused=false;

const safeColor=c=>COLORS.includes(c)?c:'#888';
const safeName=s=>(typeof s==='string'?s:'Pilot').replace(/[\u0000-\u001f]/g,'').slice(0,14)||'Pilot';
const named=()=>peers.filter(p=>p.p && typeof p.p.name==='string');
function renderLobby(){
  if(mode!=='lobby') return;
  const ul=$('plist'); ul.innerHTML='';
  for(const p of named()){
    const li=document.createElement('li');
    const dot=document.createElement('span'); dot.className='dot'; dot.style.background=safeColor(p.p.color);
    const nm=document.createElement('span'); nm.className='nm'; nm.textContent=safeName(p.p.name)+(p.me?' (sen)':'')+(p.id===net.hostId?' 👑':'');
    const tag=document.createElement('span'); tag.className='tag';
    if(p.p.st==='race') tag.textContent='yarışta'; else if(p.p.st==='free') tag.textContent='şehirde'; else if(p.p.ready){ tag.textContent='hazır ✓'; tag.classList.add('ok'); } else tag.textContent='bekliyor';
    li.append(dot,nm,tag); ul.appendChild(li);
  }
  const n=named().filter(p=>p.p.st==='lobby').length;
  $('lobbyNote').textContent = n<2 ? 'Arkadaşının bu oda koduyla girmesini bekle…' : 'Herkes "Hazırım" deyince yarış başlar.';
}
function hostPres(){ const h=peers.find(p=>p.id===net.hostId); return h&&h.p||null; }
function onPeersChanged(){
  // follow the host's map choice
  const hp=hostPres();
  if(online && !net.isHost && hp && hp.wx && hp.wx!==settings.weather){ applyWeather(hp.wx); }
  if(online && !net.isHost && hp && hp.map && (mode==='lobby')){
    if(hp.map!==settings.map){ settings.map=hp.map; useWorld(hp.map); }
    if(hp.map==='city'){ startFree(); return; }
  }
  for(const p of peers){ const r=p.p&&p.p.race; if(r && typeof r.id==='string' && Array.isArray(r.p)) handleRace(r); }
  if(raceId || mode==='free'){
    const alive=new Set();
    for(const p of peers){ if(p.me) continue; const s=p.p||{}; const inMine= mode==='free' ? s.st==='free' : s.raceId===raceId; if(!inMine || typeof s.x!=='number') continue;
      alive.add(p.id); let r=remotes.get(p.id);
      if(!r){ const m=buildCar(safeColor(s.color)); scene.add(m.root); const label=nameSprite(safeName(s.name)); label.position.y=2.1; m.root.add(label);
        r={model:m,x:s.x,y:s.y,a:s.a||0,v:0,vx:0,vy:0,steer:0,t:performance.now(),wheel:0}; remotes.set(p.id,r); }
      if(r.tx!==s.x||r.ty!==s.y||r.ta!==s.a) r.t=performance.now();
      r.tx=s.x; r.ty=s.y; r.ta=s.a||0; r.v=+s.v||0; r.sr=+s.sr||0; r.bk=!!s.bk; r.nt=!!s.nt; r.hn=!!s.hn; r.hl=!!s.hl;
      r.name=safeName(s.name); r.color=safeColor(s.color); r.lap=s.lap|0; r.cp=s.cp|0; r.idx=s.idx|0; r.fin=!!s.fin; r.ft=+s.ft||0; r.best=+s.best||0;
    }
    for(const [k,r] of [...remotes]) if(!alive.has(k)){ scene.remove(r.model.root); audio.horn(k,false); remotes.delete(k); }
  }
  renderLobby(); checkHost();
}
function clearRemotes(){ for(const [k,r] of remotes){ scene.remove(r.model.root); audio.horn(k,false); } remotes.clear(); }
function checkHost(){
  if(!online||mode!=='lobby'||!net.isHost||settings.map!=='track') return;
  const lp=named().filter(p=>p.p.st==='lobby'); if(lp.length<2 || !lp.every(p=>p.p.ready)) return;
  const race={id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), p:lp.map(p=>p.id).sort()};
  net.set({race}); handleRace(race);
}
function handleRace(r){ if(seenRaces.has(r.id)) return; seenRaces.add(r.id); if(mode!=='lobby' || !r.p.includes(net.myId)) return; startRace(r); }

// ---------------- free roam ----------------
function startFree(){
  useWorld('city'); clearRemotes(); skids.clear(); repairCar(model); raceId=null;
  // spawn on a random outer lane, spread players apart
  const k=Math.floor(Math.random()*8); const i=1+Math.floor(Math.random()*8);
  const sp=[{x:i*CP+30,y:k*CP+LANES[1],a:0},{x:k*CP-LANES[1],y:i*CP+30,a:Math.PI/2}][Math.random()<0.5?0:1];
  phys.reset(sp.x,sp.y,sp.a); phys.manual=settings.manual; phys.assists=settings.assists;
  mode='free'; show(null); hud(true); camInit=false; lastModeT=performance.now();
  toast(`Şehirde serbest sürüş · ${CAM_NAMES[camMode]} (C) · Korna (H) · Esc menü`,4000);
  if(online) net.set({...myPres(), st:'free', ready:false, raceId:null, map:net.isHost?'city':undefined});
}

// ---------------- race ----------------
function gridPos(slot){ const row=Math.floor(slot/2), col=slot%2; const gi=(N-6-row*3+N)%N; const p=TP[gi]; const off=(col?1:-1)*2.8; return {x:p.x+p.nx*off, y:p.y+p.ny*off, a:p.a, i:gi}; }
function startRace(r){
  useWorld('track'); raceId=r.id; racers=r.p.slice(0,8); clearRemotes(); skids.clear(); repairCar(model);
  const me_id=online?net.myId:'me'; const g=gridPos(Math.max(0,racers.indexOf(me_id)));
  phys.reset(g.x,g.y,g.a); phys.manual=settings.manual; phys.assists=settings.assists; phys.hint=g.i;
  Object.assign(me,{lap:0,cp:0,idx:g.i,prevIdx:g.i,fin:false,ft:0}); lastLap=0; bestLap=0; elapsed=0; resultsShown=false; lightsShown=-1;
  mode='countdown'; countStart=performance.now(); show(null); hud(true); $('lights').classList.remove('hidden');
  toast(`${CAM_NAMES[camMode]} · C ile değiştir`,2500);
  net.set({...myPres(), st:'race', ready:false, raceId, x:+g.x.toFixed(2), y:+g.y.toFixed(2), a:+g.a.toFixed(3), v:0, lap:0, cp:0, idx:g.i, fin:false, ft:0});
}
function respawn(){
  if(respawnCool>0) return;
  if(mode==='race' && !me.fin){ respawnCool=3; const i=nearest(phys.x,phys.y); const p=TP[i]; phys.x=p.x; phys.y=p.y; phys.a=p.a; phys.hint=i; }
  else if(mode==='free'){ respawnCool=2; const l=nearestLane(phys.x,phys.y); phys.x=l.x; phys.y=l.y; phys.a=l.a; }
  else return;
  phys.vx=phys.vy=phys.yawRate=0; phys.steer=0; toast('Yola geri dönüldü');
}
function progOf(lap,cp,idx){ return lap*N + ((cp===0 && idx>N/2) ? idx-N : idx); }
function standings(){
  const list=[{name:settings.name,color:settings.color,me:true,prog:progOf(me.lap,me.cp,me.idx),fin:me.fin,ft:me.ft,best:bestLap}];
  for(const r of remotes.values()) list.push({name:r.name,color:r.color,prog:progOf(r.lap,r.cp,r.idx),fin:r.fin,ft:r.ft,best:r.best});
  list.sort((a,b)=>(a.fin&&b.fin)?a.ft-b.ft:a.fin?-1:b.fin?1:b.prog-a.prog); return list;
}
const fmt=ms=>{ if(!ms) return '-:--.---'; const m=Math.floor(ms/60000), s=Math.floor(ms/1000)%60, c=Math.floor(ms)%1000; return m+':'+String(s).padStart(2,'0')+'.'+String(c).padStart(3,'0'); };
function lapLogic(){
  const ni=phys.hint; me.prevIdx=me.idx; me.idx=ni; if(me.fin) return;
  if(me.cp<3){ const lo=Math.floor((me.cp+1)*N/4); if(ni>=lo && ni<lo+Math.floor(N*0.12)) me.cp++; }
  else if(me.prevIdx>N*0.85 && ni<N*0.15){
    const now=performance.now(); const lt=now-lapStart; lapStart=now; lastLap=lt; if(!bestLap||lt<bestLap) bestLap=lt;
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
  let hand=!!(keys.Space||tkeys.hand), nitro=!!(keys.ShiftLeft||keys.ShiftRight||keys.KeyN||tkeys.nitro), analog=false, hn=!!(keys.KeyH||tkeys.horn);
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  for(const gp of pads){ if(!gp) continue;
    const ax=gp.axes[0]||0; if(Math.abs(ax)>0.08){ steer=Math.sign(ax)*Math.pow((Math.abs(ax)-0.08)/0.92,1.4); analog=true; }
    const b=i=>gp.buttons[i]?gp.buttons[i].value||(gp.buttons[i].pressed?1:0):0;
    gas=Math.max(gas,b(7)); brake=Math.max(brake,b(6)); hand=hand||b(0)>0.5; nitro=nitro||b(1)>0.5; hn=hn||b(10)>0.5||b(11)>0.5;
    const press=i=>b(i)>0.5 && !padPrev[i]; if(press(3)) edges.push('KeyC'); if(press(5)) edges.push('KeyE'); if(press(4)) edges.push('KeyQ'); if(press(2)) edges.push('KeyR'); if(press(9)) edges.push('Escape');
    padPrev=gp.buttons.map(x=>x.pressed); break; }
  return {steer,gas,brake,hand,nitro,analog,horn:hn};
}
function handleEdges(){
  while(edges.length){ const k=edges.shift();
    if(k==='KeyC'){ camMode=(camMode+1)%3; store.set('tp3_cam',camMode); toast(CAM_NAMES[camMode],1500); }
    else if(k==='KeyM'){ audio.setMuted(!audio.muted); toast(audio.muted?'Ses kapalı':'Ses açık',1200); }
    else if(k==='KeyL'){ headlightsOn=!headlightsOn; toast(headlightsOn?'Farlar açık':'Farlar kapalı',1000); }
    else if(k==='KeyR') respawn();
    else if(k==='Escape' && (mode==='free'||mode==='race')){ if(paused){ paused=false; show(null); } else openPause(); }
    else if((k==='KeyE'||k==='KeyX') && phys.manual){ phys.shift(1); audio.shiftBlip(); }
    else if((k==='KeyQ'||k==='KeyZ') && phys.manual){ phys.shift(-1); audio.shiftBlip(); }
  }
}

// ---------------- visuals ----------------
const _v=new THREE.Vector3();
function placeCar(m,x,y,a,pitch,roll,steer,wheelAng,brake,nitro,bump=0,lights=headlightsOn,gh=null){
  m.root.position.set(x,0,y); m.root.rotation.order='YXZ'; m.root.rotation.y=-a;
  if(gh){ m.gY=(m.gY||0)+(((gh.f+gh.r)/2)-(m.gY||0))*0.35; m.gS=(m.gS||0)+(Math.atan2(gh.f-gh.r,CAR.a+CAR.b)-(m.gS||0))*0.35; m.root.position.y=m.gY; m.root.rotation.z=m.gS; }
  m.body.rotation.set(-roll,0,-pitch); m.body.position.y=(m.setPose?0:0.02)+bump;
  if(m.setPose) m.setPose(steer,wheelAng);
  else { for(let i=0;i<4;i++){ const w=m.wheels[i]; if(w.front) w.pivot.rotation.y=-steer; w.spin.rotation.z=-wheelAng[i]; } m.steer.rotation.x=steer*12; }
  m.brakeMat.emissiveIntensity=brake?6:(lights?1.6:0.35); if(m.brake3Mat) m.brake3Mat.emissiveIntensity=brake?5:0;
  if(m.headMat) m.headMat.emissiveIntensity=lights?3.5:0.15;
  for(const f of m.flames){ f.visible=nitro; if(nitro){ const s=0.8+Math.random()*0.5; f.scale.set(s,1,1); } }
}
function worldOf(m,lx,ly,lz){ _v.set(lx,ly,lz); return m.body.localToWorld(_v); }
function carEffects(dt){
  const c=phys; const ca=Math.cos(c.a), sa=Math.sin(c.a);
  const wheelsXY=[[CAR.a,-CAR.track],[CAR.a,CAR.track],[-CAR.b,-CAR.track],[-CAR.b,CAR.track]].map(([lx,lz])=>[c.x+ca*lx-sa*lz,c.y+sa*lx+ca*lz]);
  const slideR=Math.max(0,Math.abs(c.slipR)-0.11)*5 + c.spinR + (c.hand&&c.speed>3?0.7:0);
  const slideF=Math.max(0,Math.abs(c.slipF)-0.16)*4;
  for(let i=0;i<4;i++){
    const rear=i>=2, s=rear?slideR:slideF; const [x,z]=wheelsXY[i]; const surf=rear?c.surfR:c.surfF; const loose=surf===2||surf===4;
    const spinning=rear&&c.burnout; skids.add(i,x,z,c.a, !loose && (c.speed>2||spinning) ? Math.min(1,s) : 0);
    if(spinning && !loose && Math.random()<0.3*dt*60) smoke.emit(x+(Math.random()-.5)*0.4,0.3,z+(Math.random()-.5)*0.4,(Math.random()-.5)*2.5-1.2*Math.cos(c.a),0.9+Math.random()*1.2,(Math.random()-.5)*2.5-1.2*Math.sin(c.a),{size:0.9,grow:2.8,life:1.6+Math.random()*0.8,alpha:0.2});
    if(c.speed>2 && !loose && s>0.45 && Math.random()<Math.min(1,s-0.35)*0.8*dt*60) smoke.emit(x,0.25,z,(Math.random()-.5)*1.5-c.vx*0.1,0.6+Math.random(),(Math.random()-.5)*1.5-c.vy*0.1,{size:0.8,grow:2.2,life:1.2+Math.random(),alpha:0.24});
    if(loose && c.speed>3 && Math.random()<0.5*dt*60) smoke.emit(x,0.3,z,-c.vx*0.2+(Math.random()-.5)*2,1+Math.random()*1.5,-c.vy*0.2+(Math.random()-.5)*2,{color:surf===4?[0.45,0.5,0.32]:[0.72,0.62,0.45],size:1.1,grow:2.8,life:1.2,alpha:0.35});
  }
  if(c.scrape>0.2 || c.impact>3){ const p=c.impactAt||{lx:0,lz:0}; const wx=c.x+ca*p.lx-sa*p.lz, wz=c.y+sa*p.lx+ca*p.lz;
    for(let k=0;k<(c.impact>3?14:2);k++) smoke.emit(wx,0.5,wz,(Math.random()-.5)*6,1+Math.random()*3,(Math.random()-.5)*6,{color:[1,0.65,0.2],size:0.12,grow:0,life:0.35+Math.random()*0.3,alpha:1,grav:9}); }
  if(wet && c.speed>8){ for(const i of [2,3]){ const [x,z]=wheelsXY[i]; if(Math.random()<Math.min(1,c.speed*0.02)) smoke.emit(x,0.25,z,-c.vx*0.25+(Math.random()-.5)*2,0.6+Math.random(),-c.vy*0.25+(Math.random()-.5)*2,{color:[0.78,0.8,0.84],size:0.45,grow:1.9,life:0.6,alpha:0.1}); } }
  if(c.damage>55 && Math.random()<dt*20*(c.damage/100)){ const p=worldOf(model,1.9,0.9,0); smoke.emit(p.x,p.y,p.z,c.vx*0.3,1.5,c.vy*0.3,{color:[0.25,0.25,0.27],size:0.8,grow:2,life:2,alpha:0.35}); }
}

// ---------------- camera ----------------
const camPos=new THREE.Vector3(), camLook=new THREE.Vector3(), headG={x:0,z:0}; let camInit=false, orbit=0;
function parkShowcase(){ if(W.kind==='track'){ const g=gridPos(0); phys.reset(g.x,g.y,g.a); phys.hint=g.i; } else { phys.reset(3*CP+50,6*CP+31,0.25); } }
function updateCamera(dt){
  const c=phys; const ca=Math.cos(c.a), sa=Math.sin(c.a);
  if(window.__cam){ const d=window.__cam; camera.position.set(...d.p); camera.lookAt(...d.l); camera.fov=d.fov||55; camera.updateProjectionMatrix(); return; }
  if(mode==='menu'||mode==='lobby'){
    orbit+=dt*0.15; camera.fov=45;
    camera.position.set(c.x+Math.cos(orbit)*7.5, 2.0, c.y+Math.sin(orbit)*7.5); camera.lookAt(c.x,0.8,c.y); camera.updateProjectionMatrix(); camInit=false; return;
  }
  const sh=shake; shake=Math.max(0,shake-dt*3);
  const rx=(Math.random()-.5)*sh*0.12, ry=(Math.random()-.5)*sh*0.12;
  if(camMode===0){
    const back=6.4+c.speed*0.012, up=2.2;
    const va=c.speed>4?Math.atan2(c.vy,c.vx):c.a; let da=va-c.a; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI; const ha=c.a+da*0.35;
    const tx=c.x-Math.cos(ha)*back, tz=c.y-Math.sin(ha)*back;
    if(!camInit){ camPos.set(tx,up,tz); camInit=true; }
    const k=1-Math.exp(-dt*10); camPos.x+=(tx-camPos.x)*k; camPos.z+=(tz-camPos.z)*k; camPos.y+=(up-camPos.y)*k;
    { const dx=camPos.x-c.x, dz=camPos.z-c.y, d=Math.hypot(dx,dz), maxD=back+0.8, minD=back-1.2; if(d>maxD){ camPos.x=c.x+dx/d*maxD; camPos.z=c.y+dz/d*maxD; } else if(d<minD&&d>0.01){ camPos.x=c.x+dx/d*minD; camPos.z=c.y+dz/d*minD; } }
    const vib=(Math.random()-.5)*(c.rough||0)*2;
    camera.position.set(camPos.x+rx,camPos.y+ry+vib,camPos.z);
    camLook.set(c.x+ca*2.5,0.9,c.y+sa*2.5); camera.lookAt(camLook);
    camera.rotateZ(-(c.ayPrev||0)*0.004);
    camera.fov=60+Math.min(18,c.speed*0.22)+(c.nitroOn?6:0);
  } else {
    const local = camMode===1 ? (model.cockpit||[-0.22,1.13,-0.38]) : (model.hood||[0.55,1.33,0]);
    headG.x+=((-(c.axPrev||0)*0.012)-headG.x)*Math.min(1,dt*6); headG.z+=(((c.ayPrev||0)*-0.01)-headG.z)*Math.min(1,dt*6);
    const vib=(Math.random()-.5)*(c.rough||0)*(camMode===1?1.2:0.6);
    const p=worldOf(model,local[0]+headG.x,local[1]+vib,local[2]+headG.z); camera.position.set(p.x+rx*0.3,p.y+ry*0.3,p.z);
    const cl=model.cockpitLook||[6,0.88,-0.38]; const look=camMode===1?worldOf(model,cl[0],cl[1],cl[2]+phys.steer*2.5):worldOf(model,8,1.0,0);
    camera.lookAt(look);
    camera.fov=camMode===1?(70+Math.min(10,c.speed*0.12)):(66+Math.min(14,c.speed*0.18));
    camInit=false;
  }
  camera.updateProjectionMatrix();
}

// ---------------- HUD ----------------
const _txt={}; function setText(id,v){ v=String(v); if(_txt[id]!==v){ _txt[id]=v; $(id).textContent=v; } }
const mini=$('mini'), mctx=mini.getContext('2d'); let miniBg=null;
function renderMini(){
  const w=mini.width, h=mini.height;
  if(W.kind==='city'){   // rotating radar centred on the player (GTA style)
    const M=W.map, s=0.9; mctx.save(); mctx.clearRect(0,0,w,h);
    mctx.beginPath(); mctx.arc(w/2,h/2,Math.min(w,h)/2-2,0,7); mctx.clip();
    mctx.translate(w/2,h/2+18); mctx.rotate(-phys.a-Math.PI/2); mctx.scale(s,s); mctx.translate(-phys.x-M.offset,-phys.y-M.offset);
    mctx.drawImage(M.canvas,0,0);
    const dot=(x,y,c,r)=>{ mctx.fillStyle=c; mctx.beginPath(); mctx.arc(x+M.offset,y+M.offset,r/s,0,7); mctx.fill(); mctx.strokeStyle='#000'; mctx.lineWidth=1.5/s; mctx.stroke(); };
    if(W.traffic) for(const t of W.traffic.cars) dot(t.x,t.y,'rgba(230,230,230,.8)',2);
    for(const r of remotes.values()) dot(r.x,r.y,r.color,5);
    mctx.restore();
    // player arrow
    mctx.save(); mctx.translate(w/2,h/2+18); mctx.fillStyle=settings.color; mctx.strokeStyle='#fff'; mctx.lineWidth=2; mctx.beginPath(); mctx.moveTo(0,-9); mctx.lineTo(6,7); mctx.lineTo(0,3); mctx.lineTo(-6,7); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore();
    mctx.strokeStyle='rgba(0,0,0,.6)'; mctx.lineWidth=4; mctx.beginPath(); mctx.arc(w/2,h/2,Math.min(w,h)/2-2,0,7); mctx.stroke();
    mctx.fillStyle='#fff'; mctx.font='bold 12px Inter'; mctx.textAlign='center'; const north=-phys.a-Math.PI/2-Math.PI/2; mctx.fillText('K',w/2+Math.cos(north)*(h/2-12),h/2+Math.sin(north)*(h/2-12)+4);
    return;
  }
  const ms=Math.min(w/WORLD.w, h/WORLD.h)*0.92, mox=(w-WORLD.w*ms)/2, moy=(h-WORLD.h*ms)/2;
  if(!miniBg){ miniBg=document.createElement('canvas'); miniBg.width=w; miniBg.height=h; const g=miniBg.getContext('2d'); g.fillStyle='rgba(8,10,14,.55)'; g.fillRect(0,0,w,h); g.translate(mox,moy);
    g.lineJoin='round'; g.strokeStyle='rgba(255,255,255,.75)'; g.lineWidth=5; drawMinimapTrack(g,ms); g.stroke(); g.strokeStyle='rgba(30,32,38,1)'; g.lineWidth=2.5; drawMinimapTrack(g,ms); g.stroke(); }
  mctx.clearRect(0,0,w,h); mctx.drawImage(miniBg,0,0);
  const dot=(x,y,c,r)=>{ mctx.fillStyle=c; mctx.beginPath(); mctx.arc(mox+x*ms,moy+y*ms,r,0,7); mctx.fill(); mctx.strokeStyle='#000'; mctx.lineWidth=1.5; mctx.stroke(); };
  for(const r of remotes.values()) dot(r.x,r.y,r.color,4.5); dot(phys.x,phys.y,settings.color,6);
}
let frameNo=0, fps=0, fpsN=0, fpsT=performance.now();
// ---- instrument cluster (canvas): rev counter arc, needle, speed, gear, nitro, damage ----
const gcv=$('gauge'), gdpr=Math.min(2,DPR); gcv.width=300*gdpr; gcv.height=220*gdpr; const gx=gcv.getContext('2d'); let gNeedle=0;
function drawCluster(){
  const g=gx; g.setTransform(gdpr,0,0,gdpr,0,0); g.clearRect(0,0,300,220);
  const cx=196, cy=116, R=90, MAXR=8000, red=7000, a0=Math.PI*0.75, a1=Math.PI*2.25, ang=r=>a0+(a1-a0)*Math.min(1,r/MAXR);
  gNeedle+=(phys.rpm-gNeedle)*0.45;
  // dial
  const bg=g.createRadialGradient(cx,cy,20,cx,cy,R+14); bg.addColorStop(0,'rgba(18,20,26,.86)'); bg.addColorStop(1,'rgba(6,7,10,.78)');
  g.fillStyle=bg; g.beginPath(); g.arc(cx,cy,R+14,0,Math.PI*2); g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1.5; g.stroke();
  g.lineCap='butt'; g.lineWidth=7; g.strokeStyle='rgba(255,255,255,.08)'; g.beginPath(); g.arc(cx,cy,R-4,a0,a1); g.stroke();
  g.strokeStyle='rgba(255,60,60,.55)'; g.beginPath(); g.arc(cx,cy,R-4,ang(red),a1); g.stroke();
  const lit=g.createLinearGradient(cx-R,0,cx+R,0); lit.addColorStop(0,'#3ad0ff'); lit.addColorStop(0.65,'#ffd32a'); lit.addColorStop(1,'#ff4757');
  g.strokeStyle=lit; g.beginPath(); g.arc(cx,cy,R-4,a0,ang(gNeedle)); g.stroke();
  for(let r=0;r<=MAXR;r+=250){ const a=ang(r), big=r%1000===0, mid=r%500===0; const r0=R-(big?18:mid?13:10), r1=R-9;
    g.strokeStyle=r>=red?'#ff5a5a':'rgba(255,255,255,'+(big?0.95:0.5)+')'; g.lineWidth=big?2.4:1.2; g.beginPath(); g.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0); g.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1); g.stroke();
    if(big){ g.fillStyle=r>=red?'#ff6b6b':'#e8ebef'; g.font='700 12px Inter,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(r/1000),cx+Math.cos(a)*(R-29),cy+Math.sin(a)*(R-29)); } }
  g.fillStyle='rgba(255,255,255,.45)'; g.font='600 8px Inter,sans-serif'; g.fillText('x1000 d/dk',cx,cy+R+2);
  // needle
  const na=ang(gNeedle); g.save(); g.translate(cx,cy); g.rotate(na); g.shadowColor='rgba(255,60,40,.8)'; g.shadowBlur=8;
  g.fillStyle='#ff3b2f'; g.beginPath(); g.moveTo(-10,-2.2); g.lineTo(R-12,-0.9); g.lineTo(R-12,0.9); g.lineTo(-10,2.2); g.closePath(); g.fill(); g.restore();
  g.fillStyle='#16181d'; g.beginPath(); g.arc(cx,cy,30,0,Math.PI*2); g.fill(); g.strokeStyle='rgba(255,255,255,.15)'; g.lineWidth=1; g.stroke();
  // speed + gear
  g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='alphabetic'; g.font='800 30px Inter,sans-serif'; g.fillText(String(phys.kmh),cx,cy+9);
  g.fillStyle='rgba(255,255,255,.55)'; g.font='600 9px Inter,sans-serif'; g.fillText('km/sa',cx,cy+21);
  const cut=(phys.cutT||0)>0, gear=phys.gearLabel(); const gy=cy+44;
  g.fillStyle=cut?'rgba(255,59,59,.25)':'rgba(255,211,42,.12)'; g.strokeStyle=cut?'#ff3b3b':'#ffd32a'; g.lineWidth=2; g.beginPath(); g.roundRect(cx-17,gy-15,34,30,7); g.fill(); g.stroke();
  g.fillStyle=cut?'#ff5a5a':'#ffd32a'; g.font='800 21px Inter,sans-serif'; g.textBaseline='middle'; g.fillText(gear,cx,gy+1);
  if(phys.manual){ g.fillStyle='rgba(255,255,255,.6)'; g.font='700 9px Inter,sans-serif'; g.fillText('M',cx+27,gy+1); }
  // shift light
  if(phys.rpm>red-700){ g.fillStyle=phys.rpm>red-150&&frameNo%8<4?'#ff2a2a':'#ff8c1a'; g.beginPath(); g.arc(cx,cy-R+30,4,0,Math.PI*2); g.fill(); }
  // nitro + damage (left)
  const bx=12, by=150; g.textAlign='left'; g.textBaseline='alphabetic';
  g.fillStyle='rgba(8,10,14,.72)'; g.beginPath(); g.roundRect(bx-6,by-16,104,62,10); g.fill();
  g.fillStyle='rgba(255,255,255,.6)'; g.font='700 9px Inter,sans-serif'; g.fillText('NİTRO',bx,by-3);
  g.fillStyle='rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(bx,by+2,90,7,3.5); g.fill();
  const ng=g.createLinearGradient(bx,0,bx+90,0); ng.addColorStop(0,'#3a7bd5'); ng.addColorStop(1,'#66e0ff'); g.fillStyle=phys.nitroOn?'#a6f0ff':ng; g.beginPath(); g.roundRect(bx,by+2,Math.max(0.01,90*phys.nitro),7,3.5); g.fill();
  const dmg=Math.round(phys.damage); g.fillStyle='rgba(255,255,255,.6)'; g.fillText('HASAR',bx,by+25);
  g.fillStyle=dmg>60?'#ff6b5a':dmg>25?'#ffd32a':'#9ee6a8'; g.font='800 13px Inter,sans-serif'; g.textAlign='right'; g.fillText(dmg+'%',bx+90,by+26);
  g.fillStyle='rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(bx,by+31,90,4,2); g.fill(); g.fillStyle=dmg>60?'#ff6b5a':dmg>25?'#ffd32a':'#9ee6a8'; g.beginPath(); g.roundRect(bx,by+31,Math.max(0.01,0.9*dmg),4,2); g.fill();
}
function updateHud(){
  if(mode!=='free'){ const st=standings(), pos=st.findIndex(x=>x.me)+1;
    setText('hLap',Math.min(me.lap+1,LAPS)+'/'+LAPS); setText('hPos',pos+'/'+st.length);
    setText('hTime',fmt(me.fin?me.ft:elapsed)); setText('hLast',fmt(lastLap)); setText('hBest',fmt(bestLap));
    setText('hCur',mode==='race'&&!me.fin?fmt(performance.now()-lapStart):'-:--.---'); }
  else if(frameNo%10===0){ setText('stName',streetName(phys.x,phys.y)); setText('stDist',district(phys.x,phys.y)); setText('freeInfo',(online?(remotes.size+1)+' oyuncu':'Tek başına')+' · '+(['Gündüz','Akşam','Gece'][['day','dusk','night'].indexOf(settings.time)])); }
  drawCluster();
  setText('hNet',fps+' FPS'+(online?(net.isHost?' · oda kurucusu':(net.ping!=null?' · '+net.ping+' ms':'')):'')+(phys.manual?' · manuel':'')+(phys.assists?'':' · yardımsız'));
  if(frameNo%2===0) renderMini();
}

// ---------------- main loop ----------------
const STEP=1/120; let acc=0, last=performance.now(), trafAcc=0, trafSend=0, lampT=0;
addEventListener('resize',()=>{ renderer.setSize(innerWidth,innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); if(composer){ composer.setSize(innerWidth,innerHeight); } });
useWorld(settings.map); applyWeather(settings.weather); parkShowcase(); updateMenuLabels();

function frame(t){
  requestAnimationFrame(frame);
  const fdt=Math.min(0.1,Math.max(0,(t-last)/1000)); last=t; frameNo++;
  fpsN++; if(t-fpsT>1000){ fps=Math.round(fpsN*1000/(t-fpsT)); fpsN=0; fpsT=t;
    // keep it smooth: lower the render resolution when the GPU struggles, raise it again when there is headroom
    if(document.visibilityState==='visible' && document.hasFocus() && fps>14 && t-lastModeT>3000){ let pr=curPR; if(fps<42) pr=Math.max(BASE_PR*0.6,curPR-0.08); else if(fps>56 && curPR<BASE_PR) pr=Math.min(BASE_PR,curPR+0.06);
      if(pr!==curPR){ curPR=pr; renderer.setPixelRatio(curPR); if(composer) composer.setPixelRatio(curPR); } } }
  handleEdges(); if(respawnCool>0) respawnCool-=fdt;
  const inp=readInput();
  const driving=mode==='race'||mode==='countdown'||mode==='free';
  if(mode==='countdown'){
    const e=(t-countStart)/1000, n=Math.min(5,Math.floor(e));
    if(n!==lightsShown && e<5){ lightsShown=n; audio.beep(false); }
    const on=e<5?Math.min(5,Math.floor(e)+1):0;
    [...$('lights').children].forEach((el,i)=>el.classList.toggle('on',i<on)); W.startLights.forEach((m,i)=>m.emissiveIntensity=i<on?4:0);
    if(e>=5.4){ mode='race'; raceStart=t; lapStart=t; audio.beep(true); [...$('lights').children].forEach(el=>el.classList.remove('on')); W.startLights.forEach(m=>m.emissiveIntensity=0);
      setTimeout(()=>{ if(mode==='race') $('lights').classList.add('hidden'); },900); }
  }
  if(mode==='race' && !me.fin) elapsed=t-raceStart;
  // ---- city simulation (traffic: host or solo simulates, followers interpolate) ----
  if(W.kind==='city'){
    const players=[{x:phys.x,y:phys.y,vx:phys.vx,vy:phys.vy,speed:phys.speed}]; for(const r of remotes.values()) players.push({x:r.x,y:r.y,vx:r.vx,vy:r.vy,speed:Math.abs(r.v)});
    const sim=!online||net.isHost;
    if(sim){ trafAcc+=fdt; let n=0; while(trafAcc>=1/30 && n<4){ W.traffic.step(1/30,players); trafAcc-=1/30; n++; } W.traffic.remote=null; }
    if(online && net.isHost){ trafSend+=fdt; if(trafSend>0.1){ trafSend=0; net.sendAll({t:'x',k:'tr',d:W.traffic.pack()}); } }
    W.traffic.render(fdt); fleet.commit();
    W.peds.update(fdt,players);
    if(frameNo%15===0) W.city.updateLights();
    // nearest street lamps become real lights at night
    lampT-=fdt; if(nightF>0.5 && W.lampLights.length && lampT<=0){ lampT=0.3;
      const L=W.city.lamps.map(l=>{ const th=-l[2]; return [l[0]+2*Math.sin(th),l[1]+2*Math.cos(th)]; }).map(p=>[p,(p[0]-phys.x)**2+(p[1]-phys.y)**2]).sort((a,b)=>a[1]-b[1]);
      W.lampLights.forEach((ll,k)=>{ const p=L[k][0]; ll.position.set(p[0],7.4,p[1]); ll.intensity=60; }); }
    else if(nightF<=0.5) W.lampLights.forEach(ll=>ll.intensity=0);
  }
  // ---- player physics ----
  if(driving && !paused){
    acc+=fdt; const others=[...remotes.values()]; if(W.kind==='city') others.push(...W.traffic.obstacles());
    const drive = mode==='countdown' ? {steer:inp.steer,gas:inp.gas,brake:0,hand:false,nitro:false,analog:inp.analog}
                : (mode==='race' && me.fin) ? {steer:0,gas:0,brake:0.6,hand:false,nitro:false} : inp;
    while(acc>=STEP){
      const hx=phys.x,hy=phys.y,ha=phys.a;
      phys.step(STEP,drive,others);
      if(mode==='countdown'){ phys.x=hx; phys.y=hy; phys.a=ha; phys.vx=phys.vy=phys.yawRate=0; }
      if(phys.impact>4){ dentCar(model,phys.impactAt.lx,phys.impactAt.lz,Math.min(3,phys.impact/8)); audio.impact(phys.impact); shake=Math.min(1.5,shake+phys.impact*0.06); phys.impact=0; }
      acc-=STEP;
    }
    if(mode==='race') lapLogic();
    horn=!!inp.horn; audio.horn('me',horn,1);
    if(online) net.set({x:+phys.x.toFixed(2),y:+phys.y.toFixed(2),a:+phys.a.toFixed(3),v:+phys.vLong.toFixed(2),sr:+phys.steer.toFixed(3),bk:phys.brake>0.1||phys.hand>0,nt:phys.nitroOn,hn:horn,hl:headlightsOn,lap:me.lap,cp:me.cp,idx:me.idx,fin:me.fin,ft:Math.round(me.ft),best:Math.round(bestLap)});
    if(phys.kerb||phys.surfF===2) shake=Math.max(shake,Math.min(0.35,phys.speed*0.01));
    carEffects(fdt);
  } else if(paused){ acc=0; }
  placeCar(model,phys.x,phys.y,phys.a,phys.pitch,phys.rollA,phys.steer,phys.wheelAng,(phys.brake>0.1&&!phys.burnout)||phys.hand>0,phys.nitroOn,phys.bump*0.25,headlightsOn,{f:phys.surfF===3?0.15:0,r:phys.surfR===3?0.15:0});
  headSpot.intensity=headlightsOn&&driving?(nightF>0.5?260:120):0;
  // remote players
  const now=performance.now(), k=1-Math.exp(-fdt*16);
  for(const [id,r] of remotes){
    const age=Math.min(0.25,(now-r.t)/1000); const px=r.tx+Math.cos(r.ta)*r.v*age, py=r.ty+Math.sin(r.ta)*r.v*age;
    const ox=r.x, oy=r.y;
    if(Math.hypot(px-r.x,py-r.y)>30){ r.x=px; r.y=py; } r.x+=(px-r.x)*k; r.y+=(py-r.y)*k;
    let da=r.ta-r.a; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI; r.a+=da*k;
    r.vx=fdt>0?(r.x-ox)/fdt:0; r.vy=fdt>0?(r.y-oy)/fdt:0;
    r.steer+=(r.sr-r.steer)*k; r.wheel+=r.v/CAR.wheelR*fdt;
    placeCar(r.model,r.x,r.y,r.a,0,0,r.steer,[r.wheel,r.wheel,r.wheel,r.wheel],r.bk,r.nt,0,r.hl);
    const dist=Math.hypot(r.x-phys.x,r.y-phys.y); audio.horn(id,r.hn&&dist<150,Math.max(0.05,1-dist/150));
  }
  sun.position.set(phys.x+sunDir.x*200, sunDir.y*200, phys.y+sunDir.z*200); sun.target.position.set(phys.x,0,phys.y);
  audio.update(phys,fdt,driving&&!paused);
  updateCamera(fdt);
  smoke.update(fdt,renderer.domElement.height); skids.update(); updateRain(fdt); if(frameNo%2===0) updateStreaks();
  if(model.shiftMat) model.shiftMat.emissiveIntensity=driving&&phys.rpm>6200?(phys.rpm>7300&&frameNo%6<3?0.3:4):0;
  if(driving && camMode===1 && frameNo%3===0) drawGauges(model,phys.rpm,phys.kmh,phys.gearLabel(),phys.nitro);
  if(driving) updateHud();
  if(mirrorPlane) mirrorPlane.visible=driving&&camMode===1;
  drawDrops(fdt,driving&&camMode!==0&&wet&&!paused);
  // render
  renderer.setScissorTest(false); renderer.setViewport(0,0,innerWidth,innerHeight);
  if(composer) composer.render(); else renderer.render(scene,camera);
  if(driving && frameNo%10===0) updateReflections();
  if(driving && camMode===1){
    if(frameNo%2===0){
      const mp=model.mirror||[0.3,1.2,0]; const p=worldOf(model,mp[0],mp[1],mp[2]), back=worldOf(model,-20,0.9,0);
      mirrorCam.position.copy(p); mirrorCam.lookAt(back); mirrorCam.aspect=mirrorPlane?0.228/0.058:3.4; mirrorCam.fov=mirrorPlane?22:50; mirrorCam.updateProjectionMatrix();
      const au=renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate=false; model.root.visible=false; rain.m.visible=false;
      renderer.setRenderTarget(mirrorRT); renderer.render(scene,mirrorCam); renderer.setRenderTarget(null);
      model.root.visible=true; rain.m.visible=wet; renderer.shadowMap.autoUpdate=au;
    }
    if(!mirrorPlane){ const w=Math.round(innerWidth*0.26), h=Math.round(w/3.4), x=Math.round((innerWidth-w)/2), y=innerHeight-h-Math.round(innerHeight*0.035);
      renderer.setScissorTest(true); renderer.setScissor(x,y,w,h); renderer.setViewport(x,y,w,h); renderer.render(mirScene,mirOrtho);
      renderer.setScissorTest(false); renderer.setViewport(0,0,innerWidth,innerHeight);
      $('mirrorFrame').style.cssText=`display:block;left:${x-4}px;top:${innerHeight-y-h-4}px;width:${w+8}px;height:${h+8}px`; }
  } else $('mirrorFrame').style.display='none';
}
requestAnimationFrame(frame);
// test hook
const BOT=new URLSearchParams(location.search).has('bot');
window.__game={THREE,model,camera,GPU,get pr(){return curPR;},quality:settings.quality,phys,me,get mode(){return mode;},get world(){return W;},startFree,remotes,renderer,scene};
