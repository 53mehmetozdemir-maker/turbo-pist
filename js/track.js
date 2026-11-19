// Track: centerline data (used by physics) + 3D meshes.
import * as THREE from 'three';
import { broadleafGeos, coniferGeos, treeMaterials, spectatorGeo } from './props.js';

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

function gantryTex(){ return canvasTex(512,48,(g,w,h)=>{ g.fillStyle='#111'; g.fillRect(0,0,w,h); g.fillStyle='#d8262f'; g.fillRect(0,0,w,4); g.fillRect(0,h-4,w,4); g.fillStyle='#fff'; g.font='bold 28px Inter,sans-serif'; g.textAlign='center'; g.fillText('TURBO PİST  ·  START / FINISH',w/2,34); },false); }
function adTex(){ return canvasTex(1024,32,(g,w,h)=>{ const ads=[['TURBO','#d8262f','#fff'],['PİST 3D','#111','#ffd400'],['YAĞ','#1f6fe0','#fff'],['LASTİK','#ffd400','#111'],['HIZ','#20b956','#fff'],['NİTRO','#8e44ef','#fff']];
  for(let i=0;i<8;i++){ const [t,b,f]=ads[i%ads.length]; g.fillStyle=b; g.fillRect(i*128,0,128,h); g.fillStyle=f; g.font='bold 22px Inter,sans-serif'; g.textAlign='center'; g.fillText(t,i*128+64,24); } },false); }
