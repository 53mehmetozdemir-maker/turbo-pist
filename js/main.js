import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loadSave } from './save.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { TP, N, WORLD, buildTrack, drawMinimapTrack, nearest, trackWorld } from './track.js';
import { buildCar, dentCar, repairCar, drawGauges, CAR, makeFleet, loadCarModel, ferrariSablon } from './car.js';
import { buildServices, SERVICE_STYLE } from './services.js';
import { dentModel, crackWindscreen, repairModel, breakLamps } from './damage.js';
import { Car, OPTS as PHYS, setSpec, P as SPEC } from './physics.js';
import { VEHICLES, VEHICLE_IDS, loadVehicle, buildVehicle, vehicleReady, sablonlar } from './vehicles.js';
import { CarAudio } from './audio.js';
import { Particles, SkidMarks } from './effects.js';
import { Net, PROTO } from './net.js';
import { loadCityImages, buildCity, cityWorld, streetName, district, nearestLane, cityMapCanvas, SIZE, P as CP, LANES, CLOCK } from './city.js';
import { Traffic, Pedestrians } from './traffic.js';
import { findRoute, routeLength } from './route.js';
import { buildRegions, terrainH, regionSurface, regionName, collideRegions, HighwayTraffic, worldMapCanvas, REGION_POIS, nearestRoadSpot, _dbg as REGDBG } from './regions.js';

const $=id=>document.getElementById(id);
const COLORS=['#e8202a','#1f6fe0','#ff9f1a','#20b956','#8e44ef','#f1f2f6','#202226','#ffd400'];
const LAPS=3, TRAFFIC_N=50;
// Depolama. Önizleme aynı alan adında olduğu için (53mehmetozdemir-maker.github.io) canlıyla aynı
// localStorage'ı görür; önizleme derlemesi VITE_DEPO_ONEK verir ve kendi anahtarlarına yazar.
// Okurken kendi anahtarı yoksa canlıdakini okur (oyuncunun kaydıyla dener ama ona hiç yazmaz).
const DEPO_ONEK=import.meta.env.VITE_DEPO_ONEK||'';
const store={ get(k){ try{ const v=localStorage.getItem(DEPO_ONEK+k); return v===null&&DEPO_ONEK?localStorage.getItem(k):v; }catch(e){return null;} }, set(k,v){ try{localStorage.setItem(DEPO_ONEK+k,v);}catch(e){} } };
// save game: money, per-vehicle fuel & damage, distance, best laps (settings live in their own keys)
const SAVE=loadSave(store);   // sürüm alanı + geçiş: js/save.js
SAVE.money??=2500; SAVE.veh??={}; SAVE.km??=0; SAVE.best??={};
if(!SAVE.econ2){ SAVE.econ2=1; SAVE.money=Math.max(0,SAVE.money)+3000; }   // economy rebalance: one-off top-up
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;

const settings={
  quality: store.get('tp3_quality') || null,
  manual: store.get('tp3_manual')==='1', assists: store.get('tp3_assists')!=='0',
  name: store.get('tp_name')||'', color: store.get('tp3_color')||COLORS[0],
  vehicle: VEHICLE_IDS.includes(store.get('tp7_veh'))?store.get('tp7_veh'):'f458',
  map: store.get('tp4_map')||'city', time: store.get('tp4_time')||'day', weather: store.get('tp6_wx')||'clear',
};
if(!COLORS.includes(settings.color)) settings.color=COLORS[0];

// ---------------- renderer / scene ----------------
// Ultra = Yüksek'in bütün ayrıntıları + ortam gölgelendirmesi (GTAO, H3). Ayrıntı kodu 'high' görür; otomatik seçim Ultra'yı seçmez.
const ULTRA=settings.quality==='ultra'; if(ULTRA) settings.quality='high';
const renderer=new THREE.WebGLRenderer({antialias:settings.quality!=='low', powerPreference:'high-performance'});
const DPR=window.devicePixelRatio||1;
let GPU='';
try{ const gl=renderer.getContext(), dbg=gl.getExtension('WEBGL_debug_renderer_info'); GPU=dbg?String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)):''; }catch(e){}
if(!settings.quality){ const weak=/Intel|Mali|Adreno|PowerVR|Apple GPU|SwiftShader|llvmpipe|Radeon\(TM\) Graphics|Radeon Graphics/i.test(GPU); settings.quality=isTouch?'low':weak?'med':'high'; }
const BASE_PR=settings.quality==='high'?Math.min(DPR,1.25):settings.quality==='med'?Math.min(DPR,1.0):Math.min(DPR,1)*0.8;
let curPR=BASE_PR, lastModeT=0; renderer.setPixelRatio(curPR);
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.NeutralToneMapping; renderer.toneMappingExposure=0.9;
renderer.shadowMap.enabled=settings.quality!=='low'; renderer.shadowMap.type=THREE.PCFShadowMap;
document.body.prepend(renderer.domElement); renderer.domElement.id='c';
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xc9d9e8,200,1100);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.05,4000);
const mirrorCam=new THREE.PerspectiveCamera(26,4.4,0.3,260);
const mirrorRT=new THREE.WebGLRenderTarget(704,160,{type:THREE.HalfFloatType});
const mirScene=new THREE.Scene(), mirOrtho=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
{ const q=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:mirrorRT.texture,depthTest:false,depthWrite:false,side:THREE.DoubleSide})); q.scale.x=-1; mirScene.add(q); }
const pmrem=new THREE.PMREMGenerator(renderer);
const sky=new Sky(); sky.scale.setScalar(6000); scene.add(sky);
const U=sky.material.uniforms;
const hemi=new THREE.HemisphereLight(0xcfe3ff,0x56524c,0.75); scene.add(hemi);
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
// efekt zincirini kapat ve GPU kaynaklarını (render target'lar, geçişler) bırak (H2)
function composerBirak(){ const c=composer; composer=null; bloom=null; if(!c) return; for(const p of c.passes) if(p.dispose) p.dispose(); c.dispose(); }
if(settings.quality==='high'){
  composer=new EffectComposer(renderer); const sahneGecis=new RenderPass(scene,camera); composer.addPass(sahneGecis);
  // ULTRA = Yüksek + ortam gölgelendirmesi (GTAO). Gölgelendirme yalnız katı yüzeylere uygulanır; ışık/efekt/saydamlar
  // (stop lambası parıltısı, egzoz alevi, kıvılcım, haleler, cam) onun ÜSTÜNE, Yüksek'teki sırayla çizilir:
  //   1) sahne: katı (+transmission) malzemeler   2) GTAO: görüntüyü yerinde çarpar, değer 0..1'e kıstırılır (asla aydınlatmaz,
  //   ekran kartı NaN üretse bile yayılmaz)   3) saydam malzemeler, aynı derinlik tamponuyla   4) bloom + çıkış (Yüksek'le aynı).
  // three her yeni nesneye Math.random ile kimlik verir: oyunun rastgele dizisini kaydırıp dünyayı (başlangıç noktası,
  // trafik, parçacıklar) Yüksek'ten farklı kurmasın diye GTAO'ya ait her şey kendi sabit üreteciyle kurulur.
  if(ULTRA) try{ const _rnd=Math.random; let _s=20251122; Math.random=()=>(_s=(_s*16807)%2147483647)/2147483647;
    let ao, carp, efektGecis; try{ ao=new GTAOPass(scene,camera,innerWidth,innerHeight); efektGecis=new RenderPass(scene,camera);
      carp=new THREE.ShaderMaterial({ uniforms:{ tAO:{value:null}, intensity:{value:1} },
        vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader:'uniform sampler2D tAO; uniform float intensity; varying vec2 vUv;\n'+
          'void main(){ float a=texture2D(tAO,vUv).r; a=(a>=0.0)?clamp(a,0.0,1.0):1.0; gl_FragColor=vec4(vec3(mix(1.0,a,intensity)),1.0); }',
        // hedef = hedef × kaynak (alfa korunur); karışım birimi yalnız çarpar
        blending:THREE.CustomBlending, blendEquation:THREE.AddEquation, blendSrc:THREE.ZeroFactor, blendDst:THREE.SrcColorFactor,
        blendSrcAlpha:THREE.ZeroFactor, blendDstAlpha:THREE.OneFactor, depthTest:false, depthWrite:false });
    } finally{ Math.random=_rnd; }
    // three'nin çizim listesiyle aynı ayrım: transmission>0 → katılarla, değilse transparent → saydam
    const saydamMi=m=>m.transparent&&!(m.transmission>0); const gizli=[];
    const ayir=saydamGizle=>scene.traverse(o=>{ const ms=o.material; if(!ms) return;
      for(const m of (Array.isArray(ms)?ms:[ms])) if(m.visible&&saydamMi(m)===saydamGizle){ m.visible=false; gizli.push(m); } });
    const geriAl=()=>{ for(const m of gizli) m.visible=true; gizli.length=0; };
    { const r=sahneGecis.render.bind(sahneGecis); sahneGecis.render=(...a)=>{ ayir(true); try{ return r(...a); } finally{ geriAl(); } }; }
    // GTAO normal/derinlik tamponunda yalnız katı yüzeyler olsun (three sadece nokta/çizgiyi gizliyor; sprite ve saydam
    // efektler orada katı cisim gibi görünüp etraflarına gölge düşürüyordu)
    const efektMi=m=>!!m&&(m.transparent||m.blending===THREE.AdditiveBlending||m.depthWrite===false);
    ao._overrideVisibility=function(){ const c=this._visibilityCache; this.scene.traverse(o=>{ if(!o.visible) return;
      if(o.isPoints||o.isLine||o.isLine2||o.isSprite||[].concat(o.material||[]).some(efektMi)){ o.visible=false; c.push(o); } }); };
    ao.output=GTAOPass.OUTPUT.Off; ao.needsSwap=false;   // GTAO yalnız hesaplar; sonucu aşağıda yerinde çarpıyoruz
    { const r0=ao.render.bind(ao); ao.render=(renderer,writeBuffer,readBuffer,...a)=>{ r0(renderer,writeBuffer,readBuffer,...a);
        carp.uniforms.tAO.value=ao.pdRenderTarget.texture; carp.uniforms.intensity.value=ao.blendIntensity;
        ao._renderPass(renderer,carp,ao.renderToScreen?null:readBuffer); }; }
    const aoBirak=ao.dispose.bind(ao); ao.dispose=()=>{ aoBirak(); carp.dispose(); };
    efektGecis.clear=false;
    { const r=efektGecis.render.bind(efektGecis); efektGecis.render=(renderer,...a)=>{ ayir(false); const bg=scene.background, sg=renderer.shadowMap.autoUpdate;
        scene.background=null; renderer.shadowMap.autoUpdate=false;   // gökyüzü ve gölge haritaları ilk geçişte çizildi
        try{ return r(renderer,...a); } finally{ geriAl(); scene.background=bg; renderer.shadowMap.autoUpdate=sg; } }; }
    ao.updateGtaoMaterial({radius:0.6,distanceExponent:1.4,thickness:1,scale:1.1,samples:12}); ao.blendIntensity=0.85;
    composer.addPass(ao); composer.addPass(efektGecis); }catch(e){ console.warn('AO yok',e); }
  bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth/2,innerHeight/2),0.35,0.5,0.88); composer.addPass(bloom); composer.addPass(new OutputPass());
}

// ---------------- worlds (built lazily) ----------------
const worlds={};
await Promise.all([loadCarModel(), loadCityImages(), loadVehicle(settings.vehicle)]);
if(!vehicleReady(settings.vehicle)) settings.vehicle='f458';
setSpec(VEHICLES[settings.vehicle].spec);
const fleet=makeFleet(scene,360,settings.quality);
// the city plus the regions around it (motorway, coast, mountain, drift park) form one world
const inCityArea=(x,y)=>x>-8&&y>-8&&x<CP*10+8&&y<CP*10+8;
const openWorld={ surface(x,y,car){ return inCityArea(x,y)?cityWorld.surface(x,y,car):regionSurface(x,y); }, ground(x,y){ return inCityArea(x,y)?cityWorld.ground(x,y):terrainH(x,y); }, collide(car){ cityWorld.collide(car); collideRegions(car); } };
const placeName=(x,y)=>inCityArea(x,y)?{name:streetName(x,y),area:district(x,y)}:regionName(x,y);
function ensureWorld(map){
  if(worlds[map]) return worlds[map];
  if(map==='track'){ const t=buildTrack(scene,settings.quality); worlds.track={kind:'track',group:t.group,startLights:t.startLights,phys:trackWorld}; }
  else { const c=buildCity(scene,settings.quality,fleet); const traffic=new Traffic(fleet,TRAFFIC_N);
    const peds=new Pedestrians(scene,110); traffic.peds=peds;   // same crowd for every player (positions follow the shared clock)
    const lampLights=[]; if(settings.quality!=='low') for(let k=0;k<6;k++){ const L=new THREE.PointLight(0xffe2bf,0,32,1.6); scene.add(L); lampLights.push(L); }
    const svc=buildServices(c.group); const cmap=cityMapCanvas(); drawServiceIcons(cmap,svc.list);
    const cg=c.group.getObjectByName('cityGround'); const reg=buildRegions(c.group,settings.quality,cg&&cg.material); if(cg) cg.visible=false;
    mergeStatic(c.group,200);
    traffic.hw=new HighwayTraffic(fleet,5); const map=worldMapCanvas(cmap);
    worlds.city={kind:'city',group:c.group,city:c,svc,reg,traffic,peds,phys:openWorld,lampLights,map,services:svc.list.concat(REGION_POIS.map(p=>({...p,rect:null})))}; registerCull(c.group); }
  return worlds[map];
}
let W=null;   // active world
// compile every shader up front (hidden effects too) so nothing hitches the first time it appears
function precompile(){ try{ const hidden=[]; scene.traverse(o=>{ if(!o.visible && !(o.isGroup&&Object.values(worlds).some(w=>w.group===o))){ hidden.push(o); o.visible=true; } });
  renderer.compile(scene,camera); for(const o of hidden) o.visible=false; }catch(e){ console.warn('precompile',e); } }
function useWorld(map){
  W=ensureWorld(map); lastModeT=performance.now();
  for(const k in worlds){ const on=worlds[k]===W; worlds[k].group.visible=on; if(worlds[k].peds) for(const m of worlds[k].peds.meshes) m.visible=on; }
  for(const k of ['body','glass','dark','head','tail']) {}   // fleet only used in the city
  fleetVisible(map==='city');
  phys.world=W.phys; setTimeout(precompile,0); applyTime(settings.time); miniBg=null; $('mini').classList.toggle('sq',map==='track');
}
// static batching: hundreds of small props (station pumps, signs, rails...) become one mesh per material per 200 m cell
function mergeStatic(group,cell=200){ group.updateMatrixWorld(true); const buckets=new Map(), victims=[]; const v=new THREE.Vector3();
  group.traverse(o=>{ if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||!o.visible||o.userData.noMerge||Array.isArray(o.material)) return; const g=o.geometry; if(!g||!g.attributes.position||g.morphAttributes&&Object.keys(g.morphAttributes).length) return;
    if(!g.boundingSphere) g.computeBoundingSphere(); v.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
    const key=o.material.uuid+'|'+(o.castShadow?1:0)+(o.receiveShadow?1:0)+'|'+o.renderOrder+'|'+Math.floor(v.x/cell)+','+Math.floor(v.z/cell);
    let b=buckets.get(key); if(!b){ b={mat:o.material,cast:o.castShadow,recv:o.receiveShadow,ro:o.renderOrder,list:[]}; buckets.set(key,b); } b.list.push(o); });
  let made=0, removed=0;
  for(const b of buckets.values()){ if(b.list.length<2) continue; const geos=[];
    for(const o of b.list){ let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      for(const k of Object.keys(g.attributes)) if(k!=='position'&&k!=='normal'&&k!=='uv') g.deleteAttribute(k);
      if(!g.attributes.normal) g.computeVertexNormals(); if(!g.attributes.uv) g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2)); geos.push(g); }
    const m=mergeGeometries(geos,false); if(!m) continue; for(const g of geos) g.dispose();
    const mesh=new THREE.Mesh(m,b.mat); mesh.castShadow=b.cast; mesh.receiveShadow=b.recv; mesh.renderOrder=b.ro; mesh.matrixAutoUpdate=false; group.add(mesh); made++;
    for(const o of b.list){ o.parent&&o.parent.remove(o); removed++; } }
  return {made,removed}; }
// distance culling: small static props far away are not drawn (they are hidden by fog anyway) -> far fewer draw calls
const cullList=[]; const _cs=new THREE.Sphere();
function registerCull(group){ group.updateMatrixWorld(true); group.traverse(o=>{ if(!(o.isMesh||o.isInstancedMesh)||!o.visible||o.userData.noCull) return; const g=o.geometry; if(!g) return;
    if(o.isInstancedMesh){ if(!o.boundingSphere) o.computeBoundingSphere(); _cs.copy(o.boundingSphere); } else { if(!g.boundingSphere) g.computeBoundingSphere(); _cs.copy(g.boundingSphere); }
    _cs.applyMatrix4(o.matrixWorld); const r=_cs.radius; const lim=r<2.5?120:r<8?260:r<30?520:r<80?1100:0; if(lim) cullList.push({o,x:_cs.center.x,z:_cs.center.z,r,lim2:(lim+r)*(lim+r)}); }); }
function runCull(){ const cx=camera.position.x, cz=camera.position.z, k=camMode===1?0.8:1;
  for(const c of cullList){ const dx=c.x-cx, dz=c.z-cz; c.o.visible=dx*dx+dz*dz<c.lim2*k; } }
function fleetVisible(v){ scene.traverse(o=>{ if(o.isInstancedMesh && o.userData.fleet) o.visible=v; }); }

