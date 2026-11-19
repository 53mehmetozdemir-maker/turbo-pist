// Procedural sports car. Local axes: +X forward, +Y up, +Z right.
import * as THREE from 'three';

export const CAR = { length: 4.5, width: 1.9, a: 1.35, b: 1.25, track: 0.82, wheelR: 0.34 };

const shared = {};
function mats(){
  if(shared.tire) return shared;
  shared.tire = new THREE.MeshStandardMaterial({color:0x111111, roughness:0.85});
  shared.rim = new THREE.MeshStandardMaterial({color:0xc9ccd2, metalness:1, roughness:0.25});
  shared.black = new THREE.MeshStandardMaterial({color:0x0c0d10, roughness:0.6, metalness:0.2});
  shared.carbon = new THREE.MeshStandardMaterial({color:0x1b1d22, roughness:0.35, metalness:0.5});
  shared.glass = new THREE.MeshPhysicalMaterial({color:0x0b1118, metalness:0.2, roughness:0.05, transparent:true, opacity:0.55, clearcoat:1});
  shared.chrome = new THREE.MeshStandardMaterial({color:0xdddddd, metalness:1, roughness:0.15});
  shared.interior = new THREE.MeshStandardMaterial({color:0x1a1a1d, roughness:0.9});
  shared.leather = new THREE.MeshStandardMaterial({color:0x2a1c18, roughness:0.7});
  shared.headlight = new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xfff4d6, emissiveIntensity:1.2});
  shared.disc = new THREE.MeshStandardMaterial({color:0x777777, metalness:0.9, roughness:0.4});
  shared.caliper = new THREE.MeshStandardMaterial({color:0xd8262f, roughness:0.4});
  return shared;
}

function profileShape(pts){ const s=new THREE.Shape(); s.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]); s.closePath(); return s; }
function smoothProfile(pts,seg=6){ // Catmull-Rom through points for a curvy silhouette
  const out=[]; const n=pts.length;
  for(let i=0;i<n;i++){ const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
    for(let k=0;k<seg;k++){ const t=k/seg,t2=t*t,t3=t2*t; const f=(a,b,c,d)=>0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
      out.push([f(p0[0],p1[0],p2[0],p3[0]),f(p0[1],p1[1],p2[1],p3[1])]); } }
  return out;
}
function extrude(pts,depth,bevel,mat){
  const geo=new THREE.ExtrudeGeometry(profileShape(pts),{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:4,curveSegments:4});
  geo.translate(0,0,-depth/2); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,mat); m.castShadow=true; m.receiveShadow=true; return m;
}

function wheel(){
  const M=mats(); const g=new THREE.Group();
  const tireGeo=new THREE.CylinderGeometry(CAR.wheelR,CAR.wheelR,0.27,28,1); tireGeo.rotateX(Math.PI/2);
  const tire=new THREE.Mesh(tireGeo,M.tire); tire.castShadow=true; g.add(tire);
  const rimGeo=new THREE.CylinderGeometry(0.235,0.235,0.28,24); rimGeo.rotateX(Math.PI/2);
  const rim=new THREE.Mesh(rimGeo,M.black); g.add(rim);
  for(let k=0;k<5;k++){ const sp=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.44,0.03),M.rim); sp.rotation.z=k*Math.PI*2/5; sp.position.z=0.14; g.add(sp);
    const sp2=sp.clone(); sp2.position.z=-0.14; g.add(sp2); }
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.3,10).rotateX(Math.PI/2),M.chrome); g.add(hub);
  return g;
}