function garageTex(){ return canvasTex(1024,64,(g,w,h)=>{ g.fillStyle='#e9e9e7'; g.fillRect(0,0,w,h); for(let i=0;i<12;i++){ const x=i*w/12+6, ww=w/12-12; g.fillStyle='#2a2d33'; g.fillRect(x,8,ww,h-8);
  for(let y=10;y<h;y+=5){ g.fillStyle='rgba(255,255,255,.07)'; g.fillRect(x,y,ww,1); } g.fillStyle='#d8262f'; g.fillRect(x,2,ww,5); g.fillStyle='#fff'; g.font='bold 9px Inter,sans-serif'; g.fillText(String(i+1),x+ww/2-3,7); } },false); }
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
    const metal=new THREE.MeshStandardMaterial({color:0x3a3f47,metalness:.5,roughness:.45});
    for(const s of [-1,1]){ const pole=new THREE.Mesh(new THREE.BoxGeometry(0.5,7.5,0.5),metal); pole.position.set(0,3.75,s*(ROAD_HALF+1.6)); pole.castShadow=true; gant.add(pole); }
    const beam=new THREE.Mesh(new THREE.BoxGeometry(0.8,1.2,ROAD_HALF*2+4),metal); beam.position.set(0,7.2,0); beam.castShadow=true; gant.add(beam);
    const sign=new THREE.Mesh(new THREE.BoxGeometry(0.2,0.9,ROAD_HALF*2+3.6),[0,0,0,0,0,0].map((_,k)=>k===1?new THREE.MeshStandardMaterial({map:gantryTex(),roughness:.5}):new THREE.MeshStandardMaterial({color:0x111111}))); sign.position.set(-0.45,7.2,0); gant.add(sign);
    for(let k=0;k<5;k++){ const mat=new THREE.MeshStandardMaterial({color:0x220000,emissive:0xff1010,emissiveIntensity:0});
      const l=new THREE.Mesh(new THREE.SphereGeometry(0.26,16,10),mat); l.position.set(-0.45,6.25,(k-2)*1.0); gant.add(l); lights.push(mat); }
    const pod=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.75,5.6),metal); pod.position.set(-0.2,6.25,0); gant.add(pod);
  }
  // grandstands along the start straight: concrete tiers, seats, spectators, steel roof on trusses
  const standMat=new THREE.MeshStandardMaterial({color:0x9a9ea6,roughness:.9});
  const seatMat=new THREE.MeshStandardMaterial({color:0x1d4f9c,roughness:.6});
  const roofMat=new THREE.MeshStandardMaterial({color:0xd6dce3,roughness:.45,metalness:.5,side:THREE.DoubleSide});
  const steel=new THREE.MeshStandardMaterial({color:0x5d636b,roughness:.5,metalness:.7});
  const crowdCount=quality==='low'?0:quality==='med'?700:1100;
  const crowd=crowdCount?new THREE.InstancedMesh(spectatorGeo(),new THREE.MeshStandardMaterial({roughness:.85,vertexColors:true}),crowdCount):null; let ci=0;
  const dummy=new THREE.Object3D(), col=new THREE.Color();
  const shirts=[0xd8262f,0xf2f2f2,0xffd400,0x1f6fe0,0x222222,0x20b956,0xff7a1a,0x8e44ef,0x9aa3ad];
  for(const [i0,side] of [[-22,-1],[10,-1],[-8,1]]){
    const i=(i0+N)%N, p=TP[i]; const st=new THREE.Group(); st.position.set(p.x+p.nx*side*(BARRIER+6),0,p.y+p.ny*side*(BARRIER+6)); st.rotation.y=-p.a; group.add(st); st.updateMatrixWorld();
    for(let r=0;r<7;r++){ const h=0.8+r*0.9; const b=new THREE.Mesh(new THREE.BoxGeometry(40,h,2),standMat); b.position.set(0,h/2,side*r*2); b.castShadow=true; b.receiveShadow=true; st.add(b);
      const seat=new THREE.Mesh(new THREE.BoxGeometry(39.6,0.12,0.5),seatMat); seat.position.set(0,h+0.06,side*(r*2-0.2)); st.add(seat);
      const back=new THREE.Mesh(new THREE.BoxGeometry(39.6,0.45,0.08),seatMat); back.position.set(0,h+0.3,side*(r*2+0.15)); st.add(back);
      if(crowd) for(let k=0;k<52 && ci<crowdCount;k++){ if(Math.random()<0.3) continue; dummy.position.set(-19.4+k*0.75+(Math.random()-.5)*.12,h+0.08,side*(r*2-0.05)); dummy.rotation.set(0,side<0?0:Math.PI,0); const sc=0.95+Math.random()*0.12; dummy.scale.set(sc,sc,sc); dummy.updateMatrix(); dummy.matrix.premultiply(st.matrixWorld); crowd.setMatrixAt(ci,dummy.matrix); crowd.setColorAt(ci,col.set(shirts[Math.floor(Math.random()*shirts.length)]).multiplyScalar(0.7+Math.random()*0.4)); ci++; } }
    // rear wall + side walls
    const rw=new THREE.Mesh(new THREE.BoxGeometry(40,7.3,0.3),standMat); rw.position.set(0,3.65,side*13.2); rw.castShadow=true; st.add(rw);
    for(const x of [-20.1,20.1]){ const sw=new THREE.Mesh(new THREE.BoxGeometry(0.3,7.3,14),standMat); sw.position.set(x,3.65,side*6.5); st.add(sw); }
    // cantilever roof: sloped sheet, columns at the back, tapered beams
    const roof=new THREE.Mesh(new THREE.BoxGeometry(42,0.18,16),roofMat); roof.position.set(0,10.3,side*6); roof.rotation.x=side*0.06; roof.castShadow=true; st.add(roof);
    const fascia=new THREE.Mesh(new THREE.BoxGeometry(42,0.7,0.2),new THREE.MeshStandardMaterial({color:0xd8262f,roughness:.5})); fascia.position.set(0,10.1,side*-1.9); st.add(fascia);
    for(let x=-20;x<=20;x+=5){ const col2=new THREE.Mesh(new THREE.BoxGeometry(0.35,10.3,0.35),steel); col2.position.set(x,5.15,side*13.5); col2.castShadow=true; st.add(col2);
      const beam=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.9,16),steel); beam.position.set(x,9.75,side*6); beam.rotation.x=side*0.06; st.add(beam); }
    // sponsor board along the front
    const board=new THREE.Mesh(new THREE.BoxGeometry(40,0.9,0.1),new THREE.MeshStandardMaterial({map:adTex(),roughness:.6})); board.position.set(0,0.45,side*-1.1); board.rotation.y=side<0?0:Math.PI; st.add(board);
  }
  if(crowd){ crowd.count=ci; crowd.instanceMatrix.needsUpdate=true; if(crowd.instanceColor) crowd.instanceColor.needsUpdate=true; group.add(crowd); }
  // pit building: garages, glazed hospitality level, roof terrace
  { const i=(-4+N)%N, p=TP[i]; const pb=new THREE.Group(); pb.position.set(p.x+p.nx*(BARRIER+10),0,p.y+p.ny*(BARRIER+10)); pb.rotation.y=-p.a; group.add(pb);
    const wallM=new THREE.MeshStandardMaterial({color:0xeeeeec,roughness:.6});
    const base=new THREE.Mesh(new THREE.BoxGeometry(70,4.2,12),wallM); base.position.y=2.1; base.castShadow=true; base.receiveShadow=true; pb.add(base);
    const doorM=new THREE.MeshStandardMaterial({map:garageTex(),roughness:.55,metalness:.3});
    const face=new THREE.Mesh(new THREE.PlaneGeometry(68,3.6),doorM); face.position.set(0,1.85,-6.02); face.rotation.y=Math.PI; pb.add(face);
    const upper=new THREE.Mesh(new THREE.BoxGeometry(70,3.2,10),new THREE.MeshPhysicalMaterial({color:0x223240,roughness:.05,metalness:.6,envMapIntensity:1.4})); upper.position.set(0,5.8,0.6); upper.castShadow=true; pb.add(upper);
    for(let x=-34;x<=34;x+=4){ const m=new THREE.Mesh(new THREE.BoxGeometry(0.15,3.2,0.15),steel); m.position.set(x,5.8,-4.45); pb.add(m); }
    const slab=new THREE.Mesh(new THREE.BoxGeometry(71,0.35,12.6),wallM); slab.position.y=7.55; pb.add(slab);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(71.2,0.5,12.8),new THREE.MeshStandardMaterial({color:0xd8262f})); stripe.position.y=4.35; pb.add(stripe);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(71,1,0.05),new THREE.MeshStandardMaterial({color:0x99aabb,transparent:true,opacity:0.35,roughness:.1})); rail.position.set(0,8.2,-6.2); pb.add(rail); }
  // catch fence on top of the walls along the main straight
  { const fenceTex=canvasTex(64,64,(g,w,h)=>{ g.clearRect(0,0,w,h); g.strokeStyle='rgba(200,205,210,.9)'; g.lineWidth=1.4; for(let k=-64;k<128;k+=8){ g.beginPath(); g.moveTo(k,0); g.lineTo(k+64,64); g.stroke(); g.beginPath(); g.moveTo(k+64,0); g.lineTo(k,64); g.stroke(); } });
    fenceTex.repeat.set(1,1); const fm=new THREE.MeshStandardMaterial({map:fenceTex,transparent:true,alphaTest:0.3,side:THREE.DoubleSide,metalness:.6,roughness:.4});
    for(const s of [-1,1]){ const pos=[], uv=[], idx=[]; let k0=0; for(let k=-40;k<=40;k++){ const p=TP[(k+N)%N], x=p.x+p.nx*s*(BARRIER+0.3), z=p.y+p.ny*s*(BARRIER+0.3); pos.push(x,1.1,z,x,4.2,z); uv.push(k*SPACING/1.5,0,k*SPACING/1.5,2); if(k>-40){ const a=k0*2; idx.push(a-2,a-1,a, a-1,a+1,a); } k0++; }
      const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); group.add(new THREE.Mesh(g,fm));
      const postG=new THREE.CylinderGeometry(0.05,0.05,3.2,5); const posts=new THREE.InstancedMesh(postG,steel,27); let pi2=0; for(let k=-39;k<=39;k+=3){ const p=TP[(k+N)%N]; dummy.position.set(p.x+p.nx*s*(BARRIER+0.35),2.7,p.y+p.ny*s*(BARRIER+0.35)); dummy.rotation.set(0,0,0); dummy.scale.set(1,1,1); dummy.updateMatrix(); posts.setMatrixAt(pi2++,dummy.matrix); } posts.count=pi2; group.add(posts); } }
  // trees (instanced) outside the walls
  const treeN=quality==='high'?900:quality==='med'?500:180;
  const TM=treeMaterials(), dq=quality==='low'?0:1;
  const kinds=[coniferGeos(dq,0),coniferGeos(dq,1),broadleafGeos(dq,3),broadleafGeos(dq,4)];
  const lists=kinds.map(()=>[]); let seed=11; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let k=0,n=0;k<treeN*6 && n<treeN;k++){
    const x=-120+rnd()*(WORLD.w+240), z=-120+rnd()*(WORLD.h+240);
    const q=query(x,z,-1); if(Math.abs(q.lat)<BARRIER+7) continue;
    const s=0.7+rnd()*0.8; lists[Math.floor(rnd()*4)].push([x,z,s,rnd()*6.28,0.85+rnd()*0.4]); n++; }
  const tint=[0xa8c48a,0xbfd08f,0x94b47a,0xc9d29a].map(c=>new THREE.Color(c));
  kinds.forEach((G,v)=>{ const L=lists[v]; const tr=new THREE.InstancedMesh(G.trunk,TM.bark,Math.max(1,L.length)), cr=new THREE.InstancedMesh(G.crown,v<2?TM.needle:TM.leaf,Math.max(1,L.length));
    L.forEach(([x,z,s,r,sy],i)=>{ dummy.position.set(x,0,z); dummy.rotation.set(0,r,0); dummy.scale.set(s,s*sy,s); dummy.updateMatrix(); tr.setMatrixAt(i,dummy.matrix); cr.setMatrixAt(i,dummy.matrix); cr.setColorAt(i,tint[i%4]); });
    tr.count=cr.count=L.length; if(cr.instanceColor) cr.instanceColor.needsUpdate=true;
    for(const m of [tr,cr]){ m.castShadow=quality==='high'; m.receiveShadow=false; group.add(m); } });
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

// world interface used by the physics
export const trackWorld = {
  surface(x,y,car){ const q=query(x,y,car.hint); car.hint=q.i; car.lat=q.lat; return surfaceAt(q.lat); },
  collide(car){
    for(const c of car.corners()){
      const q=query(c.x,c.y,car.hint); const over=Math.abs(q.lat)-BARRIER; if(over<=0) continue;
      const s=Math.sign(q.lat); car.contact(c,q.nx*s,q.ny*s,over);
    }
  }
};