// ---------------- HDR environments (Poly Haven, CC0) ----------------
const ENV_FILES={day:new URL('../assets/pedestrian_overpass_1k.hdr',import.meta.url).href,dusk:new URL('../assets/venice_sunset_1k.hdr',import.meta.url).href,night:new URL('../assets/moonless_golf_1k.hdr',import.meta.url).href}, envCache={};
const hdr=new HDRLoader();
function loadEnv(t){ if(envCache[t]) return envCache[t];
  envCache[t]=hdr.loadAsync(ENV_FILES[t]).then(tex=>{ tex.mapping=THREE.EquirectangularReflectionMapping; const e=pmrem.fromEquirectangular(tex).texture; tex.dispose(); return e; }).catch(()=>null); return envCache[t]; }
// ---------------- time of day ----------------
let nightF=0;
function applyTime(t){
  const city=W&&W.kind==='city';
  if(t==='day'){ sunDir.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-40),THREE.MathUtils.degToRad(140)); sun.color.set(0xfff1dc); sun.intensity=2.6; hemi.intensity=0.75; hemi.color.set(0xcfe3ff); hemi.groundColor.set(0x56524c);
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
  for(const k in worlds) if(worlds[k].city){ worlds[k].city.setNight(nightF); worlds[k].svc&&worlds[k].svc.setNight(nightF); worlds[k].reg&&worlds[k].reg.setNight(nightF); worlds[k].city.setHaze(t,rainy); }
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
  g.save(); if(camMode===1){ g.beginPath(); g.moveTo(0.36*W,0.31*H); g.lineTo(1.0*W,0.26*H); g.lineTo(1.0*W,0.6*H); g.lineTo(0.34*W,0.6*H); g.closePath(); g.clip(); }
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
  g.restore();
}
function applyWeather(wx){
  settings.weather=wx; wet=wx==='rain'; PHYS.wet=wet; rain.m.visible=wet; streaks.visible=wet; audio.wet=wet;
  for(const k in worlds) if(worlds[k].city) worlds[k].city.setWet(wet);
  applyTime(settings.time);
}

// ---------------- local car ----------------
const phys=new Car(); phys.manual=settings.manual; phys.assists=settings.assists; phys.world=trackWorld;
// cabin lighting: the city HDR is warm/golden, which turned every interior olive-yellow. Inside the car, light comes from the
// windows as soft neutral daylight, so cabin surfaces use a neutral studio environment instead of the scene's warm one.
let cabinEnv=null;
function neutralCabin(m){ if(!m||!m.body) return m; if(!cabinEnv) cabinEnv=pmrem.fromScene(new RoomEnvironment(),0.04).texture;
  m.root.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(m.body.matrixWorld).invert(); const skip=new Set([m.paint,m.brakeMat,m.headMat,m.glassMat,m.brake3Mat].filter(Boolean));
  const cb=m.cabinBox?[[m.cabinBox[0][0],m.cabinBox[0][1],0],[m.cabinBox[1][0],2.0,0.92]]:[[-1.7,0.25,0],[1.2,2.0,0.92]]; const done=new Map(); const bb=new THREE.Box3(), c=new THREE.Vector3(), mw=new THREE.Matrix4();
  m.body.traverse(o=>{ if(!o.isMesh||!o.material||Array.isArray(o.material)) return; const mt=o.material; if(skip.has(mt)||mt.transparent||mt.isMeshBasicMaterial||mt.isShaderMaterial||!('envMap' in mt)) return;
    if(!o.geometry.boundingBox) o.geometry.computeBoundingBox(); mw.multiplyMatrices(inv,o.matrixWorld); bb.copy(o.geometry.boundingBox).applyMatrix4(mw); bb.getCenter(c);
    const inside=c.x>cb[0][0]&&c.x<cb[1][0]&&c.y>cb[0][1]&&c.y<cb[1][1]&&Math.abs(c.z)<cb[1][2]; if(!inside) return;
    let nm=done.get(mt); if(!nm){ nm=mt.clone(); nm.envMap=cabinEnv; nm.envMapIntensity=mt.metalness>0.5?0.95:Math.min(0.8,(mt.envMapIntensity??0.4)*2.3); nm.needsUpdate=true; done.set(mt,nm); } o.material=nm; });
  return m; }
function makeVehicleModel(id,color){ return neutralCabin((!VEHICLES[id]||VEHICLES[id].builtin||!vehicleReady(id)) ? buildCar(color) : buildVehicle(id,color)); }
let lastFdt=1/60;
let model=makeVehicleModel(settings.vehicle,settings.color); scene.add(model.root);
let mirrorPlane=null; const mirrorPlanes=[];
function mirrorMesh(w,h,u0,u1,v0,v1,rad,mask=null){ const g=new THREE.PlaneGeometry(w,h); const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setXY(i,u1-uv.getX(i)*(u1-u0),v0+uv.getY(i)*(v1-v0));
  const am=document.createElement('canvas'); am.width=256; am.height=Math.round(256*h/w); const c=am.getContext('2d'); c.fillStyle='#000'; c.fillRect(0,0,am.width,am.height); c.fillStyle='#fff'; c.beginPath(); if(rad==='ellipse') c.ellipse(128,am.height/2,124,am.height/2-3,0,0,Math.PI*2); else c.roundRect(3,3,250,am.height-6,rad); c.fill();
  const ag=new THREE.CanvasTexture(mask||am); // alpha mask uses the plane's own (unremapped) coords
  const mat=new THREE.MeshBasicMaterial({map:mirrorRT.texture,fog:false,transparent:false}); mat.onBeforeCompile=s=>{ s.vertexShader=s.vertexShader.replace('#include <uv_pars_vertex>','#include <uv_pars_vertex>\nattribute vec2 uv2m; varying vec2 vMk;').replace('#include <uv_vertex>','#include <uv_vertex>\nvMk=uv2m;');
    s.uniforms.mk={value:ag}; s.fragmentShader=s.fragmentShader.replace('#include <map_pars_fragment>','#include <map_pars_fragment>\nuniform sampler2D mk; varying vec2 vMk;').replace('#include <alphatest_fragment>','if(texture2D(mk,vMk).r<0.5) discard;'); };
  const base=new THREE.PlaneGeometry(w,h).attributes.uv; g.setAttribute('uv2m',base.clone()); const mesh=new THREE.Mesh(g,mat); mesh.visible=false; return mesh; }
function attachMirrors(){ mirrorPlane=null; mirrorPlanes.length=0;
  const D=model.mirrorDefs; if(model.vid){ if(!D) return;
    const place=(def,u0,u1,rad,inner)=>{ const n=new THREE.Vector3(...def.n).normalize(); const u=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),n).normalize(), w=new THREE.Vector3().crossVectors(n,u);
      const mm=mirrorMesh(def.w,def.h,u0,u1,inner?0.15:0.08,inner?0.85:0.95,rad,def.mask||null); mm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,w,n)); mm.position.set(...def.c).addScaledVector(n,0.004); model.body.add(mm); mirrorPlanes.push(mm);
      if(def.housing){ const fr=def.frame??0.025, hb=new THREE.Mesh(new RoundedBoxGeometry(def.w+fr,def.h+fr,0.022,3,Math.min(0.012,(def.h+fr)/2-0.001)),new THREE.MeshStandardMaterial({color:0x121212,roughness:0.6})); hb.quaternion.copy(mm.quaternion); hb.position.set(...def.c).addScaledVector(n,-0.012); model.body.add(hb);
        const al=def.arm??0.08, arm=new THREE.Mesh(new THREE.CylinderGeometry(0.007,0.007,al,8),hb.material); arm.position.set(def.c[0]+0.015,def.c[1]+def.h/2+al/2,def.c[2]); model.body.add(arm); }
      return mm; };
    // fit each side-mirror glass to the real mirror housing of the model: take the housing faces that look back at the driver
    // around the configured point and use their outline (slightly inset) as the glass
    const fit=def=>{ const n=new THREE.Vector3(...def.n).normalize(), u=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),n).normalize(), w=new THREE.Vector3().crossVectors(n,u), c=new THREE.Vector3(...def.c);
      model.root.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(model.body.matrixWorld).invert(); const A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),N=new THREE.Vector3(),M=new THREE.Vector3(); const faces=[];
      model.body.traverse(o=>{ if(!o.isMesh||!o.geometry.attributes.position||o.material.transparent||mirrorPlanes.includes(o)) return; const P=o.geometry.attributes.position, I=o.geometry.index; const mw=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
        const cnt=I?I.count:P.count; for(let t=0;t<cnt;t+=3){ const ia=I?I.getX(t):t, ib=I?I.getX(t+1):t+1, ic=I?I.getX(t+2):t+2; A.fromBufferAttribute(P,ia).applyMatrix4(mw); if(A.distanceTo(c)>0.3) continue; B.fromBufferAttribute(P,ib).applyMatrix4(mw); C.fromBufferAttribute(P,ic).applyMatrix4(mw);
          N.subVectors(B,A).cross(C.clone().sub(A)); const ar=N.length(); if(ar<1e-9) continue; N.divideScalar(ar); M.copy(A).add(B).add(C).divideScalar(3); if(M.distanceTo(c)>0.22) continue;
          const d=Math.abs(N.dot(n)); if(d<0.6) continue; faces.push({o:M.clone().sub(c).dot(n), pts:[A.clone(),B.clone(),C.clone()], ar}); } });
      if(faces.length<4)return def; const hist=new Map(); for(const f of faces){ const k=Math.round(f.o/0.01); hist.set(k,(hist.get(k)||0)+f.ar); } let bk=0,ba=-1; for(const [k,a] of hist){ const a3=a+(hist.get(k-1)||0)+(hist.get(k+1)||0); if(a3>ba){ ba=a3; bk=k; } } const top=bk*0.01+0.015; const sel=faces.filter(f=>Math.abs(f.o-bk*0.01)<0.035); if(sel.length<2)return def;
      let u0=1e9,u1=-1e9,w0=1e9,w1=-1e9; for(const f of sel) for(const q of f.pts){ const d=q.clone().sub(c); const a=d.dot(u), b=d.dot(w); u0=Math.min(u0,a); u1=Math.max(u1,a); w0=Math.min(w0,b); w1=Math.max(w1,b); }
      const W=u1-u0, H=w1-w0; if(W<0.06||H<0.04||W>0.45||H>0.32) return def;
      // trace the housing's real outline into the glass mask, then erode it a little so a thin rim of housing frames the glass
      const MW=256, MH=Math.max(32,Math.round(256*H/W)), cv=document.createElement('canvas'); cv.width=MW; cv.height=MH; const g=cv.getContext('2d'); g.fillStyle='#000'; g.fillRect(0,0,MW,MH); g.fillStyle='#fff';
      const px=q=>{ const d=q.clone().sub(c); return [(d.dot(u)-u0)/W*MW,(1-(d.dot(w)-w0)/H)*MH]; };
      for(const f of sel){ const P=f.pts.map(px); g.beginPath(); g.moveTo(...P[0]); g.lineTo(...P[1]); g.lineTo(...P[2]); g.closePath(); g.fill(); g.strokeStyle='#fff'; g.lineWidth=1.2; g.stroke(); }
      const er=Math.max(3,Math.round(MW*0.022/W*0.1*10)); const src=document.createElement('canvas'); src.width=MW; src.height=MH; src.getContext('2d').drawImage(cv,0,0);
      g.globalCompositeOperation='destination-in'; for(let k=0;k<12;k++){ const t=k/12*Math.PI*2; g.drawImage(src,Math.cos(t)*er,Math.sin(t)*er); } g.globalCompositeOperation='source-over';
      const oMax=Math.max(...sel.map(f=>f.o));
      const cc=c.clone().addScaledVector(u,(u0+u1)/2).addScaledVector(w,(w0+w1)/2).addScaledVector(n,oMax+0.0025);
      return {...def,c:cc.toArray(),w:W,h:H,mask:cv}; };
    if(D.in) mirrorPlane=place(D.in,0.18,0.82,26,true);
    if(D.L){ const R={...D.L,c:[D.L.c[0],D.L.c[1],-D.L.c[2]],n:[D.L.n[0],D.L.n[1],-D.L.n[2]]}; const rr=D.L.ellipse?'ellipse':(D.L.rad||40); place(D.L.fixed?D.L:fit(D.L),0.6,1.0,rr,false); place(D.L.fixed?R:fit(R),0.0,0.4,rr,false); }
    return; }
  mirrorPlane=mirrorMesh(0.228,0.058,0.18,0.82,0.15,0.85,26); mirrorPlane.geometry.rotateY(-Math.PI/2); mirrorPlane.position.set(0.471,1.0925,-0.007); mirrorPlane.rotation.y=-0.14; model.body.add(mirrorPlane); mirrorPlanes.push(mirrorPlane);
  for(const s of [-1,1]){ const n=new THREE.Vector3(-0.9,0.01,-s*0.44).normalize(); const u=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),n).normalize(), w=new THREE.Vector3().crossVectors(n,u);
    const sm=mirrorMesh(0.184,0.104,s<0?0.6:0.0,s<0?1.0:0.4,0.08,0.95,40); sm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u,w,n)); sm.position.set(0.611,0.859,s*1.033).addScaledVector(n,0.002); model.body.add(sm); mirrorPlanes.push(sm); } }
attachMirrors();
const headSpot=new THREE.SpotLight(0xfff2d8,0,90,0.55,0.45,1.2); headSpot.position.set(2.1,0.7,0); model.body.add(headSpot);
const headTarget=new THREE.Object3D(); headTarget.position.set(25,-1.5,0); model.body.add(headTarget); headSpot.target=headTarget;
let headlightsOn=false;
let cubeRT=null, cubeCam=null;
if(settings.quality==='high' && model.setEnvMap){ cubeRT=new THREE.WebGLCubeRenderTarget(96,{type:THREE.HalfFloatType}); cubeCam=new THREE.CubeCamera(0.3,90,cubeRT); scene.add(cubeCam); }
let cubeFace=0;
function updateReflections(){
  if(!cubeCam) return; if(updateReflections.on && (frameNo&1)) return; const au=renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate=false;
  model.root.visible=false; rain.m.visible=false;
  if(!updateReflections.on){ cubeCam.position.set(phys.x,1.0,phys.y); cubeCam.update(renderer,scene); model.setEnvMap(cubeRT.texture); updateReflections.on=true; }
  else { if(cubeFace===0){ cubeCam.position.set(phys.x,1.0,phys.y); cubeCam.updateMatrixWorld(true); }
    const tex=cubeRT.texture, mau=tex.mipmapsAutoUpdate; tex.mipmapsAutoUpdate=cubeFace===5;
    renderer.setRenderTarget(cubeRT,cubeFace); renderer.render(scene,cubeCam.children[cubeFace]); renderer.setRenderTarget(null); tex.mipmapsAutoUpdate=mau;
    if(cubeFace===5) tex.needsPMREMUpdate=true; cubeFace=(cubeFace+1)%6; }
  model.root.visible=true; rain.m.visible=wet; renderer.shadowMap.autoUpdate=au;
}
// Sahneden çıkan bir aracın GPU kaynaklarını bırak (araç değişimi, oyuncu ayrılması). Sadece başka hiçbir yerde
// kullanılmayanlar: yeni araç, diğer oyuncular ve önbellekteki şablonlar (paylaşılan geometri/malzeme) dokunulmaz;
// ayna/yansıma hedefleri (render target) ve ortam haritası hiç bırakılmaz. three.js'te bırakılmış bir kaynak yeniden
// kullanılırsa kendiliğinden tekrar yüklenir: yanlışlıkla bırakılan bir şey bozulmaz, sadece yeniden yüklenir.
function kaynaklar(x,set,seen=new Set(),d=0){
  if(!x||typeof x!=='object'||seen.has(x)||d>6) return; seen.add(x);
  if(x.isObject3D){ x.traverse(o=>{ if(o.geometry) set.add(o.geometry); for(const m of [].concat(o.material||[])) kaynaklar(m,set,seen,d+1); }); return; }
  if(x.isBufferGeometry){ set.add(x); return; }
  if(x.isTexture){ set.add(x); return; }
  if(x.isMaterial){ set.add(x); for(const k in x){ const v=x[k]; if(v&&v.isTexture) set.add(v); } return; }
  for(const v of Array.isArray(x)?x:Object.values(x)) kaynaklar(v,set,seen,d+1);
}
function aracBirak(eski){
  if(!eski||!eski.root) return; const keep=new Set();
  kaynaklar(model&&model.root,keep); for(const r of remotes.values()) if(r.model!==eski) kaynaklar(r.model.root,keep);
  kaynaklar(sablonlar(),keep); kaynaklar(ferrariSablon(),keep);
  const birak=new Set(); kaynaklar(eski.root,birak);
  for(const k of birak){ if(keep.has(k)||k.isRenderTargetTexture||k===scene.environment||k===scene.background) continue; k.dispose(); }
}
function setMyColor(c){ settings.color=c; model.paint.color.set(c); }
// swap the player's car: real model, real figures
async function setVehicle(id){
  if(!VEHICLES[id]) return; if(phys.fuelUse){ SAVE.veh[settings.vehicle]={fuel:+(phys.fuel??1).toFixed(4),damage:+phys.damage.toFixed(1)}; store.set('tp8_save',JSON.stringify(SAVE)); } settings.vehicle=id; store.set('tp7_veh',id); renderVehicleCards();
  if(!vehicleReady(id)){ toast(VEHICLES[id].name+' yükleniyor…',1500); const ok=await loadVehicle(id); if(!ok){ toast('Araç yüklenemedi',2500); return; } if(settings.vehicle!==id) return; }
  const old=model; const nm=makeVehicleModel(id,settings.color);
  scene.remove(old.root); model=nm; scene.add(model.root); model.body.add(headSpot); model.body.add(headTarget); attachMirrors(); aracBirak(old);
  updateReflections.on=false; setSpec(VEHICLES[id].spec); phys.gear=1; audio.profile=VEHICLES[id].sound; if(online) net.set(myPres());
  $('vehCredit').textContent=VEHICLES[id].credit; }
