// Track: centerline data (used by physics) + 3D meshes.
import * as THREE from 'three';

export const ROAD_HALF = 6.5;          // m  (13 m wide road)
export const KERB_W = 1.3;             // m
export const RUNOFF = 9.0;             // m of gravel trap
export const BARRIER = ROAD_HALF + KERB_W + RUNOFF;   // lateral distance of the walls
const SCALE = 0.2;                     // design units -> metres
const CP = [[600,1700],[600,900],[760,520],[1150,400],[1550,560],[1750,950],[2050,1180],[2400,960],[2550,560],[2950,330],[3450,450],[3700,900],[3550,1400],[3100,1560],[2700,1500],[2450,1780],[2650,2150],[3250,2250],[3600,2500],[3350,2850],[2500,2900],[1600,2850],[1000,2800],[650,2400]].map(p=>[p[0]*SCALE,p[1]*SCALE]);
export const WORLD = { w: 4300*SCALE, h: 3250*SCALE };

function cr(p0,p1,p2,p3,t){
  const t2=t*t,t3=t2*t;
  const f=(a,b,c,d)=>0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
  return [f(p0[0],p1[0],p2[0],p3[0]), f(p0[1],p1[1],p2[1],p3[1])];
}
// dense spline, then resample at equal spacing
const raw=[]; { const n=CP.length; for(let i=0;i<n;i++) for(let k=0;k<40;k++) raw.push(cr(CP[(i-1+n)%n],CP[i],CP[(i+1)%n],CP[(i+2)%n],k/40)); }
export const SPACING = 3;
export const TP=[];
{ let acc=0; TP.push({x:raw[0][0],y:raw[0][1]});
  for(let i=1;i<=raw.length;i++){ const a=raw[i-1], b=raw[i%raw.length]; const seg=Math.hypot(b[0]-a[0],b[1]-a[1]); let s=0;
    while(acc+seg-s>=SPACING){ s+=SPACING-acc; const t=s/seg; TP.push({x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t}); acc=0; }
    acc+=seg-s; }
  if(Math.hypot(TP[TP.length-1].x-TP[0].x,TP[TP.length-1].y-TP[0].y)<SPACING*0.5) TP.pop(); }
export const N=TP.length;
export const LENGTH=N*SPACING;
// tangent angle + right normal for each sample
for(let i=0;i<N;i++){ const a=TP[(i-1+N)%N], b=TP[(i+1)%N]; const ang=Math.atan2(b.y-a.y,b.x-a.x); TP[i].a=ang; TP[i].nx=-Math.sin(ang); TP[i].ny=Math.cos(ang); }

export function nearest(x,y){ let bi=0,bd=1e18; for(let i=0;i<N;i++){ const dx=TP[i].x-x, dy=TP[i].y-y, d=dx*dx+dy*dy; if(d<bd){bd=d;bi=i;} } return bi; }
// Returns {i, lat (signed, + = right of travel direction), dist}
export function query(x,y,hint){
  let bi=hint|0, bd=1e18;
  if(hint==null || hint<0){ bi=nearest(x,y); }
  else { for(let k=-12;k<=12;k++){ const i=(hint+k+N)%N, dx=TP[i].x-x, dy=TP[i].y-y, d=dx*dx+dy*dy; if(d<bd){bd=d;bi=i;} }
         if(bd>(BARRIER*2)*(BARRIER*2)) bi=nearest(x,y); }
  // project onto the better neighbouring segment for a smooth lateral value
  const p=TP[bi], q=TP[(bi+1)%N], o=TP[(bi-1+N)%N];
  let sx=q.x-p.x, sy=q.y-p.y, t=((x-p.x)*sx+(y-p.y)*sy)/(sx*sx+sy*sy), A=p, ang=p.a;
  if(t<0){ sx=p.x-o.x; sy=p.y-o.y; t=((x-o.x)*sx+(y-o.y)*sy)/(sx*sx+sy*sy); A=o; }
  t=Math.max(0,Math.min(1,t));
  const px=A.x+sx*t, py=A.y+sy*t; const len=Math.hypot(sx,sy); const nx=-sy/len, ny=sx/len;
  const lat=(x-px)*nx+(y-py)*ny;
  return { i:bi, lat, nx, ny, ang:Math.atan2(sy,sx) };
}
export function surfaceAt(lat){ const a=Math.abs(lat); return a<ROAD_HALF?0 : a<ROAD_HALF+KERB_W?1 : 2; } // 0 asphalt 1 kerb 2 gravel