export function buildCar(color, opts={}){
  const M=mats();
  const paint=new THREE.MeshPhysicalMaterial({color, metalness:0.55, roughness:0.32, clearcoat:1, clearcoatRoughness:0.04});
  const root=new THREE.Group();          // positioned/rotated by the game
  const body=new THREE.Group(); root.add(body);   // pitched/rolled for weight transfer

  // lower body silhouette (side profile, x forward / y up)
  const lower=smoothProfile([[-2.25,0.30],[-2.27,0.62],[-2.15,0.86],[-1.6,0.94],[-1.32,0.95],[-1.22,0.62],[-1.12,0.56],[0.62,0.56],[0.74,0.64],[0.84,0.92],[1.7,0.80],[2.2,0.62],[2.27,0.42],[2.15,0.24],[1.0,0.22],[-1.0,0.22],[-2.1,0.24]],4);
  const lowerMesh=extrude(lower,1.70,0.1,paint); body.add(lowerMesh);
  for(const sd of [-1,1]){ const door=new THREE.Mesh(new THREE.BoxGeometry(2.05,0.46,0.06),paint); door.position.set(-0.27,0.73,sd*0.9); door.castShadow=true; body.add(door);
    const trim=new THREE.Mesh(new THREE.BoxGeometry(2.05,0.04,0.12),M.interior); trim.position.set(-0.27,0.97,sd*0.86); body.add(trim); }
  // cabin (glass greenhouse)
  const cabin=smoothProfile([[-1.45,0.90],[-0.75,1.22],[0.15,1.25],[0.95,0.93],[0.3,0.9],[-0.6,0.9]],5);
  const cabinMesh=extrude(cabin,1.30,0.07,M.glass); cabinMesh.castShadow=false; body.add(cabinMesh);
  // painted roof panel + pillars
  const roof=new THREE.Mesh(new THREE.BoxGeometry(0.85,0.05,1.28),paint); roof.position.set(-0.3,1.255,0); roof.castShadow=true; body.add(roof);
  const headliner=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.26),M.interior); headliner.rotation.x=Math.PI/2; headliner.position.set(-0.3,1.225,0); body.add(headliner);
  for(const s of [-1,1]){
    const aP=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.5,0.035),M.carbon); aP.position.set(0.6,1.08,s*0.65); aP.rotation.z=0.86; body.add(aP);
    const cP=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.45,0.08),paint); cP.position.set(-1.05,1.05,s*0.66); cP.rotation.z=-0.62; body.add(cP);
    // side mirror
    const mir=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.1,0.18),paint); mir.position.set(0.55,1.0,s*1.0); body.add(mir);
    const mirG=new THREE.Mesh(new THREE.PlaneGeometry(0.15,0.08),M.chrome); mirG.position.set(0.46,1.0,s*1.0); mirG.rotation.y=-Math.PI/2; body.add(mirG);
    // side skirt
    const sk=new THREE.Mesh(new THREE.BoxGeometry(2.3,0.08,0.06),M.carbon); sk.position.set(0,0.27,s*0.93); body.add(sk);
    // side intake
    const intake=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.16,0.02),M.black); intake.position.set(-0.9,0.55,s*0.952); body.add(intake);
  }
  // front: splitter, grille, headlights
  const split=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.04,1.8),M.carbon); split.position.set(2.18,0.22,0); body.add(split);
  const grille=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,1.0),M.black); grille.position.set(2.3,0.4,0); body.add(grille);
  for(const s of [-1,1]){ const hl=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.08,0.42),M.headlight); hl.position.set(2.17,0.66,s*0.6); hl.rotation.z=-0.5; body.add(hl); }
  // rear: tail lights, diffuser, exhausts, wing
  const brakeMat=new THREE.MeshStandardMaterial({color:0x550000, emissive:0xff0a0a, emissiveIntensity:0.6});
  const tl=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.07,1.5),brakeMat); tl.position.set(-2.33,0.78,0); body.add(tl);
  const diff=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.16,1.5),M.carbon); diff.position.set(-2.2,0.3,0); body.add(diff);
  const exGeo=new THREE.CylinderGeometry(0.055,0.055,0.25,12).rotateZ(Math.PI/2);
  const exhausts=[];
  for(const s of [-0.28,0.28]){ const ex=new THREE.Mesh(exGeo,M.chrome); ex.position.set(-2.32,0.32,s); body.add(ex); exhausts.push(ex.position.clone()); }
  const wing=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.04,1.7),M.carbon); wing.position.set(-2.05,1.18,0); wing.rotation.z=0.08; wing.castShadow=true; body.add(wing);
  for(const s of [-1,1]){ const post=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.26,0.04),M.carbon); post.position.set(-2.0,1.03,s*0.5); body.add(post);
    const end=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.2,0.02),M.carbon); end.position.set(-2.05,1.16,s*0.86); body.add(end); }

  // ----- interior (seen from cockpit cam) -----
  const interior=new THREE.Group(); body.add(interior);
  const dash=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.16,1.55),M.interior); dash.position.set(0.62,0.86,0); interior.add(dash);
  const dashTop=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.03,1.55),M.leather); dashTop.position.set(0.68,0.95,0); dashTop.rotation.z=-0.08; interior.add(dashTop);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.04,0.42),M.interior); hood.position.set(0.47,1.02,-0.38); interior.add(hood);   // binnacle
  // gauge cluster: canvas texture drawn by the game
  const gCanvas=document.createElement('canvas'); gCanvas.width=256; gCanvas.height=128;
  const gTex=new THREE.CanvasTexture(gCanvas); gTex.colorSpace=THREE.SRGBColorSpace;
  const gauge=new THREE.Mesh(new THREE.PlaneGeometry(0.36,0.18),new THREE.MeshBasicMaterial({map:gTex}));
  gauge.position.set(0.4,0.915,-0.38); gauge.rotation.y=-Math.PI/2; gauge.rotation.x=0; interior.add(gauge);
  // steering wheel
  const steer=new THREE.Group(); steer.position.set(0.3,0.86,-0.38); steer.rotation.z=0.5; steer.scale.setScalar(0.88); interior.add(steer);
  const swInner=new THREE.Group(); steer.add(swInner);
  const rimSW=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.022,10,32),M.leather); rimSW.rotation.y=Math.PI/2; swInner.add(rimSW);
  for(const r of [0,2.1,-2.1]){ const spk=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.16,0.035),M.carbon); spk.rotation.x=r; spk.position.set(0,-Math.cos(r)*0.08,Math.sin(r)*0.08); swInner.add(spk); }
  const swHub=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.04,16).rotateZ(Math.PI/2),M.carbon); swInner.add(swHub);
  const swMark=new THREE.Mesh(new THREE.BoxGeometry(0.025,0.03,0.02),new THREE.MeshBasicMaterial({color:0xffd32a})); swMark.position.set(0,0.17,0); swInner.add(swMark);
  // seats, console, floor
  for(const s of [-0.38,0.38]){ const seat=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.12,0.48),M.leather); seat.position.set(-0.45,0.45,s); interior.add(seat);
    const back=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.62,0.48),M.leather); back.position.set(-0.72,0.78,s); back.rotation.z=0.2; interior.add(back); }
  const cons=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.22,0.22),M.interior); cons.position.set(0.05,0.55,0); interior.add(cons);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(1.9,0.04,1.7),M.interior); floor.position.set(-0.25,0.585,0); interior.add(floor);

  // wheels: pivot (steer) -> spin
  const wheels=[]; const pivots=[];
  for(const [x,front] of [[CAR.a,true],[-CAR.b,false]]) for(const s of [-1,1]){
    const pivot=new THREE.Group(); pivot.position.set(x,CAR.wheelR,s*CAR.track); root.add(pivot);
    const w=wheel(); pivot.add(w); wheels.push({spin:w,pivot,front,side:s});
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,0.03,20).rotateX(Math.PI/2),M.disc); disc.position.z=-s*0.1; pivot.add(disc);
    const cal=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.16,0.05),M.caliper); cal.position.set(0.12,0.08,-s*0.08); pivot.add(cal);
    if(front) pivots.push(pivot);
  }
  // fake contact shadow (cheap, always on)
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(4.9,2.3),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false,opacity:0.75}));
  sh.rotation.x=-Math.PI/2; sh.position.y=0.035; root.add(sh);
  // nitro flames
  const flameMat=new THREE.MeshBasicMaterial({color:0x66b3ff,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false});
  const flames=exhausts.map(p=>{ const f=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.7,10).rotateZ(Math.PI/2),flameMat); f.position.set(p.x-0.45,p.y,p.z); f.visible=false; body.add(f); return f; });

  // body vertices for crash deformation
  const pos=lowerMesh.geometry.attributes.position; const orig=pos.array.slice();
  return { root, body, paint, brakeMat, wheels, pivots, steer:swInner, interior, gauge:{canvas:gCanvas,tex:gTex,ctx:gCanvas.getContext('2d')}, flames,
           lowerMesh, origPos:orig, color };
}