function renderVehicleCards(){ const box=$('vSel'); if(!box) return; box.innerHTML='';
  for(const id of VEHICLE_IDS){ const V=VEHICLES[id]; const b=document.createElement('button'); b.className='vcard'+(id===settings.vehicle?' on':''); b.type='button';
    const t=document.createElement('b'); t.textContent=V.name; const i=document.createElement('span'); i.textContent=V.info; b.append(t,i); b.onclick=()=>setVehicle(id); box.appendChild(b); } }
const smoke=new Particles(scene,settings.quality==='low'?250:700);
const skids=new SkidMarks(scene,settings.quality==='low'?1200:3500);
const audio=new CarAudio(); audio.profile=VEHICLES[settings.vehicle].sound;
// ---- exhaust backfire: flame + glow + sparks, fired by the same events as the pop sound ----
// exhaust flame: an axial billboard (turns about the pipe axis to face the camera) with a turbulent fire shader.
// Noise-distorted cone, blackbody colours (blue root, white-yellow core, orange-red ragged edge), flickers every frame.
const bfGlowTex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d'); const r=g.createRadialGradient(32,32,0,32,32,32); r.addColorStop(0,'rgba(255,180,90,.5)'); r.addColorStop(1,'rgba(255,90,20,0)'); g.fillStyle=r; g.fillRect(0,0,64,64); return new THREE.CanvasTexture(c); })();
const bfLight=new THREE.PointLight(0xff8a30,0,5,2); scene.add(bfLight);
const flameGeo=new THREE.PlaneGeometry(1,1,1,1).translate(-0.5,0,0);   // x: 0 at the pipe .. -1 at the tip, y: -0.5..0.5 across
const FLAME_VS=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const FLAME_FS=`uniform float uTime, uLife, uSeed, uNitro; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*13.7)*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*n(p); p*=2.03; a*=0.5; } return v; }
  void main(){
    float x=1.0-vUv.x;                    // 0 at the pipe, 1 at the tip
    float y=(vUv.y-0.5)*2.0;              // -1..1 across
    float t=uTime*28.0;
    float turb=fbm(vec2(x*5.0-t, y*2.5+uSeed))-0.5;
    float wob=(fbm(vec2(x*3.0-t*0.7, uSeed*3.0))-0.5)*0.6*x;
    float width=(0.22+0.55*x)*(1.0-smoothstep(0.55,1.0,x))*(0.8+0.7*turb);   // widens then pinches off
    float d=abs(y-wob)/max(width,0.001);
    float body=1.0-smoothstep(0.35,1.0,d+turb*0.6*x);
    float len=1.0-smoothstep(0.35+0.4*uLife,1.0,x+turb*0.35);
    float a=body*len*clamp(uLife*1.8,0.0,1.0);
    float heat=clamp((1.0-x*1.35)*(1.0-d*0.7)+turb*0.25,0.0,1.0);
    vec3 col=mix(vec3(0.85,0.12,0.02),vec3(1.0,0.48,0.08),smoothstep(0.0,0.35,heat));
    col=mix(col,vec3(1.0,0.86,0.45),smoothstep(0.35,0.7,heat));
    col=mix(col,vec3(1.0,0.97,0.88),smoothstep(0.75,1.0,heat));
    col=mix(col,vec3(0.45,0.6,1.0),(1.0-smoothstep(0.0,0.09,x))*0.8);   // blue root at the pipe lip
    vec3 nc=mix(vec3(0.15,0.25,1.0),vec3(0.35,0.75,1.0),smoothstep(0.1,0.55,heat)); nc=mix(nc,vec3(0.9,0.97,1.0),smoothstep(0.7,1.0,heat)); col=mix(col,nc,uNitro);   // nitrous: blue jet
    if(a<0.01) discard; gl_FragColor=vec4(col*a*1.6,a); }`;
function ensureBackfire(m){ if(m.backfire) return m.backfire; m.backfire=(m.flames||[]).map((f,i)=>{ const g=new THREE.Group(); g.position.copy(f.position); g.rotation.copy(f.rotation);
    f.geometry.computeBoundingBox(); g.position.x+=f.geometry.boundingBox.max.x*0.9;   // nitro cones are centred on the pipe: start the flame at the pipe lip
    const mat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uLife:{value:1},uSeed:{value:i*1.7},uNitro:{value:0}},vertexShader:FLAME_VS,fragmentShader:FLAME_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false});
    const fl=new THREE.Mesh(flameGeo,mat); fl.frustumCulled=false;
    const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:bfGlowTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:0.5})); glow.scale.set(0.3,0.3,1); glow.position.x=-0.03;
    g.add(fl,glow); g.visible=false; f.parent.add(g); g.userData={fl,mat,glow}; return g; }); m.bfT=0; return m.backfire; }
const _ax=new THREE.Vector3(), _cp=new THREE.Vector3(), _q=new THREE.Quaternion(), _iq=new THREE.Quaternion();
const SPARKS=240, spPos=new Float32Array(SPARKS*3), spCol=new Float32Array(SPARKS*3), spV=new Float32Array(SPARKS*3), spLife=new Float32Array(SPARKS); let spNext=0;
const spGeo=new THREE.BufferGeometry(); spGeo.setAttribute('position',new THREE.BufferAttribute(spPos,3)); spGeo.setAttribute('color',new THREE.BufferAttribute(spCol,3));
const sparks=new THREE.Points(spGeo,new THREE.PointsMaterial({size:0.035,map:bfGlowTex,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false})); sparks.frustumCulled=false; scene.add(sparks);
const _bv=new THREE.Vector3(), _bd=new THREE.Vector3();
function backfire(m,v){ if(!m||!m.flames||!m.flames.length) return; if(Math.random()>0.4+v*0.5) return;   // not every pop shows a flame
  const bfs=ensureBackfire(m); m.bfLife=0.06+Math.random()*0.07+v*0.05; m.bfT=m.bfLife; m.bfLen=(0.35+Math.random()*0.5)*(0.6+v*0.6);
  for(const g of bfs){ g.userData.mat.uniforms.uSeed.value=Math.random()*10; g.getWorldPosition(_bv); _bd.set(-1,0,0).applyQuaternion(g.getWorldQuaternion(_q));
    // a little dark puff after the bang
    smoke.emit(_bv.x+_bd.x*0.3,_bv.y,_bv.z+_bd.z*0.3,_bd.x*1.5+phys.vx*0.8,0.3,_bd.z*1.5+phys.vy*0.8,{color:[0.22,0.21,0.2],size:0.35,grow:1.6,life:0.6+Math.random()*0.4,alpha:0.18*v});
    if(v>0.7 && Math.random()<0.4){ const n=1+Math.floor(Math.random()*3); for(let k=0;k<n;k++){ const i=spNext; spNext=(spNext+1)%SPARKS; spPos[i*3]=_bv.x+_bd.x*0.2; spPos[i*3+1]=_bv.y; spPos[i*3+2]=_bv.z+_bd.z*0.2;
      const sp=4+Math.random()*5; spV[i*3]=_bd.x*sp+(Math.random()-.5)*1.2+phys.vx; spV[i*3+1]=Math.random()*1.0; spV[i*3+2]=_bd.z*sp+(Math.random()-.5)*1.2+phys.vy; spLife[i]=0.1+Math.random()*0.15; } } }
  bfs[0].getWorldPosition(bfLight.position); bfLight.intensity=2.2*v; }
let lastCutVis=0;
function updateBackfire(dt){
  if(phys.cutEvent && phys.cutEvent!==lastCutVis){ lastCutVis=phys.cutEvent; if(mode==='free'||mode==='race') backfire(model,0.85); }
  if(model&&model.flames&&model.flames.length){ ensureBackfire(model); for(const f of model.flames) f.visible=false; }
  for(const m of [model]){ if(!m||!m.backfire) continue; m.bfT=window.__bfHold?(m.bfLife||0.1)*0.6:Math.max(0,(m.bfT||0)-dt);
    const nit=phys.nitroOn&&(mode==='free'||mode==='race'); m.nitK=(m.nitK||0)+((nit?1:0)-(m.nitK||0))*Math.min(1,dt*12);
    if(m.nitK>0.02 && m.bfT<=0){ m.bfT=0.0001; m.bfLife=0.0001; }
    const on=m.bfT>0||m.nitK>0.02, life=m.nitK>0.02?Math.max(m.nitK,0.6):(on?m.bfT/(m.bfLife||0.1):0);
    if(m.nitK>0.02) m.bfLen=0.75+Math.random()*0.15;
    for(const g of m.backfire){ g.visible=on; if(!on) continue; const u=g.userData; u.mat.uniforms.uTime.value=performance.now()/1000; u.mat.uniforms.uLife.value=life; u.mat.uniforms.uNitro.value=m.nitK>0.02?1:0;
      const grow=m.nitK>0.02?m.nitK:Math.min(1,(1-life)*6+0.25);                                       // shoots out fast, then pulls back
      const L=m.bfLen*grow*(0.9+Math.random()*0.2); u.fl.scale.set(L,L*0.42,1);
      // axial billboard: spin the quad about its own x axis so its face points at the camera
      g.updateWorldMatrix(true,false); g.getWorldQuaternion(_q); _iq.copy(_q).invert(); _cp.copy(camera.position); g.worldToLocal(_cp); u.fl.rotation.x=Math.atan2(-_cp.y,_cp.z); u.glow.material.opacity=0.45*life; } }
  bfLight.intensity=Math.max(0,bfLight.intensity-dt*40);
  for(let i=0;i<SPARKS;i++){ if(spLife[i]<=0){ spCol[i*3]=spCol[i*3+1]=spCol[i*3+2]=0; continue; } spLife[i]-=dt; spV[i*3+1]-=9.8*dt;
    spPos[i*3]+=spV[i*3]*dt; spPos[i*3+1]=Math.max(0.02,spPos[i*3+1]+spV[i*3+1]*dt); spPos[i*3+2]+=spV[i*3+2]*dt; if(spPos[i*3+1]<=0.02){ spLife[i]=0; }
    const l=Math.max(0,Math.min(1,spLife[i]/0.2)); spCol[i*3]=1*l; spCol[i*3+1]=(0.45+0.4*l)*l; spCol[i*3+2]=0.1*l*l; }
  spGeo.attributes.position.needsUpdate=true; spGeo.attributes.color.needsUpdate=true; }
audio.onPop=v=>{ if(mode==='free'||mode==='race'||mode==='countdown') backfire(model,v); };

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
renderVehicleCards(); $("vehCredit").textContent=VEHICLES[settings.vehicle].credit;
function seg(id,val,on){ const el=$(id); [...el.children].forEach(b=>{ b.classList.toggle('on',b.dataset.v===val); b.onclick=()=>{ [...el.children].forEach(x=>x.classList.remove('on')); b.classList.add('on'); on(b.dataset.v); }; }); }
seg('qSeg',ULTRA?'ultra':settings.quality,v=>{ store.set('tp3_quality',v); if(v!==(ULTRA?'ultra':settings.quality)){ toast('Grafik ayarı uygulanıyor…'); setTimeout(()=>location.reload(),400); } });
seg('gSeg',settings.manual?'manual':'auto',v=>{ settings.manual=v==='manual'; phys.manual=settings.manual; store.set('tp3_manual',settings.manual?'1':'0'); });
seg('aSeg',settings.assists?'on':'off',v=>{ settings.assists=v==='on'; phys.assists=settings.assists; store.set('tp3_assists',settings.assists?'1':'0'); });
seg('mSeg',settings.map,v=>{ settings.map=v; store.set('tp4_map',v); toast(v==='city'?'Harita yükleniyor…':'Pist yükleniyor…',1200); setTimeout(()=>{ useWorld(v); parkShowcase(); updateMenuLabels(); },30); });
seg('tSeg',settings.time,v=>{ settings.time=v; store.set('tp4_time',v); applyTime(v); shareSet('tm',v); });
seg('wSeg',settings.weather,v=>{ store.set('tp6_wx',v); applyWeather(v); shareSet('wx',v); });
function setupMenuSegs(){ seg('gSeg',settings.manual?'manual':'auto',v=>{ settings.manual=v==='manual'; phys.manual=settings.manual; store.set('tp3_manual',settings.manual?'1':'0'); }); seg('tSeg',settings.time,v=>{ settings.time=v; store.set('tp4_time',v); applyTime(v); shareSet('tm',v); }); seg('wSeg',settings.weather,v=>{ store.set('tp6_wx',v); applyWeather(v); shareSet('wx',v); }); }
function updateMenuLabels(){ $('soloBtn').textContent=settings.map==='city'?'Tek Başına Gez':'Tek Başına Antrenman'; }
function cleanName(){ return (nameIn.value.trim()||'Pilot').slice(0,14); }
function show(id){ ['menu','lobby','results','pause'].forEach(p=>$(p).classList.toggle('hidden',p!==id)); }
function toast(msg,ms=2500){ const t=$('toast'); t.textContent=msg; t.style.opacity=1; clearTimeout(toast._t); toast._t=setTimeout(()=>t.style.opacity=0,ms); }
function saveName(){ settings.name=cleanName(); store.set('tp_name',settings.name); }

// ---------------- network ----------------
let peers=[];
const net=new Net(ps=>{ peers=ps; onPeersChanged(); }, ()=>{ goMenu(); }, toast);
net.onExtra=(d,from)=>{ if(d.k==='hit' && net.isHost && from){ if(W && W.traffic) W.traffic.applyHits(d.h); return; }
  if(d.k==='tr' && !net.isHost){ if(typeof d.ht==='number'){ const off=d.ht-Date.now(); CLOCK.off=Math.abs(off-CLOCK.off)>2000?off:CLOCK.off+(off-CLOCK.off)*0.1; } if(W && W.traffic) W.traffic.unpack(d.d); } };
const netNote=$('netNote');
if(net.available){ $('joinBtn').disabled=false; netNote.innerHTML='Aynı oda kodunu giren herkes aynı haritaya katılır: <b>Şehir</b> seçip odayı açarsan arkadaşınla şehirde gezersin, <b>Pist</b> seçersen yarışırsınız (haritayı odayı açan seçer). <b>🔗 Davet</b> ile arkadaşına link gönder.'; }
else netNote.innerHTML='<span class="warn">Bağlantı kütüphanesi yüklenemedi.</span> İnterneti kontrol edip sayfayı yenile.';
const myPres=()=>({name:settings.name,color:settings.color,veh:settings.vehicle,pv:PROTO});
// Sürüm uyuşmazlığı: her oyuncu için bir kez uyar. pv yoksa Aşama 4 öncesi sürüm (1).
const pvUyarildi=new Set();
function surumKontrol(){
  for(const p of peers){ if(p.me||!p.p||pvUyarildi.has(p.id)) continue;
    if(!('name' in p.p)) continue;                              // varlık bilgisi henüz gelmedi
    const pv=typeof p.p.pv==='number'?p.p.pv:1; if(pv===PROTO) continue;
    pvUyarildi.add(p.id); const ad=safeName(p.p.name)||'Bir oyuncu', host=p.id===net.hostId;
    if(pv<PROTO) toast(host?'Oda kurucusunun oyunu eski sürümde: ona sayfayı yenilemesini söyle':ad+' eski sürümde: sayfayı yenilemesi lazım',7000);
    else toast('Oyunun yeni sürümü var ('+ad+' yeni sürümde): sayfayı yenile',7000); } }

$('joinBtn').onclick=async()=>{
  if(!net.available) return; saveName(); audio.start();
  const code=(codeIn.value||randCode()).toUpperCase(); codeIn.value=code; store.set('tp_code',code);
  $('joinBtn').disabled=true; $('joinBtn').textContent='Bağlanıyor…';
  try{ await net.join(code); }
  catch(e){ $('joinBtn').disabled=false; $('joinBtn').textContent='Odaya Gir'; const zt=e&&e.type==='zaman aşımı';   // TURN gerekiyor ama çalışmıyor (ör. kota doldu) ya da ağ engelliyor
    toast('Odaya bağlanılamadı ('+((e&&e.type)||'hata')+')'+(zt?' · Ağın doğrudan bağlantıya izin vermiyor olabilir: Wi-Fi\'da tekrar dene':''),zt?7000:4000); return; }
  $('joinBtn').disabled=false; $('joinBtn').textContent='Odaya Gir';
  online=true; seenRaces=new Set(); $('lobbyCode').textContent=code; shared.wx=shared.tm=shared.pz=0;
  if(net.isHost){ net.set({...myPres(), map:settings.map, wx:settings.weather, wxV:1, tm:settings.time, tmV:1, pz:false, pzV:1, ready:false, st:'lobby', raceId:null, race:null}); shared.wx=shared.tm=shared.pz=1; net.rebuild();
    if(settings.map==='city') startFree(); else enterLobby(); }
  else { net.set({...myPres(), ready:false, st:'lobby', raceId:null}); enterLobby(); $('lobbyNote').textContent='Oda kurucusunun haritası bekleniyor…'; }
};
$('soloBtn').onclick=()=>{ saveName(); audio.start(); online=false; if(settings.map==='city') startFree(); else startRace({id:'solo'+Date.now(), p:['me']}); };
$('copyBtn').onclick=async()=>{ const url=location.origin+location.pathname+'?oda='+encodeURIComponent($('lobbyCode').textContent);
  try{ await navigator.clipboard.writeText(url); toast('Link kopyalandı ✓ Arkadaşına gönder'); }catch(e){ toast(url,6000); } };