// ---------------- procedural textures ----------------
function canvasTex(w,h,draw,repeat=true){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); draw(g,w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; if(repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; } t.anisotropy=8; return t;
}
function noise(g,w,h,base,amp,count,size=1){
  g.fillStyle=base; g.fillRect(0,0,w,h);
  for(let i=0;i<count;i++){ const v=(Math.random()-0.5)*amp; g.fillStyle=v>0?`rgba(255,255,255,${v})`:`rgba(0,0,0,${-v})`; const s=size*(0.5+Math.random()); g.fillRect(Math.random()*w,Math.random()*h,s,s); }
}
export function makeTextures(){
  const asphalt=canvasTex(512,512,(g,w,h)=>{
    noise(g,w,h,'#3b3d42',0.22,26000,2);
    // edge lines (u across the road)
    g.fillStyle='rgba(240,240,240,.92)'; g.fillRect(w*0.018,0,w*0.022,h); g.fillRect(w*0.96,0,w*0.022,h);
    // rubbered-in racing line darkening in the middle
    const gr=g.createLinearGradient(0,0,w,0); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(.5,'rgba(0,0,0,.18)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=gr; g.fillRect(0,0,w,h);
  });
  const kerb=canvasTex(64,256,(g,w,h)=>{ g.fillStyle='#d8262f'; g.fillRect(0,0,w,h/2); g.fillStyle='#f2f2f2'; g.fillRect(0,h/2,w,h/2);
    for(let i=0;i<500;i++){ g.fillStyle=`rgba(0,0,0,${Math.random()*.15})`; g.fillRect(Math.random()*w,Math.random()*h,2,2); } });
  const gravel=canvasTex(256,256,(g,w,h)=>{ noise(g,w,h,'#b9a77e',0.35,14000,2.2); });
  const grass=canvasTex(512,512,(g,w,h)=>{ noise(g,w,h,'#4d7f33',0.18,40000,2);
    for(let i=0;i<400;i++){ g.fillStyle=`rgba(${Math.random()<.5?'30,60,20':'110,150,60'},${Math.random()*.25})`; g.beginPath(); g.arc(Math.random()*w,Math.random()*h,4+Math.random()*14,0,7); g.fill(); } });
  const wall=canvasTex(256,64,(g,w,h)=>{ g.fillStyle='#e9e9e9'; g.fillRect(0,0,w,h); g.fillStyle='#c81e2a'; g.fillRect(0,0,w/2,h);
    g.fillStyle='rgba(0,0,0,.25)'; g.fillRect(0,h-6,w,6); g.fillStyle='rgba(255,255,255,.15)'; g.fillRect(0,0,w,5); });
  const checker=canvasTex(128,32,(g,w,h)=>{ const s=16; for(let x=0;x<w/s;x++) for(let y=0;y<h/s;y++){ g.fillStyle=(x+y)%2?'#111':'#fff'; g.fillRect(x*s,y*s,s,s); } },false);
  return {asphalt,kerb,gravel,grass,wall,checker};
}

// ribbon between two lateral offsets along the whole loop
function ribbon(offA,offB,y,vLen,mat,{yB=y, uFlip=false}={}){
  const pos=new Float32Array((N+1)*2*3), uv=new Float32Array((N+1)*2*2), nor=new Float32Array((N+1)*2*3), idx=[];
  for(let k=0;k<=N;k++){ const p=TP[k%N]; const v=k*SPACING/vLen;
    pos.set([p.x+p.nx*offA, y, p.y+p.ny*offA, p.x+p.nx*offB, yB, p.y+p.ny*offB], k*6);
    uv.set(uFlip?[1,v,0,v]:[0,v,1,v], k*4); nor.set([0,1,0,0,1,0],k*6);
    if(k<N){ const a=k*2; if(offB>offA) idx.push(a,a+1,a+2, a+1,a+3,a+2); else idx.push(a,a+2,a+1, a+1,a+2,a+3); } }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('uv',new THREE.BufferAttribute(uv,2)); geo.setAttribute('normal',new THREE.BufferAttribute(nor,3)); geo.setIndex(idx);
  if(y!==yB) geo.computeVertexNormals();
  return new THREE.Mesh(geo,mat);
}
function wallMesh(off,height,mat){
  const pos=new Float32Array((N+1)*2*3), uv=new Float32Array((N+1)*2*2), idx=[];
  for(let k=0;k<=N;k++){ const p=TP[k%N]; const x=p.x+p.nx*off, z=p.y+p.ny*off, v=k*SPACING/4;
    pos.set([x,0,z,x,height,z],k*6); uv.set([v,0,v,1],k*4); if(k<N){ const a=k*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); } }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('uv',new THREE.BufferAttribute(uv,2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,mat); return m;
}

export function buildTrack(scene,quality){
  const T=makeTextures();
  const group=new THREE.Group(); scene.add(group);
  // ground
  T.grass.repeat.set(WORLD.w/14, WORLD.h/14);
  const groundW=WORLD.w*3, groundH=WORLD.h*3;
  const g2=T.grass.clone(); g2.repeat.set(groundW/14,groundH/14); g2.needsUpdate=true;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(groundW,groundH), new THREE.MeshStandardMaterial({map:g2,roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.position.set(WORLD.w/2,0,WORLD.h/2); ground.receiveShadow=true; group.add(ground);

  const roadMat=new THREE.MeshStandardMaterial({map:T.asphalt,roughness:0.92,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const kerbMat=new THREE.MeshStandardMaterial({map:T.kerb,roughness:0.7,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const gravelMat=new THREE.MeshStandardMaterial({map:T.gravel,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  T.gravel.repeat.set(2,1);
  const road=ribbon(-ROAD_HALF,ROAD_HALF,0.02,ROAD_HALF*2*1.6,roadMat); road.receiveShadow=true; group.add(road);
  for(const s of [-1,1]){
    const k=ribbon(s*ROAD_HALF, s*(ROAD_HALF+KERB_W), 0.03, 6, kerbMat, {yB:0.07}); k.receiveShadow=true; group.add(k);
    const gv=ribbon(s*(ROAD_HALF+KERB_W), s*BARRIER, 0.012, 6, gravelMat); gv.receiveShadow=true; group.add(gv);
  }
  // walls
  const wallMat=new THREE.MeshStandardMaterial({map:T.wall,roughness:0.8,side:THREE.DoubleSide});
  for(const s of [-1,1]){ const w=wallMesh(s*(BARRIER+0.3),1.1,wallMat); w.castShadow=quality!=='low'; w.receiveShadow=true; group.add(w); }
  // start / finish line
  { const p=TP[0]; const m=new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF*2,2.0), new THREE.MeshStandardMaterial({map:T.checker,roughness:.8,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
    m.rotation.x=-Math.PI/2; m.rotation.z=-p.a+Math.PI/2; m.position.set(p.x,0.025,p.y); group.add(m); }
  // start gantry with 5 lights
  const lights=[];
  { const i=(4+N)%N, p=TP[i]; const gant=new THREE.Group(); gant.position.set(p.x,0,p.y); gant.rotation.y=-p.a; group.add(gant);
    const metal=new THREE.MeshStandardMaterial({color:0x2b2f36,metalness:.6,roughness:.4});
    for(const s of [-1,1]){ const pole=new THREE.Mesh(new THREE.BoxGeometry(0.5,7.5,0.5),metal); pole.position.set(0,3.75,s*(ROAD_HALF+1.6)); pole.castShadow=true; gant.add(pole); }
    const beam=new THREE.Mesh(new THREE.BoxGeometry(0.8,1.2,ROAD_HALF*2+4),metal); beam.position.set(0,7.2,0); beam.castShadow=true; gant.add(beam);
    const sign=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.9,ROAD_HALF*2+3.6),new THREE.MeshStandardMaterial({color:0x111111})); sign.position.set(-0.45,7.2,0); gant.add(sign);
    for(let k=0;k<5;k++){ const mat=new THREE.MeshStandardMaterial({color:0x220000,emissive:0xff1010,emissiveIntensity:0});
      const l=new THREE.Mesh(new THREE.SphereGeometry(0.28,16,10),mat); l.position.set(-0.6,7.2,(k-2)*1.1); gant.add(l); lights.push(mat); }
  }
  // grandstands along the start straight (outside, left of travel)
  const standMat=new THREE.MeshStandardMaterial({color:0x8a8f99,roughness:.9});
  const roofMat=new THREE.MeshStandardMaterial({color:0xdde3ea,roughness:.5,metalness:.2});
  const crowdCount=quality==='low'?0:900, crowdGeo=new THREE.BoxGeometry(0.45,0.7,0.45);
  const crowd=crowdCount?new THREE.InstancedMesh(crowdGeo,new THREE.MeshStandardMaterial({roughness:1}),crowdCount):null; let ci=0;
  const dummy=new THREE.Object3D(), col=new THREE.Color();
  for(const [i0,side] of [[-22,-1],[10,-1],[-8,1]]){
    const i=(i0+N)%N, p=TP[i]; const st=new THREE.Group(); st.position.set(p.x+p.nx*side*(BARRIER+6),0,p.y+p.ny*side*(BARRIER+6)); st.rotation.y=-p.a; group.add(st);
    for(let r=0;r<7;r++){ const b=new THREE.Mesh(new THREE.BoxGeometry(40,0.8+r*0.9,2),standMat); b.position.set(0,(0.8+r*0.9)/2,side*r*2); b.castShadow=true; b.receiveShadow=true; st.add(b);
      if(crowd) for(let k=0;k<40 && ci<crowdCount;k++){ if(Math.random()<0.25) continue; dummy.position.set(-19+k*0.97+(Math.random()-.5)*.3,0.8+r*0.9+0.35,side*r*2); dummy.updateMatrix(); st.updateMatrixWorld(); dummy.matrix.premultiply(st.matrixWorld); crowd.setMatrixAt(ci,dummy.matrix); crowd.setColorAt(ci,col.setHSL(Math.random(),0.6,0.3+Math.random()*0.4)); ci++; } }
    const roof=new THREE.Mesh(new THREE.BoxGeometry(42,0.3,16),roofMat); roof.position.set(0,10,side*6); roof.castShadow=true; st.add(roof);
    for(const x of [-20,0,20]){ const post=new THREE.Mesh(new THREE.BoxGeometry(0.4,10,0.4),standMat); post.position.set(x,5,side*14); st.add(post); }
  }
  if(crowd){ crowd.count=ci; crowd.instanceMatrix.needsUpdate=true; if(crowd.instanceColor) crowd.instanceColor.needsUpdate=true; group.add(crowd); }
  // pit building
  { const i=(-4+N)%N, p=TP[i]; const b=new THREE.Mesh(new THREE.BoxGeometry(70,6,12),new THREE.MeshStandardMaterial({color:0xf0f0f0,roughness:.6}));
    b.position.set(p.x+p.nx*(BARRIER+10),3,p.y+p.ny*(BARRIER+10)); b.rotation.y=-p.a; b.castShadow=true; b.receiveShadow=true; group.add(b);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(70.2,1,12.2),new THREE.MeshStandardMaterial({color:0xd8262f})); stripe.position.copy(b.position); stripe.position.y=5.2; stripe.rotation.y=b.rotation.y; group.add(stripe); }
  // trees (instanced) outside the walls
  const treeN=quality==='high'?900:quality==='med'?500:180;
  const trunkGeo=new THREE.CylinderGeometry(0.25,0.35,2.4,6); trunkGeo.translate(0,1.2,0);
  const crownGeo=new THREE.ConeGeometry(2.4,6,8); crownGeo.translate(0,5,0);
  const crown2Geo=new THREE.IcosahedronGeometry(2.6,0); crown2Geo.translate(0,4.2,0);
  const trunks=new THREE.InstancedMesh(trunkGeo,new THREE.MeshStandardMaterial({color:0x5a3d22,roughness:1}),treeN);
  const pines=new THREE.InstancedMesh(crownGeo,new THREE.MeshStandardMaterial({color:0x2d5a27,roughness:1,flatShading:true}),treeN);
  const oaks=new THREE.InstancedMesh(crown2Geo,new THREE.MeshStandardMaterial({color:0x3f7a2c,roughness:1,flatShading:true}),treeN);
  let ti=0,pi=0,oi=0; let seed=11; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let k=0;k<treeN*6 && ti<treeN;k++){
    const x=-120+rnd()*(WORLD.w+240), z=-120+rnd()*(WORLD.h+240);
    const q=query(x,z,-1); if(Math.abs(q.lat)<BARRIER+7) continue;
    const s=0.7+rnd()*0.8; dummy.position.set(x,0,z); dummy.rotation.set(0,rnd()*6.28,0); dummy.scale.set(s,s*(0.8+rnd()*0.5),s); dummy.updateMatrix();
    trunks.setMatrixAt(ti++,dummy.matrix);
    if(rnd()<0.55) pines.setMatrixAt(pi++,dummy.matrix); else oaks.setMatrixAt(oi++,dummy.matrix);
  }
  trunks.count=ti; pines.count=pi; oaks.count=oi;
  for(const m of [trunks,pines,oaks]){ m.castShadow=quality==='high'; m.receiveShadow=false; m.instanceMatrix.needsUpdate=true; group.add(m); }
  // tyre stacks at the outside of corners (visual)
  const tyreGeo=new THREE.TorusGeometry(0.42,0.2,6,12); tyreGeo.rotateX(Math.PI/2);
  const tyreN=quality==='low'?0:600; const tyres=new THREE.InstancedMesh(tyreGeo,new THREE.MeshStandardMaterial({color:0x151515,roughness:.9}),tyreN||1); let yi=0;
  for(let i=0;i<N && yi<tyreN-3;i+=5){ const a=TP[(i-3+N)%N].a, b=TP[(i+3)%N].a; let d=b-a; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI;
    if(Math.abs(d)<0.06) continue; const side=d>0?-1:1; const p=TP[i];
    for(let h=0;h<3;h++){ dummy.position.set(p.x+p.nx*side*(BARRIER+0.95), 0.2+h*0.4, p.y+p.ny*side*(BARRIER+0.95)); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix(); tyres.setMatrixAt(yi++,dummy.matrix); } }
  tyres.count=yi; tyres.instanceMatrix.needsUpdate=true; group.add(tyres);
  return { group, startLights:lights };
}

// minimap path (2D canvas)
export function drawMinimapTrack(g,s){ g.beginPath(); g.moveTo(TP[0].x*s,TP[0].y*s); for(const p of TP) g.lineTo(p.x*s,p.y*s); g.closePath(); }