let _shadowTex=null;
function shadowTex(){
  if(_shadowTex) return _shadowTex;
  const c=document.createElement('canvas'); c.width=128; c.height=64; const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,32,6,64,32,62); gr.addColorStop(0,'rgba(0,0,0,.75)'); gr.addColorStop(.6,'rgba(0,0,0,.4)'); gr.addColorStop(1,'rgba(0,0,0,0)');
  g.save(); g.scale(1,0.5); g.translate(0,32); g.fillStyle=gr; g.fillRect(0,-32,128,128); g.restore();
  _shadowTex=new THREE.CanvasTexture(c); return _shadowTex;
}

// dent the body around a local impact point
export function dentCar(car, lx, lz, strength){
  const pos=car.lowerMesh.geometry.attributes.position; const a=pos.array; const r=0.9;
  // geometry is in extrude space: x=forward, y=up, z=side (same as body)
  let changed=false;
  for(let i=0;i<a.length;i+=3){ const dx=a[i]-lx, dz=a[i+2]-lz, d=Math.hypot(dx,dz); if(d<r){ const k=(1-d/r)*strength*0.08;
      const len=Math.hypot(a[i],a[i+2]*1.6)||1; a[i]-=a[i]/len*k; a[i+2]-=a[i+2]/len*k; a[i+1]-=k*0.3*(Math.random()); changed=true; } }
  // limit deformation relative to the original
  const o=car.origPos; for(let i=0;i<a.length;i++){ const lim=0.28; if(a[i]-o[i]>lim) a[i]=o[i]+lim; if(o[i]-a[i]>lim) a[i]=o[i]-lim; }
  if(changed){ pos.needsUpdate=true; car.lowerMesh.geometry.computeVertexNormals(); }
}
export function repairCar(car){ const pos=car.lowerMesh.geometry.attributes.position; pos.array.set(car.origPos); pos.needsUpdate=true; car.lowerMesh.geometry.computeVertexNormals(); }