$('freeCopy').onclick=()=>$('copyBtn').onclick();
$('freeGo').onclick=e=>{ e.currentTarget.blur(); goToFriend(); };
function enterLobby(){
  mode='lobby'; ready=false; resultsShown=false; raceId=null; clearRemotes();
  net.set({ready:false, st:'lobby', raceId:null, fin:null, x:null});
  $('readyBtn').textContent='Hazırım'; $('readyBtn').classList.add('go');
  show('lobby'); hud(false); renderLobby();
}
$('readyBtn').onclick=()=>{ ready=!ready; net.set({ready}); $('readyBtn').textContent=ready?'Hazır değilim':'Hazırım'; $('readyBtn').classList.toggle('go',!ready); renderLobby(); checkHost(); };
$('leaveBtn').onclick=()=>goMenu();
function goMenu(){ if(mode==='free') saveGame(); paused=false; CLOCK.off=0; net.leave(); online=false; peers=[]; clearRemotes(); mode='menu'; resultsShown=false; show('menu'); hud(false); parkShowcase(); for(const id in (audio.horns||{})) audio.horn(id,false); }
function hud(on){ $('hud').classList.toggle('hidden',!on); $('touch').classList.toggle('hidden',!(on&&isTouch)); $('lights').classList.add('hidden');
  const free=mode==='free'; $('tl').classList.toggle('hidden',free); $('street').classList.toggle('hidden',!free); $('freeBar').classList.toggle('hidden',!free); }
$('resumeBtn').onclick=()=>setPause(false);
$('respawnBtn').onclick=()=>{ setPause(false); respawnCool=0; respawn(); };
function openPause(){ paused=true; show('pause');
  $('pauseNote').textContent=online?'Oyun odadaki herkes için durdu. Hava ve saat değişikliği herkese uygulanır.':'Esc ile devam edebilirsin.'; refreshPauseSegs(); }
function refreshPauseSegs(){
  seg('pCam',String(camMode),v=>{ camMode=+v; store.set('tp3_cam',camMode); });
  seg('pTime',settings.time,v=>{ settings.time=v; store.set('tp4_time',v); applyTime(v); shareSet('tm',v); setupMenuSegs(); });
  seg('pWx',settings.weather,v=>{ store.set('tp6_wx',v); applyWeather(v); shareSet('wx',v); setupMenuSegs(); });
  seg('pGear',settings.manual?'manual':'auto',v=>{ settings.manual=v==='manual'; phys.manual=settings.manual; store.set('tp3_manual',settings.manual?'1':'0'); setupMenuSegs(); });
  seg('pSnd',audio.muted?'off':'on',v=>{ audio.setMuted(v==='off'); });
}
$('pauseMenuBtn').onclick=()=>{ if(online&&paused) shareSet('pz',false); paused=false; goMenu(); };
let paused=false, pausedAt=0;
// room-wide settings: whoever changes them last wins (version counter, ties broken by player id)
const shared={wx:0,tm:0,pz:0};
function shareSet(key,val){ if(!online) return; const v=Math.max(shared[key],...peers.map(p=>+(p.p&&p.p[key+'V'])||0))+1; shared[key]=v; net.set({[key]:val,[key+'V']:v}); }
function applyShared(){ if(!online) return;
  for(const key of ['wx','tm','pz']){ let best=null; for(const p of peers){ const q=p.p||{}; const v=+q[key+'V']||0; if(v>0 && (!best || v>best.v || (v===best.v && p.id>best.id))) best={v,id:p.id,val:q[key],name:q.name}; }
    if(!best || best.v<=shared[key]) continue; shared[key]=best.v;
    if(key==='wx' && best.val!==settings.weather){ store.set('tp6_wx',best.val); applyWeather(best.val); setupMenuSegs(); if(paused) refreshPauseSegs(); }
    if(key==='tm' && best.val!==settings.time){ settings.time=best.val; store.set('tp4_time',best.val); applyTime(best.val); setupMenuSegs(); if(paused) refreshPauseSegs(); }
    if(key==='pz' && (mode==='free'||mode==='race')){ const who=best.id===net.myId?'Sen':safeName(best.name); setPause(!!best.val, best.val?who+' oyunu duraklattı · herkes için durdu':null, false); } } }
function setPause(on,note,share=true){
  if(on===paused) { if(on&&note) $('pauseNote').textContent=note; return; }
  const now=performance.now();
  if(on){ paused=true; pausedAt=now; openPause(); if(note) $('pauseNote').textContent=note; }
  else { paused=false; const d=now-pausedAt; raceStart+=d; lapStart+=d; countStart+=d; show(null); if(online) toast('Oyun devam ediyor',1200); }
  if(share) shareSet('pz',on); }

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
  applyShared();
  if(online && !net.isHost && hp && hp.map && (mode==='lobby')){
    if(hp.map!==settings.map){ settings.map=hp.map; useWorld(hp.map); }
    if(hp.map==='city'){ startFree(); return; }
  }
  for(const p of peers){ const r=p.p&&p.p.race; if(r && typeof r.id==='string' && Array.isArray(r.p)) handleRace(r); }
  if(raceId || mode==='free'){
    const alive=new Set();
    for(const p of peers){ if(p.me) continue; const s=p.p||{}; const inMine= mode==='free' ? s.st==='free' : s.raceId===raceId; if(!inMine || typeof s.x!=='number') continue;
      alive.add(p.id); let r=remotes.get(p.id);
      const rv=VEHICLE_IDS.includes(s.veh)?s.veh:'f458';
      if(r && r.veh!==rv && vehicleReady(rv)){ scene.remove(r.model.root); remotes.delete(p.id); aracBirak(r.model); r=null; }
      if(!r){ if(!vehicleReady(rv)) loadVehicle(rv).then(()=>onPeersChanged());
        const m=makeVehicleModel(rv,safeColor(s.color)); scene.add(m.root); const label=nameSprite(safeName(s.name)); label.position.y=2.1; m.root.add(label);
        r={veh:vehicleReady(rv)?rv:'f458',model:m,x:s.x,y:s.y,a:s.a||0,v:0,vx:0,vy:0,steer:0,t:performance.now(),wheel:0}; remotes.set(p.id,r); }
      if(r.tx!==s.x||r.ty!==s.y||r.ta!==s.a) r.t=performance.now();
      r.tx=s.x; r.ty=s.y; r.ta=s.a||0; r.v=+s.v||0; r.sr=+s.sr||0; r.bk=!!s.bk; r.nt=!!s.nt; r.hn=!!s.hn; r.hl=!!s.hl;
      r.name=safeName(s.name); r.color=safeColor(s.color); r.lap=s.lap|0; r.cp=s.cp|0; r.idx=s.idx|0; r.fin=!!s.fin; r.ft=+s.ft||0; r.best=+s.best||0;
    }
    for(const [k,r] of [...remotes]) if(!alive.has(k)){ scene.remove(r.model.root); audio.horn(k,false); remotes.delete(k); aracBirak(r.model); }
  }
  renderLobby(); checkHost(); surumKontrol();
}
function clearRemotes(){ const eski=[...remotes.values()]; for(const [k,r] of remotes){ scene.remove(r.model.root); audio.horn(k,false); } remotes.clear(); for(const r of eski) aracBirak(r.model); }
function checkHost(){
  if(!online||mode!=='lobby'||!net.isHost||settings.map!=='track') return;
  const lp=named().filter(p=>p.p.st==='lobby'); if(lp.length<2 || !lp.every(p=>p.p.ready)) return;
  const race={id:'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), p:lp.map(p=>p.id).sort()};
  net.set({race}); handleRace(race);
}
function handleRace(r){ if(seenRaces.has(r.id)) return; seenRaces.add(r.id); if(mode!=='lobby' || !r.p.includes(net.myId)) return; startRace(r); }

// ---------------- free roam ----------------
// a free lane spot a few car lengths behind another player in the city (null if nobody is driving there)
function friendSpot(){ const fs=peers.filter(p=>!p.me&&p.p&&p.p.st==='free'&&typeof p.p.x==='number'); if(!fs.length) return null;
  const f=fs.reduce((a,b)=>(Math.hypot(a.p.x-phys.x,a.p.y-phys.y)<Math.hypot(b.p.x-phys.x,b.p.y-phys.y)?a:b)).p; const fa=+f.a||0;
  for(const d of [12,18,26,8]){ const l=nearestLane(f.x-Math.cos(fa)*d,f.y-Math.sin(fa)*d); if(Math.hypot(l.x-f.x,l.y-f.y)>6) return {x:l.x,y:l.y,a:l.a}; }
  const l=nearestLane(f.x,f.y); return {x:l.x+6,y:l.y,a:l.a}; }
function goToFriend(){ if(mode!=='free'||!online){ toast('Arkadaşına gitmek için şehirde bir odada olmalısın',2200); return; }
  const sp=friendSpot(); if(!sp){ toast('Şehirde başka oyuncu yok',1800); return; }
  phys.reset(sp.x,sp.y,sp.a); respawnCool=1.5; skids.clear(); toast('Arkadaşının yanına ışınlandın 👋',1800); }
function startFree(){
  useWorld('city'); clearRemotes(); skids.clear(); repairCar(model); raceId=null;
  // spawn on a random outer lane, spread players apart
  const k=Math.floor(Math.random()*8); const i=1+Math.floor(Math.random()*8);
  let sp=[{x:i*CP+30,y:k*CP+LANES[1],a:0},{x:k*CP-LANES[1],y:i*CP+30,a:Math.PI/2}][Math.random()<0.5?0:1];
  const fr=online&&friendSpot(); if(fr) sp=fr;
  phys.reset(sp.x,sp.y,sp.a); phys.manual=settings.manual; phys.assists=settings.assists; repairModel(model); loadVehState(); phys.fuelUse=true;
  mode='free'; show(null); hud(true); camInit=false; lastModeT=performance.now();
  toast(online?`Şehirde arkadaşlarınla · Arkadaşına git (T) · ${CAM_NAMES[camMode]} (C) · Esc menü`:`Şehirde serbest sürüş · ${CAM_NAMES[camMode]} (C) · Korna (H) · Esc menü`,4500);
  if(online) net.set({...myPres(), st:'free', ready:false, raceId:null, map:net.isHost?'city':undefined});
}

// ---------------- race ----------------
function gridPos(slot){ const row=Math.floor(slot/2), col=slot%2; const gi=(N-6-row*3+N)%N; const p=TP[gi]; const off=(col?1:-1)*2.8; return {x:p.x+p.nx*off, y:p.y+p.ny*off, a:p.a, i:gi}; }
function startRace(r){
  useWorld('track'); raceId=r.id; racers=r.p.slice(0,8); clearRemotes(); skids.clear(); repairCar(model);
  const me_id=online?net.myId:'me'; const g=gridPos(Math.max(0,racers.indexOf(me_id)));
  phys.reset(g.x,g.y,g.a); phys.manual=settings.manual; phys.assists=settings.assists; phys.hint=g.i; repairModel(model); phys.fuelUse=false; phys.damage=0; phys.fuel=1;
  Object.assign(me,{lap:0,cp:0,idx:g.i,prevIdx:g.i,fin:false,ft:0}); lastLap=0; bestLap=0; elapsed=0; resultsShown=false; lightsShown=-1;
  mode='countdown'; countStart=performance.now(); show(null); hud(true); $('lights').classList.remove('hidden');
  toast(`${CAM_NAMES[camMode]} · C ile değiştir`,2500);
  net.set({...myPres(), st:'race', ready:false, raceId, x:+g.x.toFixed(2), y:+g.y.toFixed(2), a:+g.a.toFixed(3), v:0, lap:0, cp:0, idx:g.i, fin:false, ft:0});
}
function respawn(){
  if(respawnCool>0) return;
  if(mode==='race' && !me.fin){ respawnCool=3; const i=nearest(phys.x,phys.y); const p=TP[i]; phys.x=p.x; phys.y=p.y; phys.a=p.a; phys.hint=i; }
  else if(mode==='free'){ respawnCool=2; const l=inCityArea(phys.x,phys.y)?nearestLane(phys.x,phys.y):nearestRoadSpot(phys.x,phys.y); phys.x=l.x; phys.y=l.y; phys.a=l.a; }
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
    const rec=SAVE.best[settings.vehicle]; let pb=false; if(!rec||lt<rec){ SAVE.best[settings.vehicle]=Math.round(lt); pb=!!rec; store.set('tp8_save',JSON.stringify(SAVE)); }
    me.lap++; me.cp=0;
    if(me.lap>=LAPS){ me.fin=true; me.ft=elapsed; const pos=1+[...remotes.values()].filter(r=>r.fin&&r.ft<elapsed).length; const prize=[3000,2000,1200,800][Math.min(3,pos-1)]; SAVE.money+=prize; store.set('tp8_save',JSON.stringify(SAVE)); toast('🏁 Bitiş! '+fmt(elapsed)+' · Ödül '+money(prize),3500); setTimeout(showResults,1500); }
    else toast((pb?'🏆 Rekor! ':lt===bestLap?'🟣 En iyi tur ':'Tur ')+fmt(lt)+(me.lap===LAPS-1?' · Son tur! 🔥':''),3000);
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
// ---- touch controls: analog steering pad (or tilt), pedals, action buttons ----
document.querySelectorAll('#touch .tb[data-k]').forEach(b=>{ const k=b.dataset.k;
  const on=e=>{ e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(_){} tkeys[k]=true; b.classList.add('on'); if(k==='up') edges.push('KeyE'); if(k==='dn') edges.push('KeyQ'); navigator.vibrate&&k!=='gas'&&k!=='down'&&navigator.vibrate(8); };
  const off=e=>{ e.preventDefault(); tkeys[k]=false; b.classList.remove('on'); };
  b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off); b.addEventListener('pointercancel',off); b.addEventListener('lostpointercapture',off); });
document.querySelectorAll('#touch .tb[data-e]').forEach(b=>b.addEventListener('pointerdown',e=>{ e.preventDefault(); edges.push(b.dataset.e); b.classList.add('on'); setTimeout(()=>b.classList.remove('on'),140); navigator.vibrate&&navigator.vibrate(8); }));
{ const pad=$('tSteer'), knob=$('tKnob'); let pid=null;
  const set=v=>{ tkeys.steerA=v; const w=pad.clientWidth/2-40; knob.style.transform=`translateX(${v*w}px) rotate(${v*35}deg)`; };
  const move=e=>{ const r=pad.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width*2-1; const dz=0.06, ax=Math.abs(x); set(ax<dz?0:Math.sign(x)*Math.min(1,(ax-dz)/(0.86-dz))); };
  pad.addEventListener('pointerdown',e=>{ e.preventDefault(); if(tilt.on) return; pid=e.pointerId; try{ pad.setPointerCapture(pid); }catch(_){} pad.classList.add('drag'); move(e); });
  pad.addEventListener('pointermove',e=>{ if(e.pointerId===pid) move(e); });
  const end=e=>{ if(e.pointerId!==pid) return; pid=null; pad.classList.remove('drag'); set(0); tkeys.steerA=null; };
  pad.addEventListener('pointerup',end); pad.addEventListener('pointercancel',end); pad.addEventListener('lostpointercapture',end); }
const tilt={on:false,v:0,zero:null};
function onTilt(e){ if(!tilt.on) return; const ang=(screen.orientation&&screen.orientation.angle)||window.orientation||0; let g=ang===90?e.beta:ang===-90||ang===270?-e.beta:e.gamma; if(g==null) return;
  if(tilt.zero==null) tilt.zero=g; const d=g-tilt.zero; tilt.v=Math.max(-1,Math.min(1,d/28)); if(Math.abs(tilt.v)<0.04) tilt.v=0; tkeys.steerA=tilt.v;
  const w=$('tSteer').clientWidth/2-40; $('tKnob').style.transform=`translateX(${tilt.v*w}px) rotate(${tilt.v*35}deg)`; }
$('tTilt').addEventListener('pointerdown',async e=>{ e.preventDefault();
  if(!tilt.on){ try{ if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission){ const r=await DeviceOrientationEvent.requestPermission(); if(r!=='granted'){ toast('Hareket sensörü izni verilmedi',2000); return; } } }catch(_){ }
    tilt.on=true; tilt.zero=null; addEventListener('deviceorientation',onTilt); toast('📱 Eğerek sürüş açık · telefonu düz tuttuğun an sıfır kabul edildi',2500); }
  else { tilt.on=false; removeEventListener('deviceorientation',onTilt); tkeys.steerA=null; $('tKnob').style.transform=''; toast('Eğerek sürüş kapalı',1200); }
  $('tTilt').classList.toggle('on',tilt.on); $('tSteer').classList.toggle('tilt',tilt.on); store.set('tp8_tilt',tilt.on?'1':''); });
function touchHudTick(){ if(!isTouch) return; const s=currentService();
  $('tSvc').classList.toggle('hidden',!(s&&mode==='free')); if(s) $('tSvc').textContent=s.kind==='repair'?'🔧 Tamir':s.kind==='charge'?'⚡ Şarj':'⛽ Yakıt';
  $('tTow').classList.toggle('hidden',!(mode==='free'&&((phys.fuel??1)<=0.02||phys.damage>=90)));
  $('tUp').classList.toggle('hidden',!phys.manual); $('tDn').classList.toggle('hidden',!phys.manual); }
// responsive scaling: the HUD follows the window size (reference 1600×900), panels grow on big screens and shrink on short ones
function fitUI(){ const w=innerWidth, h=innerHeight; const r=Math.min(w/1500,h/850);
  const ui=isTouch?1:Math.max(0.74,Math.min(1.6,r)), up=isTouch?Math.max(0.8,Math.min(1,h/520)):Math.max(0.78,Math.min(1.5,h/1000));
  document.documentElement.style.setProperty('--ui',ui.toFixed(3)); document.documentElement.style.setProperty('--up',up.toFixed(3)); }
addEventListener('resize',fitUI); fitUI();
if(isTouch){ document.body.classList.add('touch'); $('rotate').classList.add('need'); }
let padPrev=[];
function readInput(){
  let steer=((keys.ArrowRight||keys.KeyD||tkeys.right)?1:0)-((keys.ArrowLeft||keys.KeyA||tkeys.left)?1:0);
  let analogT=false; if(tkeys.steerA!=null&&steer===0){ steer=Math.sign(tkeys.steerA)*Math.pow(Math.abs(tkeys.steerA),1.25); analogT=true; }
  let gas=(keys.ArrowUp||keys.KeyW||tkeys.gas)?1:0, brake=(keys.ArrowDown||keys.KeyS||tkeys.down)?1:0;
  let hand=!!(keys.Space||tkeys.hand), nitro=!!(keys.ShiftLeft||keys.ShiftRight||keys.KeyN||tkeys.nitro), analog=false, hn=!!(keys.KeyH||tkeys.horn);
  const pads=navigator.getGamepads?navigator.getGamepads():[];
  for(const gp of pads){ if(!gp) continue;
    const ax=gp.axes[0]||0; if(Math.abs(ax)>0.08){ steer=Math.sign(ax)*Math.pow((Math.abs(ax)-0.08)/0.92,1.4); analog=true; }
    const b=i=>gp.buttons[i]?gp.buttons[i].value||(gp.buttons[i].pressed?1:0):0;
    gas=Math.max(gas,b(7)); brake=Math.max(brake,b(6)); hand=hand||b(0)>0.5; nitro=nitro||b(1)>0.5; hn=hn||b(10)>0.5||b(11)>0.5;
    const press=i=>b(i)>0.5 && !padPrev[i]; if(press(3)) edges.push('KeyC'); if(press(5)) edges.push('KeyE'); if(press(4)) edges.push('KeyQ'); if(press(2)) edges.push('KeyR'); if(press(9)) edges.push('Escape');
    padPrev=gp.buttons.map(x=>x.pressed); break; }
  return {steer,gas,brake,hand,nitro,analog:analog||analogT,horn:hn};
}
function handleEdges(){
  while(edges.length){ const k=edges.shift();
    if(k==='KeyC'){ camMode=(camMode+1)%3; store.set('tp3_cam',camMode); toast(CAM_NAMES[camMode],1500); }
    else if(k==='KeyK'){ audio.setMuted(!audio.muted); toast(audio.muted?'Ses kapalı (K)':'Ses açık (K)',1200); }
    else if(k==='KeyM'){ toggleBigMap(); }
    else if(k==='KeyF'){ serviceAction(); }
    else if(k==='KeyG'){ callTow(); }
    else if(k==='KeyL'){ headlightsOn=!headlightsOn; toast(headlightsOn?'Farlar açık':'Farlar kapalı',1000); }
    else if(k==='KeyR') respawn();
    else if(k==='KeyT') goToFriend();
    else if(k==='Escape' && bigMapOpen){ toggleBigMap(false); }
    else if(k==='Escape' && (mode==='free'||mode==='race')){ setPause(!paused); }
    else if((k==='KeyE'||k==='KeyX') && phys.manual){ phys.shift(1); audio.shiftBlip(); }
    else if((k==='KeyQ'||k==='KeyZ') && phys.manual){ phys.shift(-1); audio.shiftBlip(); }
  }
}

// ---------------- visuals ----------------
const _v=new THREE.Vector3();
function groundUnder(c){ const w=W&&W.phys; if(!w||!w.ground) return {f:c.surfF===3?0.15:0,r:c.surfR===3?0.15:0};
  const ca=Math.cos(c.a), sa=Math.sin(c.a); return {f:w.ground(c.x+ca*SPEC.a,c.y+sa*SPEC.a), r:w.ground(c.x-ca*SPEC.b,c.y-sa*SPEC.b)}; }
// ---- lamp glow: every head/tail lamp gets a soft halo sprite with a hot core, scaled by its real state ----
const lampTex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); const r=g.createRadialGradient(64,64,0,64,64,64);
  r.addColorStop(0,'rgba(255,255,255,1)'); r.addColorStop(0.08,'rgba(255,255,255,.95)'); r.addColorStop(0.2,'rgba(255,255,255,.35)'); r.addColorStop(0.5,'rgba(255,255,255,.08)'); r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r; g.fillRect(0,0,128,128); return new THREE.CanvasTexture(c); })();
const _li=new THREE.Matrix4(), _lv=new THREE.Vector3();
// find the lamp clusters of a model: group the vertices of every brake-/head-lamp mesh by side and take each side's centre and size
function lampClusters(m,mat){ m.root.updateMatrixWorld(true); _li.copy(m.body.matrixWorld).invert(); const pts=[];
  m.body.traverse(o=>{ if(!o.isMesh||o.material!==mat||!o.geometry.attributes.position) return; let p=o; while(p&&p!==m.body){ if(p.visible===false) return; p=p.parent; } const P=o.geometry.attributes.position; const step=Math.max(1,Math.floor(P.count/1500));
    for(let i=0;i<P.count;i+=step) pts.push(_lv.fromBufferAttribute(P,i).applyMatrix4(o.matrixWorld).applyMatrix4(_li).clone()); });
  // connected components on a 6 cm grid: each separate lamp (or lamp segment) becomes its own cluster
  const C=0.06, cell=new Map(), key=(x,y,z)=>x+','+y+','+z; for(const v of pts){ const k=key(Math.floor(v.x/C),Math.floor(v.y/C),Math.floor(v.z/C)); (cell.get(k)||cell.set(k,[]).get(k)).push(v); }
  const seen=new Set(), out=[];
  for(const k0 of cell.keys()){ if(seen.has(k0)) continue; const st=[k0], vs=[]; seen.add(k0);
    while(st.length){ const k=st.pop(); vs.push(...cell.get(k)); const [x,y,z]=k.split(',').map(Number); for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) for(let dz=-1;dz<=1;dz++){ const n=key(x+dx,y+dy,z+dz); if(cell.has(n)&&!seen.has(n)){ seen.add(n); st.push(n); } } }
    if(vs.length<4) continue; const mn=new THREE.Vector3(1e9,1e9,1e9), mx=new THREE.Vector3(-1e9,-1e9,-1e9); for(const v of vs){ mn.min(v); mx.max(v); }
    const sz=Math.max(mx.z-mn.z,mx.y-mn.y); if(sz<0.02) continue; out.push({c:mn.clone().add(mx).multiplyScalar(0.5),mn,mx,n:vs.length,sz}); }
  out.sort((a,b)=>b.sz-a.sz); return out.slice(0,8); }
function ensureLamps(m){ if(m.lamps) return m.lamps; const L=m.lamps={tail:[],head:[],rev:[]};
  const mk=(col,parent,pos)=>{ const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:lampTex,color:col,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,opacity:0})); sp.position.copy(pos); sp.renderOrder=3; parent.add(sp); return sp; };
  const tc=lampClusters(m,m.brakeMat).filter(c=>c.c.x<0), hc=m.headMat?lampClusters(m,m.headMat).filter(c=>c.c.x>0):[];
  for(const t of tc){ const w=Math.max(0.05,Math.min(0.45,t.sz)); const s=mk(0xff1a0a,m.body,new THREE.Vector3(t.mn.x-0.015,t.c.y,t.c.z)); s.userData.w=w; L.tail.push(s); }
  if(!m.bike){ const sides=[-1,1]; for(const sd of sides){ const cand=tc.filter(t=>Math.sign(t.c.z)===sd&&Math.abs(t.c.z)>0.3&&t.c.y<1.4).sort((a,b)=>b.sz-a.sz)[0]; if(!cand) continue;
      const r=mk(0xf4f8ff,m.body,new THREE.Vector3(cand.mn.x-0.02,cand.c.y-0.01,cand.c.z-sd*Math.min(0.1,(cand.mx.z-cand.mn.z)*0.25))); r.userData.w=0.1; L.rev.push(r); } }
  for(const h of hc){ const s=mk(0xfff4e2,m.body,new THREE.Vector3(h.c.x+(h.mx.x-h.c.x)*0.85,h.c.y,h.c.z)); s.userData.w=Math.max(0.05,Math.min(0.4,h.sz)); L.head.push(s); }
  m.lampInfo=tc.length+'/'+hc.length;
  return L; }
let lampLight=null;
const _fw=new THREE.Vector3(), _cd=new THREE.Vector3();
// a lamp only glows towards the side it shines to (no halos seen through the bodywork from the side)
function facing(s,sign){ s.getWorldPosition(_lv); _cd.subVectors(camera.position,_lv).normalize(); return Math.max(0,Math.min(1,(_cd.dot(_fw)*sign-0.05)/0.45)); }
function updateLamps(m,brake,lights,rev,isMe){ if(isMe&&window.__brk) brake=true; const L=ensureLamps(m); const t=performance.now(); _fw.set(1,0,0).transformDirection(m.body.matrixWorld);
  for(const s of [...L.tail,...L.head,...L.rev]) if(s.userData.broken) s.material.opacity=0;
  for(const s of L.tail){ if(s.userData.broken){ s.visible=false; continue; } const w=s.userData.w, k=brake?1:lights?0.38:0; s.material.opacity=k*(brake?0.95:0.7)*facing(s,-1); const sz=Math.min(1.1,w*(brake?3.0:1.9)+0.12); s.scale.set(sz,sz,1); s.visible=k>0; }
  for(const s of L.rev){ if(s.userData.broken){ s.visible=false; continue; } s.material.opacity=rev?0.9*facing(s,-1):0; s.visible=rev; s.scale.set(0.42,0.42,1); }
  for(const s of L.head){ if(s.userData.broken){ s.visible=false; continue; } const w=s.userData.w, k=lights?1:0.22; s.material.opacity=(m.hasPopups?(lights?0.35:0.25):(lights?0.85:0.45))*facing(s,1); const sz=Math.min(1.4,w*(lights?3.4:1.5)+0.1); s.scale.set(sz,sz,1); s.visible=k>0; }
  if(isMe){ if(!lampLight){ lampLight=new THREE.PointLight(0xff2010,0,6,2); scene.add(lampLight); }
    if(L.tail.length){ L.tail[0].parent.localToWorld(_lv.set((L.tail[0].position.x-0.6),0.5,0)); lampLight.position.copy(_lv); }
    const want=(brake?2.2:lights?0.5:0)+(rev?0:0); lampLight.color.set(rev&&!brake?0xe8eeff:0xff2010); lampLight.intensity+=((rev&&!brake?1.6:want)-lampLight.intensity)*0.35; } }
function placeCar(m,x,y,a,pitch,roll,steer,wheelAng,brake,nitro,bump=0,lights=headlightsOn,gh=null,rev=false,isMe=false){
  m.root.position.set(x,0,y); m.root.rotation.order='YXZ'; m.root.rotation.y=-a;
  if(gh){ const tY=(gh.f+gh.r)/2, tS=Math.atan2(gh.f-gh.r,SPEC.a+SPEC.b), kY=Math.abs(tY-(m.gY||0))>0.25?0.9:0.35; m.gY=(m.gY||0)+(tY-(m.gY||0))*kY; m.gS=(m.gS||0)+(tS-(m.gS||0))*(Math.abs(tS-(m.gS||0))>0.03?0.8:0.35); m.root.position.y=m.gY; m.root.rotation.z=m.gS; }
  if(m.bike){ m.setLean(m.leanT||0,lastFdt); m.body.rotation.set(0,0,-pitch*0.6); m.body.position.y=bump; } else { m.body.rotation.set(-roll,0,-pitch); m.body.position.y=(m.setPose?0:0.02)+bump; }
  if(m.setPose) m.setPose(steer,wheelAng);
  else { for(let i=0;i<4;i++){ const w=m.wheels[i]; if(w.front) w.pivot.rotation.y=-steer; w.spin.rotation.z=-wheelAng[i]; } m.steer.rotation.x=steer*12; }
  m.brakeMat.emissiveIntensity=brake?(m.vid?4.5:7):(lights?(m.vid?1.1:1.8):0.12); if(m.brake3Mat) m.brake3Mat.emissiveIntensity=brake?5:0;
  if(m.headMat) m.headMat.emissiveIntensity=lights?3.5:0.9;   // LED daytime running lights stay on
  updateLamps(m,brake,lights,rev,isMe);
  if(isMe&&m.glassMat){ const want=(camMode===1&&(mode==='free'||mode==='race'||mode==='countdown'))?0.14:0.45; if(m.glassMat.opacity!==want){ m.glassMat.opacity=want; } }
  if(m.setPopups) m.setPopups(lights,lastFdt||0.016);
  for(const f of m.flames){ f.visible=nitro; if(nitro){ const s=0.8+Math.random()*0.5; f.scale.set(s,1,1); } }
}
function worldOf(m,lx,ly,lz){ _v.set(lx,ly,lz); return m.body.localToWorld(_v); }
function carEffects(dt){
  const c=phys; const ca=Math.cos(c.a), sa=Math.sin(c.a);
  const TR=SPEC.track??0.83; const wheelsXY=[[SPEC.a,-TR],[SPEC.a,TR],[-SPEC.b,-TR],[-SPEC.b,TR]].map(([lx,lz])=>[c.x+ca*lx-sa*lz,c.y+sa*lx+ca*lz]);
  const slideR=Math.max(0,Math.abs(c.slipR)-0.11)*5 + c.spinR + (c.hand&&c.speed>3?0.7:0);
  const slideF=Math.max(0,Math.abs(c.slipF)-0.16)*4;
  for(let i=0;i<4;i++){
    const rear=i>=2, s=rear?slideR:slideF; const [x,z]=wheelsXY[i]; const surf=rear?c.surfR:c.surfF; const loose=surf===2||surf===4;
    const spinning=rear&&c.burnout, gy=model.gY||0; skids.add(i,x,z,c.a, !loose && (c.speed>2||spinning) ? Math.min(1,s) : 0, gy);
    if(spinning && !loose && Math.random()<0.3*dt*60) smoke.emit(x+(Math.random()-.5)*0.4,0.3+gy,z+(Math.random()-.5)*0.4,(Math.random()-.5)*2.5-1.2*Math.cos(c.a),0.9+Math.random()*1.2,(Math.random()-.5)*2.5-1.2*Math.sin(c.a),{size:0.9,grow:2.8,life:1.6+Math.random()*0.8,alpha:0.2});
    if(c.speed>2 && !loose && s>0.45 && Math.random()<Math.min(1,s-0.35)*0.8*dt*60) smoke.emit(x,0.25+gy,z,(Math.random()-.5)*1.5-c.vx*0.1,0.6+Math.random(),(Math.random()-.5)*1.5-c.vy*0.1,{size:0.8,grow:2.2,life:1.2+Math.random(),alpha:0.24});
    if(loose && c.speed>3 && Math.random()<0.5*dt*60) smoke.emit(x,0.3,z,-c.vx*0.2+(Math.random()-.5)*2,1+Math.random()*1.5,-c.vy*0.2+(Math.random()-.5)*2,{color:surf===4?[0.45,0.5,0.32]:[0.72,0.62,0.45],size:1.1,grow:2.8,life:1.2,alpha:0.35});
  }
  if(c.scrape>0.2 || c.impact>3){ const p=c.impactAt||{lx:0,lz:0}; const wx=c.x+ca*p.lx-sa*p.lz, wz=c.y+sa*p.lx+ca*p.lz;
    for(let k=0;k<(c.impact>3?14:2);k++) smoke.emit(wx,0.5,wz,(Math.random()-.5)*6,1+Math.random()*3,(Math.random()-.5)*6,{color:[1,0.65,0.2],size:0.12,grow:0,life:0.35+Math.random()*0.3,alpha:1,grav:9}); }
  if(wet && c.speed>8){ for(const i of [2,3]){ const [x,z]=wheelsXY[i]; if(Math.random()<Math.min(1,c.speed*0.02)) smoke.emit(x,0.25,z,-c.vx*0.25+(Math.random()-.5)*2,0.6+Math.random(),-c.vy*0.25+(Math.random()-.5)*2,{color:[0.78,0.8,0.84],size:0.45,grow:1.9,life:0.6,alpha:0.1}); } }
  if(c.damage>55 && Math.random()<dt*20*(c.damage/100)){ const p=worldOf(model,1.9,0.9,0); smoke.emit(p.x,p.y,p.z,c.vx*0.3,1.5,c.vy*0.3,{color:[0.25,0.25,0.27],size:0.8,grow:2,life:2,alpha:0.35}); }
}

// ---------------- camera ----------------
const camPos=new THREE.Vector3(), camLook=new THREE.Vector3(), headG={x:0,z:0}; let camInit=false, orbit=0;
// mouse look: drag (left or right button) to look around the car, wheel zooms the chase camera; eases back after letting go
const look={yaw:0,pitch:0,drag:false,lx:0,ly:0,rel:0,zoom:1};
{ const cv=renderer.domElement;
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{ if(look.drag||!(mode==='free'||mode==='race'||mode==='countdown')||paused) return; look.pid=e.pointerId; look.drag=true; look.lx=e.clientX; look.ly=e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove',e=>{ if(!look.drag||e.pointerId!==look.pid) return; const dx=e.clientX-look.lx, dy=e.clientY-look.ly; look.lx=e.clientX; look.ly=e.clientY;
    look.yaw=Math.max(-2.7,Math.min(2.7,look.yaw-dx*0.0045)); look.pitch=Math.max(-0.5,Math.min(0.9,look.pitch+dy*0.0035)); look.rel=performance.now(); });
  const up=e=>{ if(!look.drag||e.pointerId!==look.pid) return; look.drag=false; look.rel=performance.now(); try{ cv.releasePointerCapture(e.pointerId); }catch(_){} };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{ if(mode==='free'||mode==='race'){ look.zoom=Math.max(0.6,Math.min(2.2,look.zoom*(e.deltaY>0?1.1:0.9))); e.preventDefault(); } },{passive:false}); }