export function drawGauges(car,rpm,kmh,gear,nitro,redline=7600){
  const g=car.gauge.ctx, w=256, h=128;
  g.fillStyle='#07080a'; g.fillRect(0,0,w,h);
  // rpm arc
  const cx=78, cy=72, R=52, a0=Math.PI*0.8, a1=Math.PI*2.2;
  g.lineWidth=7; g.strokeStyle='#22262c'; g.beginPath(); g.arc(cx,cy,R,a0,a1); g.stroke();
  const fr=Math.min(1,rpm/8000); g.strokeStyle=rpm>redline-600?'#ff3b3b':'#ffd32a'; g.beginPath(); g.arc(cx,cy,R,a0,a0+(a1-a0)*fr); g.stroke();
  g.strokeStyle='#ff3b3b'; g.lineWidth=3; g.beginPath(); g.arc(cx,cy,R+7,a0+(a1-a0)*(redline/8000),a1); g.stroke();
  const na=a0+(a1-a0)*fr; g.strokeStyle='#fff'; g.lineWidth=3; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(na)*(R-6),cy+Math.sin(na)*(R-6)); g.stroke();
  g.fillStyle='#fff'; g.font='bold 30px Bungee, Inter, sans-serif'; g.textAlign='center'; g.fillText(gear,cx,cy+12);
  g.font='10px Inter,sans-serif'; g.fillStyle='#8a929c'; g.fillText('x1000 rpm',cx,cy+34);
  // speed
  g.textAlign='right'; g.fillStyle='#fff'; g.font='bold 40px Bungee, Inter, sans-serif'; g.fillText(String(kmh),236,70);
  g.font='12px Inter,sans-serif'; g.fillStyle='#8a929c'; g.fillText('km/s',236,88);
  // nitro bar
  g.fillStyle='#1a2330'; g.fillRect(150,100,86,8); g.fillStyle='#4aa8ff'; g.fillRect(150,100,86*nitro,8);
  car.gauge.tex.needsUpdate=true;
}