function easeLook(dt){ if(look.drag||performance.now()-look.rel<1500) return; const k=1-Math.exp(-dt*3); look.yaw-=look.yaw*k; look.pitch-=look.pitch*k; if(Math.abs(look.yaw)<1e-3) look.yaw=0; if(Math.abs(look.pitch)<1e-3) look.pitch=0; }
function parkShowcase(){ if(W.kind==='track'){ const g=gridPos(0); phys.reset(g.x,g.y,g.a); phys.hint=g.i; } else { phys.reset(3*CP+50,6*CP+31,0.25); } }
function updateCamera(dt){
  const c=phys; const ca=Math.cos(c.a), sa=Math.sin(c.a);
  if(window.__cam){ const d=window.__cam; camera.position.set(...d.p); camera.lookAt(...d.l); camera.fov=d.fov||55; camera.updateProjectionMatrix(); return; }
  if(mode==='menu'||mode==='lobby'){
    orbit+=dt*0.15; camera.fov=45;
    camera.position.set(c.x+Math.cos(orbit)*7.5, 2.0, c.y+Math.sin(orbit)*7.5); camera.lookAt(c.x,0.8,c.y); camera.updateProjectionMatrix(); camInit=false; return;
  }
  easeLook(dt); while(look.yaw>Math.PI) look.yaw-=2*Math.PI; while(look.yaw<-Math.PI) look.yaw+=2*Math.PI;
  const sh=shake; shake=Math.max(0,shake-dt*3);
  const rx=(Math.random()-.5)*sh*0.12, ry=(Math.random()-.5)*sh*0.12;
  if(camMode===0){
    const bk=(model.bike?0.62:1)*look.zoom, back=6.6*bk, up=(model.bike?1.65:2.2)*Math.sqrt(look.zoom);
    const va=c.speed>4?Math.atan2(c.vy,c.vx):c.a; let da=va-c.a; while(da>Math.PI) da-=2*Math.PI; while(da<-Math.PI) da+=2*Math.PI; const ha=c.a+da*0.35;
    // the camera keeps a fixed distance behind the car (it only lags in angle), so hard acceleration / nitro never pulls it back
    if(!camInit){ headG.x=ha; camPos.y=up+(model.gY||0); camInit=true; }
    let dh=ha-headG.x; while(dh>Math.PI) dh-=2*Math.PI; while(dh<-Math.PI) dh+=2*Math.PI; headG.x+=dh*(1-Math.exp(-dt*7));
    camPos.x=c.x-Math.cos(headG.x)*back; camPos.z=c.y-Math.sin(headG.x)*back; const gY=model.gY||0; camPos.y+=(up+gY-camPos.y)*(1-Math.exp(-dt*8)); if(W.phys&&W.phys.ground&&!inCityArea(c.x,c.y)){ const cy0=gY+1.0; let need=W.phys.ground(camPos.x,camPos.z)+0.7;
      for(const t of [0.35,0.55,0.75,0.9]){ const gx=c.x+(camPos.x-c.x)*t, gz=c.y+(camPos.z-c.y)*t, gh=W.phys.ground(gx,gz)+0.45; need=Math.max(need,cy0+(gh-cy0)/t); }
      if(camPos.y<need) camPos.y+=(need-camPos.y)*Math.min(1,dt*12+0.3); }
    const vib=(Math.random()-.5)*(c.rough||0)*2;
    let px=camPos.x, py=camPos.y, pz=camPos.z;
    if(look.yaw||look.pitch){ const dx=px-c.x, dz=pz-c.y, cy=Math.cos(-look.yaw), sy=Math.sin(-look.yaw), d=Math.hypot(dx,dz);
      const nx=dx*cy-dz*sy, nz=dx*sy+dz*cy, hor=Math.cos(look.pitch), f=hor; px=c.x+nx*f; pz=c.y+nz*f; py=py+Math.sin(look.pitch)*d; }
    camera.position.set(px+rx,py+ry+vib,pz);
    const lw=Math.min(1,(Math.abs(look.yaw)+Math.abs(look.pitch))*2.5);
    camLook.set(c.x+ca*2.5*(1-lw),(model.bike?0.85:0.9)+(model.gY||0),c.y+sa*2.5*(1-lw)); camera.lookAt(camLook);
    camera.rotateZ(model.bike?-model.leanG.rotation.x*0.25:-(c.ayPrev||0)*0.004);
    camera.fov=60+Math.min(10,c.speed*0.12);
  } else {
    const local = camMode===1 ? (model.cockpit||[-0.22,1.13,-0.38]) : (model.hood||[0.55,1.33,0]);
    headG.x+=((-(c.axPrev||0)*0.012)-headG.x)*Math.min(1,dt*6); headG.z+=(((c.ayPrev||0)*-0.01)-headG.z)*Math.min(1,dt*6);
    const vib=(Math.random()-.5)*(c.rough||0)*(camMode===1?1.2:0.6);
    const p=worldOf(model,local[0]+headG.x,local[1]+vib,local[2]+headG.z); camera.position.set(p.x+rx*0.3,p.y+ry*0.3,p.z);
    const cl=model.cockpitLook||[6,0.88,-0.38]; const lookP=camMode===1?worldOf(model,cl[0],cl[1],cl[2]+phys.steer*2.5):worldOf(model,8,1.0,0);
    camera.lookAt(lookP);
    if(look.yaw||look.pitch){ camera.rotateY(look.yaw); camera.rotateX(-look.pitch*0.8); }
    camera.fov=camMode===1?(70+Math.min(10,c.speed*0.12)):(66+Math.min(14,c.speed*0.18));
    if(model.bike) camera.rotateZ(-model.leanG.rotation.x*0.55);
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
    const M=W.map; miniZ+=((Math.max(0.42,0.95-phys.speed*0.013))-miniZ)*0.05; const s=miniZ; mctx.save(); mctx.clearRect(0,0,w,h);
    mctx.beginPath(); mctx.arc(w/2,h/2,Math.min(w,h)/2-2,0,7); mctx.clip();
    mctx.translate(w/2,h/2+18); mctx.rotate(-phys.a-Math.PI/2); mctx.scale(s,s); mctx.translate(-phys.x-M.offset,-phys.y-M.offset);
    mctx.drawImage(M.canvas,0,0,M.canvas.width/(M.k||1),M.canvas.height/(M.k||1));
    const dot=(x,y,c,r)=>{ mctx.fillStyle=c; mctx.beginPath(); mctx.arc(x+M.offset,y+M.offset,r/s,0,7); mctx.fill(); mctx.strokeStyle='#000'; mctx.lineWidth=1.5/s; mctx.stroke(); };
    if(waypoint){ const rp=routeFromPlayer(); const path=()=>{ mctx.beginPath(); rp.forEach((q,i)=>i?mctx.lineTo(q[0]+M.offset,q[1]+M.offset):mctx.moveTo(q[0]+M.offset,q[1]+M.offset)); };
      mctx.lineJoin='round'; mctx.lineCap='round'; path(); mctx.strokeStyle='rgba(30,10,60,.85)'; mctx.lineWidth=11/s; mctx.stroke(); path(); mctx.strokeStyle='#b388ff'; mctx.lineWidth=7/s; mctx.stroke(); }
    if(W.traffic) for(const t of W.traffic.all()) dot(t.x,t.y,'rgba(230,230,230,.8)',2);
    if(W.services) for(const sv of W.services) dot(sv.x,sv.y,SERVICE_STYLE[sv.kind].color,6);
    if(waypoint) dot(waypoint.x,waypoint.y,'#a78bfa',7);
    for(const r of remotes.values()) dot(r.x,r.y,r.color,5);
    mctx.restore();
    // player arrow
    mctx.save(); mctx.translate(w/2,h/2+18); mctx.fillStyle=settings.color; mctx.strokeStyle='#fff'; mctx.lineWidth=2; mctx.beginPath(); mctx.moveTo(0,-9); mctx.lineTo(6,7); mctx.lineTo(0,3); mctx.lineTo(-6,7); mctx.closePath(); mctx.fill(); mctx.stroke(); mctx.restore();
    mctx.strokeStyle='rgba(0,0,0,.6)'; mctx.lineWidth=4; mctx.beginPath(); mctx.arc(w/2,h/2,Math.min(w,h)/2-2,0,7); mctx.stroke();
    // service icons upright on the radar
    if(W.services){ mctx.font='12px sans-serif'; mctx.textAlign='center'; mctx.textBaseline='middle'; const ca=Math.cos(-phys.a-Math.PI/2), sa=Math.sin(-phys.a-Math.PI/2);
      for(const sv of [...W.services,...(waypoint?[{x:waypoint.x,y:waypoint.y,wp:1}]:[])]){ const dx=(sv.x-phys.x)*s, dy=(sv.y-phys.y)*s; let px=w/2+dx*ca-dy*sa, py=h/2+18+dx*sa+dy*ca; const R0=Math.min(w,h)/2-10, ddx=px-w/2, ddy=py-h/2, dd=Math.hypot(ddx,ddy); if(dd>R0){ px=w/2+ddx/dd*R0; py=h/2+ddy/dd*R0; }
        mctx.fillStyle=sv.wp?'#7c3aed':SERVICE_STYLE[sv.kind].color; mctx.beginPath(); mctx.arc(px,py,8,0,7); mctx.fill(); mctx.fillStyle='#fff'; mctx.fillText(sv.wp?'📍':SERVICE_STYLE[sv.kind].icon,px,py+0.5); } }
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
let miniZ=0.9; let frameNo=0, fps=0, fpsN=0, fpsT=performance.now(); const fpsHist=[]; let prT=0;
// ---- instrument cluster (canvas): rev counter arc, needle, speed, gear, nitro, damage ----
const gcv=$('gauge'), gdpr=Math.min(2,DPR); gcv.width=300*gdpr; gcv.height=220*gdpr; const gx=gcv.getContext('2d'); let gNeedle=0;
function drawCluster(){
  const g=gx; g.setTransform(gdpr,0,0,gdpr,0,0); g.clearRect(0,0,300,220);
  const cx=196, cy=116, R=90, MAXR=Math.ceil((SPEC.redline+300)/1000)*1000, red=SPEC.ev?1e9:SPEC.redline-600, BIG=MAXR>10000?2000:1000, STP=BIG/4, a0=Math.PI*0.75, a1=Math.PI*2.25, ang=r=>a0+(a1-a0)*Math.min(1,r/MAXR);
  gNeedle+=(phys.rpm-gNeedle)*0.45;
  // dial
  const bg=g.createRadialGradient(cx,cy,20,cx,cy,R+14); bg.addColorStop(0,'rgba(18,20,26,.86)'); bg.addColorStop(1,'rgba(6,7,10,.78)');
  g.fillStyle=bg; g.beginPath(); g.arc(cx,cy,R+14,0,Math.PI*2); g.fill(); g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1.5; g.stroke();
  g.lineCap='butt'; g.lineWidth=7; g.strokeStyle='rgba(255,255,255,.08)'; g.beginPath(); g.arc(cx,cy,R-4,a0,a1); g.stroke();
  g.strokeStyle='rgba(255,60,60,.55)'; g.beginPath(); g.arc(cx,cy,R-4,ang(red),a1); g.stroke();
  const lit=g.createLinearGradient(cx-R,0,cx+R,0); lit.addColorStop(0,'#3ad0ff'); lit.addColorStop(0.65,'#ffd32a'); lit.addColorStop(1,'#ff4757');
  g.strokeStyle=lit; g.beginPath(); g.arc(cx,cy,R-4,a0,ang(gNeedle)); g.stroke();
  for(let r=0;r<=MAXR;r+=STP){ const a=ang(r), big=r%BIG===0, mid=r%(BIG/2)===0; const r0=R-(big?18:mid?13:10), r1=R-9;
    g.strokeStyle=r>=red?'#ff5a5a':'rgba(255,255,255,'+(big?0.95:0.5)+')'; g.lineWidth=big?2.4:1.2; g.beginPath(); g.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0); g.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1); g.stroke();
    if(big){ g.fillStyle=r>=red?'#ff6b6b':'#e8ebef'; g.font='700 12px Inter,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(String(r/1000),cx+Math.cos(a)*(R-29),cy+Math.sin(a)*(R-29)); } }
  g.fillStyle='rgba(255,255,255,.45)'; g.font='600 8px Inter,sans-serif'; g.fillText(SPEC.ev?'motor x1000 d/dk':'x1000 d/dk',cx,cy+R+2);
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
  if(!SPEC.ev && phys.rpm>red-700){ g.fillStyle=phys.rpm>red-150&&frameNo%8<4?'#ff2a2a':'#ff8c1a'; g.beginPath(); g.arc(cx,cy-R+30,4,0,Math.PI*2); g.fill(); }
  // nitro + damage (left)
  const bx=12, by=150; g.textAlign='left'; g.textBaseline='alphabetic';
  // yarışta yakıt kullanılmaz (fuelUse=false): yakıt satırı gösterilmez, kutu kısalır (H7)
  const yk=phys.fuelUse; g.fillStyle='rgba(8,10,14,.72)'; g.beginPath(); g.roundRect(bx-6,yk?by-36:by-16,104,yk?82:62,10); g.fill();
  if(yk){ const f=phys.fuel??1, low=f<0.15; g.fillStyle='rgba(255,255,255,.6)'; g.font='700 9px Inter,sans-serif'; g.fillText(SPEC.ev?'ŞARJ':'YAKIT',bx,by-23);
    g.fillStyle=low?(frameNo%30<15?'#ff5a4a':'#ff9a8a'):'#e8ebef'; g.font='800 11px Inter,sans-serif'; g.textAlign='right'; g.fillText(Math.round(f*100)+'%',bx+90,by-22); g.textAlign='left';
    g.fillStyle='rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(bx,by-18,90,6,3); g.fill(); g.fillStyle=low?'#ff5a4a':SPEC.ev?'#4fb3ff':'#f5b83d'; g.beginPath(); g.roundRect(bx,by-18,Math.max(0.01,90*f),6,3); g.fill(); }
  g.fillStyle='rgba(255,255,255,.6)'; g.font='700 9px Inter,sans-serif'; g.fillText('NİTRO',bx,by-3);
  g.fillStyle='rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(bx,by+2,90,7,3.5); g.fill();
  const ng=g.createLinearGradient(bx,0,bx+90,0); ng.addColorStop(0,'#3a7bd5'); ng.addColorStop(1,'#66e0ff'); g.fillStyle=phys.nitroOn?'#a6f0ff':phys.nitroLock?'#5b6270':ng; g.beginPath(); g.roundRect(bx,by+2,Math.max(0.01,90*phys.nitro),7,3.5); g.fill();
  const dmg=Math.round(phys.damage); g.fillStyle='rgba(255,255,255,.6)'; g.fillText('HASAR',bx,by+25);
  g.fillStyle=dmg>60?'#ff6b5a':dmg>25?'#ffd32a':'#9ee6a8'; g.font='800 13px Inter,sans-serif'; g.textAlign='right'; g.fillText(dmg+'%',bx+90,by+26);
  g.fillStyle='rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(bx,by+31,90,4,2); g.fill(); g.fillStyle=dmg>60?'#ff6b5a':dmg>25?'#ffd32a':'#9ee6a8'; g.beginPath(); g.roundRect(bx,by+31,Math.max(0.01,0.9*dmg),4,2); g.fill();
}
function updateHud(){
  if(frameNo%6===0){ $('wallet').classList.toggle('hidden',mode!=='free'); setText('wallet','₺ '+Math.floor(SAVE.money).toLocaleString('tr-TR')); }
  if(mode!=='free'){ const st=standings(), pos=st.findIndex(x=>x.me)+1;
    setText('hLap',Math.min(me.lap+1,LAPS)+'/'+LAPS); setText('hPos',pos+'/'+st.length);
    setText('hTime',fmt(me.fin?me.ft:elapsed)); setText('hLast',fmt(lastLap)); setText('hBest',fmt(bestLap));
    setText('hCur',mode==='race'&&!me.fin?fmt(performance.now()-lapStart):'-:--.---'); }
  else if(frameNo%10===0){ { const pn=placeName(phys.x,phys.y); setText('stName',pn.name); setText('stDist',pn.area); } $('freeGo').classList.toggle('hidden',!(online&&remotes.size)); setText('freeInfo',(online?(remotes.size+1)+' oyuncu':'Tek başına')+' · '+(['Gündüz','Akşam','Gece'][['day','dusk','night'].indexOf(settings.time)])); }
  drawCluster();
  setText('hNet',fps+' FPS'+(online?(net.isHost?' · oda kurucusu':(net.ping!=null?' · '+net.ping+' ms':'')):'')+(phys.manual?' · manuel':'')+(phys.assists?'':' · yardımsız'));
  if(frameNo%2===0) renderMini();
}

// ================= save game · fuel · services · damage · map =================
function saveGame(){ if(mode==='free') SAVE.veh[settings.vehicle]={fuel:+(phys.fuel??1).toFixed(4),damage:+phys.damage.toFixed(1)}; store.set('tp8_save',JSON.stringify(SAVE)); }
setInterval(()=>{ if(mode==='free') saveGame(); },5000); addEventListener('beforeunload',saveGame);
function loadVehState(){ const v=SAVE.veh[settings.vehicle]||{}; phys.fuel=v.fuel??1; phys.damage=v.damage??0;
  if(phys.damage>8){ const k=Math.min(3,phys.damage/30); dentModel(model,(SPEC.hl||2.2)*0.95,-0.4,k,SPEC.hl||2.2,SPEC.hw||0.92); if(phys.damage>30) dentModel(model,-0.3,-(SPEC.hw||0.92),k*0.8,SPEC.hl||2.2,SPEC.hw||0.92); if(phys.damage>55) breakLamps(model,1,-0.5); }
  if(phys.damage>35) crackWindscreen(model,1+Math.floor((phys.damage-35)/20)); }
const PRICE={fuel:500,charge:180,repair:6,lamps:60,tow:100};   // full tank ₺, full battery ₺, ₺ per % damage, tow ₺
const money=v=>'₺'+Math.round(v).toLocaleString('tr-TR');
function onCrash(lx,lz,v){
  const st=Math.min(3,v/8); dentModel(model,lx,lz,st,SPEC.hl||2.2,SPEC.hw||0.92);
  if(v>9){ const n=breakLamps(model,lx,lz); if(n){ const w=worldOf(model,lx,0.7,lz); for(let k=0;k<10;k++) smoke.emit(w.x,w.y,w.z,(Math.random()-.5)*4+phys.vx*0.3,Math.random()*2,(Math.random()-.5)*4+phys.vy*0.3,{color:lx>0?[0.9,0.92,0.95]:[0.8,0.15,0.1],size:0.07,grow:0.2,life:0.6,alpha:0.9}); } }
  if(phys.damage>35) crackWindscreen(model,1+Math.floor((phys.damage-35)/20)); }
function drawServiceIcons(map,list){ const g=map.canvas.getContext('2d'); g.save(); g.setTransform(1,0,0,1,map.offset,map.offset);
  for(const s of list){ const st=SERVICE_STYLE[s.kind]; g.fillStyle=st.color; g.globalAlpha=0.35; g.fillRect(s.rect[0],s.rect[1],s.rect[2]-s.rect[0],s.rect[3]-s.rect[1]); g.globalAlpha=1; } g.restore(); }
function inRect(s){ const r=s.rect; if(!r) return false; return phys.x>r[0]&&phys.x<r[2]&&phys.y>r[1]&&phys.y<r[3]; }
let svcBusy=null, odoAcc=0, fuelWarn=0, driftT=0, driftPay=0, driftGap=0;
function currentService(){ if(W.kind!=='city'||!W.services) return null; return W.services.find(inRect)||null; }
function serviceAction(){ const s=currentService(); if(!s||mode!=='free') return;
  if(phys.speed>1.5){ toast('Önce dur',1200); return; }
  if(s.kind==='repair'){ const cost=Math.ceil(phys.damage*PRICE.repair)+((model.lampsBroken||0)>0?PRICE.lamps:0); if(phys.damage<0.5&&!(model.lampsBroken>0)){ toast('Araçta hasar yok 👍',1500); return; }
    let pay=cost, ins=false; if(SAVE.money<cost){ pay=Math.max(0,Math.floor(SAVE.money)); ins=true; } svcBusy={kind:'repair',t:0,dur:1.5,cost:pay,ins}; }
  else { const ev=!!SPEC.ev; if((s.kind==='charge')!==ev){ toast(ev?'Bu araç elektrikli: ⚡ şarj noktasına git':'Bu araç benzinli: ⛽ pompaya git',2200); return; }
    if((phys.fuel??1)>0.995){ toast(ev?'Batarya dolu':'Depo dolu',1200); return; } svcBusy={kind:s.kind,t:0}; } }
function callTow(){ if(mode!=='free'||W.kind!=='city') return; const ev=!!SPEC.ev; if((phys.fuel??1)>0.02&&phys.damage<90){ toast('Çekici sadece yakıt bitince ya da araç ağır hasarlıyken gelir',2000); return; }
  const want=(phys.fuel??1)<=0.02?(ev?'charge':'fuel'):'repair'; const s=W.services.filter(v=>v.kind===want).sort((a,b)=>Math.hypot(a.x-phys.x,a.y-phys.y)-Math.hypot(b.x-phys.x,b.y-phys.y))[0]; if(!s) return;
  const cost=Math.min(PRICE.tow,SAVE.money); SAVE.money-=cost; phys.reset(s.x,s.y,s.a??-Math.PI/2); loadVehStateKeep(); if((phys.fuel??1)<0.1) phys.fuel=0.1;
  toast('🚚 Çekici seni '+s.name+' noktasına getirdi'+(cost?' ('+money(cost)+')':''),3000); saveGame(); }
let keepState=null; function loadVehStateKeep(){ if(keepState){ phys.fuel=keepState.fuel; phys.damage=keepState.damage; } }
function freeRoamTick(dt){
  // odometer: driving earns money
  const d=phys.speed*dt; SAVE.km+=d/1000; if(phys.speed>4){ odoAcc+=d*(phys.speed>25?2:1); while(odoAcc>=100){ odoAcc-=100; SAVE.money+=25; } }
  // drift money: sliding sideways at speed on tarmac pays per second, banked when the slide ends
  const sliding=phys.speed>8&&Math.abs(phys.vLat||0)>2.5&&phys.surfR===0&&phys.surfF===0;
  if(sliding){ driftT+=dt; driftPay+=dt*(20+Math.abs(phys.vLat)*4); driftGap=0; }
  else if(driftPay>0){ driftGap+=dt; if(driftGap>0.7){ const p=Math.round(driftPay*(driftT>4?1.5:1)); if(p>=10){ SAVE.money+=p; toast('🔥 Drift '+driftT.toFixed(1)+' sn · +'+money(p),1800); } driftPay=0; driftT=0; } }
  keepState={fuel:phys.fuel,damage:phys.damage};
  const s=currentService(), P=$('svcPrompt');
  if(svcBusy){ if(!s||phys.speed>1.5){ svcBusy=null; } else if(svcBusy.kind==='repair'){ svcBusy.t+=dt; if(svcBusy.t>=svcBusy.dur){ SAVE.money-=svcBusy.cost; repairModel(model); phys.damage=0; toast(svcBusy.ins?'🔧 Araç tamir edildi · paranın yetmeyen kısmını sigorta karşıladı ('+money(svcBusy.cost)+')':'🔧 Araç tamir edildi ('+money(svcBusy.cost)+')',3000); svcBusy=null; saveGame(); } }
    else { const ev=svcBusy.kind==='charge', rate=ev?0.08:0.2, price=ev?PRICE.charge:PRICE.fuel; const add=Math.min(rate*dt,1-phys.fuel), cost=add*price;
      if(SAVE.money<cost){ toast('Para bitti',1500); svcBusy=null; } else { phys.fuel+=add; SAVE.money-=cost; svcBusy.spent=(svcBusy.spent||0)+cost; if(phys.fuel>=0.999){ phys.fuel=1; toast((ev?'⚡ Şarj tamam':'⛽ Depo doldu')+' ('+money(svcBusy.spent)+')',2500); svcBusy=null; saveGame(); } } } }
  if(s){ P.classList.remove('hidden'); const st=SERVICE_STYLE[s.kind]; let html=`<div>${st.icon} <b>${s.name}</b></div>`;
    if(svcBusy){ const pr=svcBusy.kind==='repair'?svcBusy.t/svcBusy.dur:phys.fuel; html+=`<div>${svcBusy.kind==='repair'?'Tamir ediliyor…':svcBusy.kind==='charge'?'Şarj oluyor… '+Math.round(phys.fuel*100)+'%':'Yakıt dolduruluyor… '+Math.round(phys.fuel*100)+'%'}</div><div class="bar"><i style="width:${Math.round(pr*100)}%"></i></div>`; }
    else if(s.kind==='repair'){ const cost=Math.ceil(phys.damage*PRICE.repair)+((model.lampsBroken||0)>0?PRICE.lamps:0); html+=phys.damage<0.5&&!(model.lampsBroken>0)?'<div>Araçta hasar yok</div>':`<div>Hasar %${Math.round(phys.damage)} · Tamir: <b>${money(cost)}</b>${SAVE.money<cost?' · <span style="color:#9ee6a8">eksiğini sigorta öder</span>':''}</div><button class="sec" id="svcGo">🔧 Tamir et (F)</button>`; }
    else { const ev=!!SPEC.ev, ok=(s.kind==='charge')===ev; const need=(1-(phys.fuel??1))*(ev?PRICE.charge:PRICE.fuel);
      html+=ok&&(phys.fuel??1)>0.995?`<div>${ev?'Batarya dolu ✓':'Depo dolu ✓'}</div>`:ok?`<div>${ev?'Batarya':'Depo'} %${Math.round((phys.fuel??1)*100)} · Doldurmak: <b>${money(need)}</b></div><button class="sec" id="svcGo">${ev?'⚡ Şarj et':'⛽ Yakıt al'} (F)</button>`:`<div>${ev?'Bu araç elektrikli — ⚡ şarj noktasına git':'Bu araç benzinli — ⛽ pompaya git'}</div>`; }
    if(phys.speed>1.5&&!svcBusy) html+='<div style="opacity:.7;font-size:12px;margin-top:4px">Durunca işlem yapabilirsin</div>';
    if(P._h!==html){ P.innerHTML=html; P._h=html; const b=$('svcGo'); if(b) b.onclick=e=>{ e.currentTarget.blur(); serviceAction(); }; } }
  else if(!P.classList.contains('hidden')){ P.classList.add('hidden'); P._h=''; }
  // low fuel / empty
  const f=phys.fuel??1; fuelWarn-=dt;
  if(f<=0 && fuelWarn<=0){ fuelWarn=6; toast((SPEC.ev?'🔋 Batarya bitti':'⛽ Yakıt bitti')+' · Çekici için G (₺'+PRICE.tow+') · Harita M',4500); }
  else if(f>0&&f<0.12 && fuelWarn<=0){ fuelWarn=30; toast((SPEC.ev?'🔋 Şarj azaldı':'⛽ Yakıt azaldı')+' · En yakın '+(SPEC.ev?'şarj':'benzinlik')+' için M',3500); }
  // waypoint arrival
  if(waypoint){ const dd=Math.hypot(waypoint.x-phys.x,waypoint.y-phys.y); routeFromPlayer(); const rl=Math.max(dd,waypoint.len||dd); if(frameNo%10===0) setText('wpInfo','📍 '+waypoint.name+' · '+(rl>1000?(rl/1000).toFixed(1)+' km':Math.round(rl)+' m'));
    if(dd<14){ toast('📍 Hedefe ulaştın: '+waypoint.name,2500); setWaypoint(null); } }
  $('wpInfo').classList.toggle('hidden',!waypoint);
  if(wpMarker){ wpMarker.visible=!!waypoint; if(waypoint){ wpMarker.position.set(waypoint.x,W.phys&&W.phys.ground?W.phys.ground(waypoint.x,waypoint.y):0,waypoint.y); wpMarker.children[1].position.y=6+Math.sin(performance.now()/300)*0.6; } }
}
// ---- waypoint & route on the road grid ----
let waypoint=null, wpMarker=null;
function routeTo(x0,y0,x1,y1){ const R=v=>Math.round(v/CP)*CP; const onH=Math.abs(y0-R(y0))<Math.abs(x0-R(x0));
  const A=onH?[R(x0),R(y0)]:[R(x0),R(y0)]; const tl=nearestLane(x1,y1); const tH=Math.abs(tl.y-R(tl.y))<Math.abs(tl.x-R(tl.x)); const T=tH?[tl.x,R(tl.y)]:[R(tl.x),tl.y]; const B=[R(T[0]),R(T[1])];
  const C=[B[0],A[1]]; return [[x0,y0],A,C,B,T,[x1,y1]]; }
function routePts(x0,y0,x1,y1){ try{ return findRoute(x0,y0,x1,y1); }catch(e){ console.warn(e); return [[x0,y0],[x1,y1]]; } }
// GPS route from the car: recomputed twice a second (and right away when a destination is set); the first point always follows the car
function routeFromPlayer(){ if(!waypoint) return []; const now=performance.now();
  if(!waypoint.route||now-(waypoint.rt||0)>500){ waypoint.route=routePts(phys.x,phys.y,waypoint.x,waypoint.y); waypoint.rt=now; waypoint.len=routeLength(waypoint.route); }
  waypoint.route[0]=[phys.x,phys.y]; return waypoint.route; }
function setWaypoint(t){ waypoint=t?{...t,route:null}:null; if(waypoint) routeFromPlayer(); if(t&&!wpMarker){ wpMarker=new THREE.Group();
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,70,24,1,true),new THREE.MeshBasicMaterial({color:0xa78bfa,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})); beam.position.y=35; wpMarker.add(beam);
    const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d'); g.fillStyle='#7c3aed'; g.beginPath(); g.arc(64,64,58,0,7); g.fill(); g.font='72px sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('📍',64,70);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,toneMapped:false})); sp.scale.set(3,3,1); wpMarker.add(sp); scene.add(wpMarker); }
  if(t) toast('📍 Rota: '+t.name,1800); }
// ---- full-screen map (M) ----
let bigMapOpen=false, bmOpenT=0, bmDown=false; const bmC=$('bigMapC'), bmG=bmC.getContext('2d'); let bmView=null;
function toggleBigMap(on=!bigMapOpen){ if(on&&(W.kind!=='city'||!(mode==='free'))){ toast('Harita serbest sürüşte açılır',1500); return; }
  bigMapOpen=on; $('bigMap').classList.toggle('hidden',!on); if(on){ bmOpenT=performance.now(); bmDown=false; bmZ.cx=phys.x; bmZ.cy=phys.y; bmZ.z=inCityArea(phys.x,phys.y)?2.6:2.0; buildBmList(); drawBigMap(); } }
function buildBmList(){ const box=$('bmList'); box.innerHTML=''; const items=[...W.services].sort((a,b)=>Math.hypot(a.x-phys.x,a.y-phys.y)-Math.hypot(b.x-phys.x,b.y-phys.y));
  for(const s of items){ const st=SERVICE_STYLE[s.kind]; const d=Math.hypot(s.x-phys.x,s.y-phys.y); const el=document.createElement('div'); el.className='item'+(waypoint&&waypoint.name===s.name?' on':'');
    el.innerHTML=`<span class="ic">${st.icon}</span><span>${s.name}<small>${st.label} · ${d>1000?(d/1000).toFixed(1)+' km':Math.round(d)+' m'}</small></span>`; el.onclick=()=>{ setWaypoint({x:s.x,y:s.y,name:s.name}); bmZ.cx=(s.x+phys.x)/2; bmZ.cy=(s.y+phys.y)/2; buildBmList(); drawBigMap(); }; box.appendChild(el); } }
const bmZ={z:2.6,cx:null,cy:null};
function drawBigMap(){ if(!bigMapOpen) return; const r=bmC.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1); if(bmC.width!==Math.round(r.width*dpr)||bmC.height!==Math.round(r.height*dpr)){ bmC.width=r.width*dpr; bmC.height=r.height*dpr; } const M=W.map, S=M.canvas.width/(M.k||1);
  if(bmZ.cx==null){ bmZ.cx=phys.x; bmZ.cy=phys.y; }
  const sc=Math.min(bmC.width,bmC.height)/S*bmZ.z, ox=bmC.width/2-(bmZ.cx+M.offset)*sc, oy=bmC.height/2-(bmZ.cy+M.offset)*sc; bmView={sc,ox,oy,dpr,off:M.offset};
  const g=bmG; g.fillStyle='#1f4f66'; g.fillRect(0,0,bmC.width,bmC.height); g.imageSmoothingEnabled=true; g.drawImage(M.canvas,ox,oy,S*sc,S*sc);
  const P=(x,y)=>[ox+(x+M.offset)*sc,oy+(y+M.offset)*sc];
  if(waypoint){ g.strokeStyle='#a78bfa'; g.lineWidth=6*dpr; g.lineJoin='round'; g.lineCap='round'; const rp=routeFromPlayer(); const path=()=>{ g.beginPath(); rp.forEach((q,i)=>{ const p=P(q[0],q[1]); i?g.lineTo(...p):g.moveTo(...p); }); }; path(); g.strokeStyle='rgba(30,10,60,.85)'; g.lineWidth=10*dpr; g.stroke(); path(); g.strokeStyle='#b388ff'; g.lineWidth=6*dpr; g.stroke(); }
  g.textAlign='center'; g.textBaseline='middle';
  for(const s of W.services){ const st=SERVICE_STYLE[s.kind], [px,py]=P(s.x,s.y); g.fillStyle=st.color; g.beginPath(); g.arc(px,py,14*dpr,0,7); g.fill(); g.strokeStyle='#fff'; g.lineWidth=2*dpr; g.stroke(); g.font=(16*dpr)+'px sans-serif'; g.fillStyle='#fff'; g.fillText(st.icon,px,py+dpr); }
  if(waypoint){ const [px,py]=P(waypoint.x,waypoint.y); g.font=(26*dpr)+'px sans-serif'; g.fillText('📍',px,py-14*dpr); }
  for(const rm of remotes.values()){ const [px,py]=P(rm.x,rm.y); g.fillStyle="#22d3ee"; g.beginPath(); g.arc(px,py,7*dpr,0,7); g.fill(); g.strokeStyle='#fff'; g.stroke(); }
  { const [px,py]=P(phys.x,phys.y); g.save(); g.translate(px,py); g.rotate(phys.a+Math.PI/2); g.fillStyle=settings.color; g.strokeStyle='#fff'; g.lineWidth=2*dpr; g.beginPath(); g.moveTo(0,-12*dpr); g.lineTo(8*dpr,9*dpr); g.lineTo(0,4*dpr); g.lineTo(-8*dpr,9*dpr); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  g.fillStyle='rgba(255,255,255,.85)'; g.font='700 '+(13*dpr)+'px Inter,sans-serif'; g.textAlign='left'; g.fillText('Sen: '+placeName(phys.x,phys.y).name+' · '+money(SAVE.money),12*dpr,20*dpr); }
setInterval(()=>{ if(bigMapOpen) drawBigMap(); },250);
{ let drag=null, pins=new Map();
  bmC.addEventListener('pointerdown',e=>{ bmDown=true; pins.set(e.pointerId,{x:e.clientX,y:e.clientY}); drag={x:e.clientX,y:e.clientY,moved:0}; try{ bmC.setPointerCapture(e.pointerId); }catch(_){} });
  bmC.addEventListener('pointermove',e=>{ if(!drag||!bmView) return; const p=pins.get(e.pointerId); if(!p) return;
    if(pins.size===2){ const [a,b]=[...pins.values()]; const d0=Math.hypot(a.x-b.x,a.y-b.y); p.x=e.clientX; p.y=e.clientY; const [c,d]=[...pins.values()]; const d1=Math.hypot(c.x-d.x,c.y-d.y); if(d0>10){ bmZ.z=Math.max(0.8,Math.min(14,bmZ.z*d1/d0)); drag.moved=99; drawBigMap(); } return; }
    const dx=e.clientX-p.x, dy=e.clientY-p.y; p.x=e.clientX; p.y=e.clientY; drag.moved+=Math.abs(dx)+Math.abs(dy); bmZ.cx-=dx*bmView.dpr/bmView.sc; bmZ.cy-=dy*bmView.dpr/bmView.sc; drawBigMap(); });
  const up=e=>{ pins.delete(e.pointerId); }; bmC.addEventListener('pointerup',up); bmC.addEventListener('pointercancel',up);
  bmC.addEventListener('wheel',e=>{ e.preventDefault(); if(!bmView) return; const r=bmC.getBoundingClientRect(); const cx=(e.clientX-r.left)*bmView.dpr, cy=(e.clientY-r.top)*bmView.dpr;
    const wx=(cx-bmView.ox)/bmView.sc-bmView.off, wy=(cy-bmView.oy)/bmView.sc-bmView.off; const k=Math.exp(-e.deltaY*0.0015); bmZ.z=Math.max(0.8,Math.min(14,bmZ.z*k));
    bmZ.cx=wx-(wx-bmZ.cx)/k; bmZ.cy=wy-(wy-bmZ.cy)/k; drawBigMap(); },{passive:false});
  bmC.addEventListener('click',e=>{ const dn=bmDown; bmDown=false; if(!dn||!bmView||performance.now()-bmOpenT<300) return; if(drag&&drag.moved>8) return; const r=bmC.getBoundingClientRect(); const cx=(e.clientX-r.left)*bmView.dpr, cy=(e.clientY-r.top)*bmView.dpr;
  const wx=(cx-bmView.ox)/bmView.sc-bmView.off, wy=(cy-bmView.oy)/bmView.sc-bmView.off;
  let best=null, bd=22*bmView.dpr/bmView.sc; for(const s of W.services){ const d=Math.hypot(s.x-wx,s.y-wy); if(d<bd){ bd=d; best=s; } }
  if(best) setWaypoint({x:best.x,y:best.y,name:best.name}); else if(inCityArea(wx,wy)){ const l=nearestLane(wx,wy); setWaypoint({x:l.x,y:l.y,name:streetName(l.x,l.y)}); } else { const pn=placeName(wx,wy).name; setWaypoint({x:wx,y:wy,name:pn==='Kırsal alan'?'İşaretli nokta':pn}); }
  buildBmList(); drawBigMap(); }); }
$('bmClose').onclick=()=>toggleBigMap(false); $('bmClear').onclick=()=>{ setWaypoint(null); buildBmList(); drawBigMap(); };

// traffic horns: positional volume, a different pitch per car, short double toots for impatience
const hornsOn=new Set();
// crash effects on bot cars: debris + sparks at the contact point, smoke from the bonnet after a hard hit
function trafficFx(dt){ if(!W||!W.traffic) return; for(const c of W.traffic.all()){
    if(c.fx){ const f=c.fx; c.fx=null; const n=Math.min(26,6+f.v*1.6);
      for(let k=0;k<n;k++) smoke.emit(f.x,0.6+Math.random()*0.5,f.y,(Math.random()-.5)*5,Math.random()*2.5,(Math.random()-.5)*5,k%3?{color:[0.85,0.88,0.9],size:0.06,grow:0.1,life:0.7,alpha:0.95}:{color:[0.2,0.2,0.22],size:0.08,grow:0.15,life:0.9,alpha:0.9});
      // ses mesafeyle azalır (çok oyunculuda şehrin öbür ucundaki kaza kulağının dibinde duyulmasın; 30 m içinde tam)
      const dd=Math.hypot(f.x-camera.position.x,f.y-camera.position.z), dk=Math.min(1,Math.max(0,1-(dd-30)/120));
      if(f.v>3 && dk>0) audio.crash&&audio.crash(Math.min(1,f.v/14)*dk); }
    if(c.smoke>0 && Math.random()<dt*14*Math.min(1,c.smoke)){ const ca=Math.cos(c.a), sa=Math.sin(c.a); smoke.emit(c.x+ca*1.6,1.0,c.y+sa*1.6,(Math.random()-.5)*0.4,1.1+Math.random()*0.6,(Math.random()-.5)*0.4,{color:[0.55,0.55,0.57],size:0.5,grow:1.6,life:2.4,alpha:0.45}); } } }
function trafficHorns(){ const seen=new Set(); if(W&&W.traffic&&!paused&&!audio.muted) for(const c of W.traffic.cars){ if(!(c.honk>0)) continue; const d=Math.hypot(c.x-camera.position.x,c.y-camera.position.z); if(d>140) continue;
    const on=!(c.honk>0.4&&c.honk<0.55); const id='t'+c.id; if(on){ seen.add(id); audio.horn(id,true,Math.min(1,(1-d/140)*1.1),0.82+((c.id*37)%9)/24); } }
  for(const id of hornsOn) if(!seen.has(id)) audio.horn(id,false); hornsOn.clear(); for(const id of seen) hornsOn.add(id); }
// ---------------- main loop ----------------
const STEP=1/120; let interp=null; const pPrev={x:0,y:0,a:0}; let acc=0, last=performance.now(), trafAcc=0, trafSend=0, lampT=0;
addEventListener('resize',()=>{ renderer.setSize(innerWidth,innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); if(composer){ composer.setSize(innerWidth,innerHeight); } });
useWorld(settings.map); applyWeather(settings.weather); parkShowcase(); updateMenuLabels();

function frame(t){
  requestAnimationFrame(frame);
  const fdt=Math.min(0.1,Math.max(0,(t-last)/1000)); last=t; frameNo++;
  fpsN++; if(t-fpsT>1000){ fps=Math.round(fpsN*1000/(t-fpsT)); fpsN=0; fpsT=t;
    // keep it smooth: lower the render resolution when the GPU struggles, raise it again when there is headroom
    if(document.visibilityState==='visible' && document.hasFocus() && fps>14 && t-lastModeT>3000){ fpsHist.push(fps); if(fpsHist.length>4) fpsHist.shift();
      const avg=fpsHist.reduce((s,v)=>s+v,0)/fpsHist.length; let pr=curPR;
      if(fpsHist.length>=2 && avg<48 && t-prT>2500){ if(curPR>BASE_PR*0.55+1e-3) pr=Math.max(BASE_PR*0.55,curPR-0.15); else if(composer){ composerBirak(); prT=t; fpsHist.length=0; toast('Akıcılık için efektler kapatıldı',1800); } } else if(fpsHist.length>=4 && avg>58 && curPR<BASE_PR && t-prT>8000) pr=Math.min(BASE_PR,curPR+0.1);
      if(pr!==curPR){ curPR=pr; prT=t; fpsHist.length=0; renderer.setPixelRatio(curPR); if(composer) composer.setPixelRatio(curPR); } } else fpsHist.length=0; }
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
    if(sim){ trafAcc+=fdt; let n=0; while(trafAcc>=1/30 && n<4){ W.traffic.step(1/30,players); trafAcc-=1/30; n++; } if(n>=4) trafAcc=0; W.traffic.remote=null; W.traffic.ahead=trafAcc; } else W.traffic.ahead=0;
    if(online && net.isHost){ trafSend+=fdt; if(trafSend>0.1){ trafSend=0; net.sendAll({t:'x',k:'tr',d:W.traffic.pack(),ht:Date.now()}); } }
    fleet.cam.copy(camera.position); if(camMode===1&&mode!=='menu'&&mode!=='lobby') fleet.camDir.set(0,0,0); else camera.getWorldDirection(fleet.camDir); W.traffic.render(fdt); fleet.commit(); trafficHorns(); trafficFx(fdt);
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
    if(interp && phys.x===interp.ix && phys.y===interp.iy && phys.a===interp.ia){ phys.x=interp.x; phys.y=interp.y; phys.a=interp.a; } interp=null;
    while(acc>=STEP){
      const hx=phys.x,hy=phys.y,ha=phys.a; pPrev.x=hx; pPrev.y=hy; pPrev.a=ha;
      phys.step(STEP,drive,others);
      if(mode==='countdown'){ phys.x=hx; phys.y=hy; phys.a=ha; phys.vx=phys.vy=phys.yawRate=0; }
      if(phys.impact>4){ dentCar(model,phys.impactAt.lx,phys.impactAt.lz,Math.min(3,phys.impact/8)); onCrash(phys.impactAt.lx,phys.impactAt.lz,phys.impact); audio.impact(phys.impact); shake=Math.min(1.5,shake+phys.impact*0.06); phys.impact=0; } else phys.impact=0;
      acc-=STEP;
    }
    // misafir: trafiği host simüle eder → çarptığın araçların darbesini host'a gönder (H1)
    if(online && !net.isHost && W.kind==='city'){ const h=W.traffic.takeHits(); if(h.length) net.sendHost({k:'hit',h}); }
    if(mode==='race') lapLogic();
    { const al=Math.min(1,acc/STEP), da=phys.a-pPrev.a; if(Math.abs(da)<1 && Math.abs(phys.x-pPrev.x)+Math.abs(phys.y-pPrev.y)<3){ const ix=pPrev.x+(phys.x-pPrev.x)*al, iy=pPrev.y+(phys.y-pPrev.y)*al, ia=pPrev.a+da*al;
        interp={x:phys.x,y:phys.y,a:phys.a,ix,iy,ia}; phys.x=ix; phys.y=iy; phys.a=ia; } }
    horn=!!inp.horn; audio.horn('me',horn,1);
    if(online) net.set({x:+phys.x.toFixed(2),y:+phys.y.toFixed(2),a:+phys.a.toFixed(3),v:+phys.vLong.toFixed(2),sr:+phys.steer.toFixed(3),bk:phys.brake>0.1||phys.hand>0,nt:phys.nitroOn,hn:horn,hl:headlightsOn,lap:me.lap,cp:me.cp,idx:me.idx,fin:me.fin,ft:Math.round(me.ft),best:Math.round(bestLap)});
    if(phys.kerb||phys.surfF===2) shake=Math.max(shake,Math.min(0.35,phys.speed*0.01));
    carEffects(fdt); if(mode==="free") freeRoamTick(fdt); if(frameNo%6===0) touchHudTick();
  } else if(paused){ acc=0; }
  lastFdt=fdt; if(model.bike){ const parked=!driving||phys.speed<0.3&&phys.throttle===0; model.leanT=parked&&!driving?-0.13:Math.max(-0.95,Math.min(0.95,Math.atan(phys.vLong*phys.yawRate/9.81))); model.rider.visible=driving&&camMode!==1; if(model.stand) model.stand.visible=!driving; }
  placeCar(model,phys.x,phys.y,phys.a,phys.pitch,phys.rollA,phys.steer,phys.wheelAng,(phys.brake>0.1&&!phys.burnout)||phys.hand>0,phys.nitroOn,phys.bump*0.25,headlightsOn,groundUnder(phys),phys.reversing&&phys.speed>0.05||phys.reversing&&phys.throttle>0,true);
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
    if(r.model.bike) r.model.leanT=Math.max(-0.95,Math.min(0.95,Math.atan(r.v*r.v*Math.tan(r.steer)/(1.469*9.81))));
    placeCar(r.model,r.x,r.y,r.a,0,0,r.steer,[r.wheel,r.wheel,r.wheel,r.wheel],r.bk,r.nt,0,r.hl,W.phys&&W.phys.ground?{f:W.phys.ground(r.x+Math.cos(r.a)*1.3,r.y+Math.sin(r.a)*1.3),r:W.phys.ground(r.x-Math.cos(r.a)*1.3,r.y-Math.sin(r.a)*1.3)}:null,r.v<-0.3);
    const dist=Math.hypot(r.x-phys.x,r.y-phys.y); audio.horn(id,r.hn&&dist<150,Math.max(0.05,1-dist/150));
  }
  { const gy=model.gY||0; sun.position.set(phys.x+sunDir.x*200, sunDir.y*200+gy, phys.y+sunDir.z*200); sun.target.position.set(phys.x,gy,phys.y); }
  audio.update(phys,fdt,driving&&!paused&&(phys.fuel>0||SPEC.ev));
  updateCamera(fdt);
  updateBackfire(fdt); smoke.update(fdt,renderer.domElement.height); skids.update(); updateRain(fdt); if(frameNo%2===0) updateStreaks();
  if(model.shiftMat) model.shiftMat.emissiveIntensity=driving&&phys.rpm>6200?(phys.rpm>7300&&frameNo%6<3?0.3:4):0;
  if(driving && camMode===1 && frameNo%3===0){ if(model.drawDash) model.drawDash(phys.rpm,phys.kmh,phys.gearLabel(),phys.nitro); else drawGauges(model,phys.rpm,phys.kmh,phys.gearLabel(),phys.nitro); }
  if(driving) updateHud();
  for(const mp of mirrorPlanes) mp.visible=driving&&camMode===1;
  drawDrops(fdt,driving&&camMode!==0&&wet&&!paused);
  // render
  if(W&&W.kind==='city'&&frameNo%12===0) runCull();
  renderer.setScissorTest(false); renderer.setViewport(0,0,innerWidth,innerHeight);
  if(composer) composer.render(); else renderer.render(scene,camera);
  if(driving) updateReflections();
  if(driving && camMode===1){
    {
      const ca=Math.cos(phys.a), sa=Math.sin(phys.a), gy=model.root.position.y; const mh=(model.mirror&&model.mirror[1])||1.1; const p=new THREE.Vector3(phys.x+ca*0.45,gy+mh,phys.y+sa*0.45), back=new THREE.Vector3(phys.x-ca*20,gy+mh-0.15,phys.y-sa*20);   // steady: ignores body pitch so braking/accelerating doesn't tip the view into the sky
      mirrorCam.position.copy(p); mirrorCam.lookAt(back); 
      const au=renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate=false; model.root.visible=false; rain.m.visible=false;
      renderer.setRenderTarget(mirrorRT); renderer.render(scene,mirrorCam); renderer.setRenderTarget(null);
      model.root.visible=true; rain.m.visible=wet; renderer.shadowMap.autoUpdate=au;
    }
    if(!mirrorPlane && !model.bike){ const w=Math.round(innerWidth*0.26), h=Math.round(w/3.4), x=Math.round((innerWidth-w)/2), y=innerHeight-h-Math.round(innerHeight*0.035);
      renderer.setScissorTest(true); renderer.setScissor(x,y,w,h); renderer.setViewport(x,y,w,h); renderer.render(mirScene,mirOrtho);
      renderer.setScissorTest(false); renderer.setViewport(0,0,innerWidth,innerHeight);
      $('mirrorFrame').style.cssText=`display:block;left:${x-4}px;top:${innerHeight-y-h-4}px;width:${w+8}px;height:${h+8}px`; }
  } else $('mirrorFrame').style.display='none';
}
requestAnimationFrame(frame);
// test hook
const BOT=new URLSearchParams(location.search).has('bot');
// ---- çalışma anı sağlamlığı (Aşama 5) ----
// WebGL bağlamı kaybı (sürücü sıfırlandı, GPU belleği doldu, sekme uzun süre arka planda kaldı): önce kaydet.
// three.js özel hedefleri (yansıma, ayna, ortam haritası) kendiliğinden geri kuramaz → bağlam dönünce sayfayı
// yeniden yükle; dönmezse oyuncuya "Yeniden yükle" düğmesi göster.
let baglamKayip=false;
renderer.domElement.addEventListener('webglcontextlost',e=>{ e.preventDefault(); if(baglamKayip) return; baglamKayip=true;
  try{ if(mode==='free') saveGame(); }catch(_){} try{ audio.ctx&&audio.ctx.suspend(); }catch(_){}
  $('glLost').classList.remove('hidden'); },false);
renderer.domElement.addEventListener('webglcontextrestored',()=>{ $('glLostMsg').textContent='Grafik geri geldi, oyun yeniden yükleniyor…'; setTimeout(()=>location.reload(),300); },false);
$('glLostBtn').onclick=()=>location.reload();
// Sekme gizlenince: ses askıya alınır (arka planda motor sesi çalmasın); tek oyunculuda sürüş/yarış duraklatılır.
// Çok oyunculuda duraklatma herkesi durdurduğu için otomatik duraklatılmaz.
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){ try{ audio.ctx&&audio.ctx.state==='running'&&audio.ctx.suspend(); }catch(_){}
    if(!online && (mode==='free'||mode==='race') && !paused) setPause(true); }
  else if(!baglamKayip){ try{ audio.ctx&&audio.ctx.state==='suspended'&&audio.ctx.resume(); }catch(_){} } });
// Açılıştan sonra yakalanmayan hata: oyun çoğu zaman devam edebilir; oyuncuya sessizce kaybolmak yerine küçük bir
// bildirim ve "Kaydet ve yenile" seçeneği göster (10 sn'de en fazla bir kez; tarayıcı eklentilerinin hataları sayılmaz).
let hataT=0;
function hataGoster(msg,kaynak){ if(kaynak && !String(kaynak).startsWith(location.origin)) return; const t=performance.now(); if(t-hataT<10000) return; hataT=t;
  $('errMsg').textContent=String(msg||'bilinmeyen hata').slice(0,140); $('errBar').classList.remove('hidden'); }
addEventListener('error',e=>{ if(window.__game) hataGoster(e.message,e.filename); });
addEventListener('unhandledrejection',e=>{ if(window.__game){ const r=e.reason; hataGoster(r&&r.message||r); } });
$('errReload').onclick=()=>{ try{ if(mode==='free') saveGame(); }catch(_){} location.reload(); };
$('errClose').onclick=()=>$('errBar').classList.add('hidden');
window.__game={THREE,showResults,camera,GPU,get pr(){return curPR;},quality:ULTRA?'ultra':settings.quality,get composer(){return composer;},composerBirak,phys,me,get mode(){return mode;},get world(){return W;},startFree,remotes,renderer,scene,SAVE,toggleBigMap,setWaypoint,serviceAction,onCrash,get model(){return model;},REGDBG,freeRoamTick,callTow,respawn,currentService,get waypoint(){return waypoint;},routePts,openWorld,toggleBigMap2:()=>bigMapOpen,CLOCK,saveGame,loadVehState};
