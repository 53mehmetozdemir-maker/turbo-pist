// Cars built by lofting super-ellipse cross-sections along the length.
// Local axes: +X forward, +Y up, +Z right.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CAR = { length: 4.5, width: 1.9, a: 1.35, b: 1.25, track: 0.82, wheelR: 0.34 };

const lerp=(a,b,t)=>a+(b-a)*t;
const sp=(v,e)=>Math.sign(v)*Math.pow(Math.abs(v),e);
// piecewise-linear profile through [x,v] points (sorted by x)
function prof(pts){ return x=>{ if(x<=pts[0][0]) return pts[0][1]; for(let i=1;i<pts.length;i++) if(x<=pts[i][0]){ const t=(x-pts[i-1][0])/(pts[i][0]-pts[i-1][0]); const s=t*t*(3-2*t); return lerp(pts[i-1][1],pts[i][1],s); } return pts[pts.length-1][1]; }; }

// ring(x) -> {w, wTop, y0, y1, n}; returns BufferGeometry
export function loft(x0,x1,stations,segs,ring,{caps=true,thetaFrom=0,thetaTo=Math.PI*2,closed=true}={}){
  const pos=[], idx=[]; const rs=closed?segs:segs+1;
  for(let s=0;s<=stations;s++){ const x=lerp(x0,x1,s/stations), r=ring(x);
    for(let k=0;k<rs;k++){ const th=lerp(thetaFrom,thetaTo,k/segs); const c=Math.cos(th), si=Math.sin(th);
      const yc=(r.y0+r.y1)/2, hy=(r.y1-r.y0)/2; const y=yc+hy*sp(si,2/r.n); const t=(y-r.y0)/Math.max(1e-4,r.y1-r.y0);
      const w=r.wTop!=null?lerp(r.w,r.wTop,Math.max(0,Math.min(1,t))):r.w; pos.push(x, y, w*sp(c,2/r.n)); } }
  for(let s=0;s<stations;s++) for(let k=0;k<segs;k++){ const k1=closed?(k+1)%segs:k+1; const a=s*rs+k,b=s*rs+k1,c=(s+1)*rs+k,d=(s+1)*rs+k1; idx.push(a,c,b, b,c,d); }
  if(caps && closed){ for(const [s,front] of [[0,false],[stations,true]]){ const r=ring(lerp(x0,x1,s/stations)); const ci=pos.length/3; pos.push(lerp(x0,x1,s/stations),(r.y0+r.y1)/2,0);
      for(let k=0;k<segs;k++){ const a=s*rs+k,b=s*rs+(k+1)%segs; if(front) idx.push(ci,b,a); else idx.push(ci,a,b); } } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// box/beam between two points
function beam(p,q,th,mat){ const a=new THREE.Vector3(...p), b=new THREE.Vector3(...q); const len=a.distanceTo(b);
  const m=new THREE.Mesh(new THREE.BoxGeometry(len,th,th),mat); m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),b.clone().sub(a).normalize()); return m; }

function beamGeo(p,q,th){ const a=new THREE.Vector3(...p), b=new THREE.Vector3(...q); const g=new THREE.BoxGeometry(a.distanceTo(b),th,th);
  const m=new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),b.clone().sub(a).normalize()), new THREE.Vector3(1,1,1)); g.applyMatrix4(m); return g; }
function ghPoint(S,x,th,side,out=0.012){ const G=S.gh; const y0=S.top(x)-0.06, y1=G.top(x), yc=(y0+y1)/2, hy=(y1-y0)/2, n=3.4;
  const y=yc+hy*sp(Math.sin(th),2/n); const t=Math.max(0,Math.min(1,(y-y0)/(y1-y0))); const w=lerp(G.wb,G.wt,t)+out; return [x,y+out*Math.sin(th),side*w*sp(Math.cos(th),2/n)]; }
function pillarGeos(S){ const G=S.gh, out=[], L=G.x1-G.x0; for(const s of [-1,1]){
    out.push(beamGeo(ghPoint(S,G.x1-0.03,0.08,s),ghPoint(S,G.x1-L*0.34,1.0,s),0.06));
    const xb=(G.x0+G.x1)/2-0.15; out.push(beamGeo(ghPoint(S,xb,0.05,s),ghPoint(S,xb,1.0,s),0.07));
    out.push(beamGeo(ghPoint(S,G.x0+0.05,0.08,s),ghPoint(S,G.x0+L*0.22,1.0,s),0.1)); }
  return out; }
// ---------- body shapes ----------
const ARCH_R=0.44;
function archCut(x,a,b,base){ let y=base; for(const xw of [a,-b]){ const d=x-xw; if(Math.abs(d)<ARCH_R){ y=Math.max(y,0.34+Math.sqrt(ARCH_R*ARCH_R-d*d)*0.98); } } return y; }
export const SHAPES = {
  sport:{ L:4.56, a:1.35, b:1.25, track:0.82, wheelR:0.34,
    w:prof([[-2.28,0.62],[-2.2,0.86],[-1.5,0.96],[-1.0,0.94],[0.6,0.92],[1.5,0.9],[2.1,0.82],[2.28,0.55]]),
    top:prof([[-2.28,0.66],[-2.22,0.86],[-1.9,0.93],[-1.35,0.96],[0.85,0.93],[1.55,0.79],[2.1,0.68],[2.28,0.46]]),
    bot:x=>archCut(x,1.35,1.25,x>2.05?0.24+(x-2.05)*0.5:x<-2.1?0.26+(-2.1-x)*0.9:0.22),
    gh:{x0:-1.45,x1:0.98, top:prof([[-1.45,0.95],[-0.75,1.23],[0.1,1.27],[0.98,0.94]]), wb:0.83, wt:0.6}, n:3.2 },
  sedan:{ L:4.7, a:1.4, b:1.35, track:0.8, wheelR:0.33,
    w:prof([[-2.35,0.7],[-2.25,0.86],[-1.6,0.9],[1.6,0.9],[2.2,0.84],[2.35,0.62]]),
    top:prof([[-2.35,0.78],[-2.25,0.95],[-1.75,1.0],[-1.25,1.0],[0.9,0.97],[1.6,0.86],[2.2,0.78],[2.35,0.6]]),
    bot:x=>archCut(x,1.4,1.35,0.27),
    gh:{x0:-1.3,x1:0.95, top:prof([[-1.3,0.99],[-0.65,1.42],[0.3,1.45],[0.95,0.98]]), wb:0.82, wt:0.66}, n:3.6 },
  suv:{ L:4.75, a:1.45, b:1.35, track:0.84, wheelR:0.38,
    w:prof([[-2.38,0.78],[-2.3,0.92],[2.2,0.92],[2.38,0.75]]),
    top:prof([[-2.38,1.0],[-2.3,1.12],[1.0,1.12],[1.7,1.05],[2.25,0.98],[2.38,0.8]]),
    bot:x=>archCut(x,1.45,1.35,0.38),
    gh:{x0:-2.2,x1:1.05, top:prof([[-2.2,1.12],[-2.05,1.72],[0.4,1.76],[1.05,1.13]]), wb:0.88, wt:0.76}, n:4.2 },
  hatch:{ L:4.0, a:1.25, b:1.2, track:0.78, wheelR:0.31,
    w:prof([[-2.0,0.78],[-1.92,0.86],[1.8,0.86],[2.0,0.62]]),
    top:prof([[-2.0,0.95],[-1.92,1.0],[0.75,0.95],[1.4,0.84],[1.9,0.76],[2.0,0.6]]),
    bot:x=>archCut(x,1.25,1.2,0.27),
    gh:{x0:-1.85,x1:0.8, top:prof([[-1.85,1.0],[-1.7,1.45],[0.1,1.47],[0.8,0.96]]), wb:0.8, wt:0.66}, n:3.8 },
};
function bodyGeo(S,detail=1){
  const st=Math.round(64*detail), sg=Math.round(28*detail);
  return loft(-S.L/2,S.L/2,st,sg,x=>{ const y1=S.top(x), y0=Math.min(S.bot(x),y1-0.08); return {w:S.w(x),y0,y1,n:S.n}; });
}
function glassGeo(S,detail=1){ const G=S.gh;
  return loft(G.x0,G.x1,Math.round(26*detail),Math.round(22*detail),x=>({w:G.wb,wTop:G.wt,y0:S.top(x)-0.06,y1:G.top(x),n:3.4}),{caps:true});
}
function roofGeo(S,detail=1){ const G=S.gh; const m=0.17*(G.x1-G.x0);
  return loft(G.x0+m*1.15,G.x1-m*1.75,Math.round(16*detail),Math.round(14*detail),x=>({w:G.wb+0.012,wTop:G.wt+0.012,y0:S.top(x)-0.06,y1:G.top(x)+0.012,n:3.4}),{caps:false,closed:false,thetaFrom:Math.PI*0.27,thetaTo:Math.PI*0.73});
}

// ---------- shared materials ----------
const M={};
function mats(){
  if(M.tire) return M;
  M.tire=new THREE.MeshStandardMaterial({color:0x121212,roughness:0.88});
  M.rim=new THREE.MeshStandardMaterial({color:0xc9ccd2,metalness:1,roughness:0.22});
  M.black=new THREE.MeshStandardMaterial({color:0x0b0c0f,roughness:0.6,metalness:0.2});
  M.trim=new THREE.MeshStandardMaterial({color:0x151619,roughness:0.45,metalness:0.4});
  M.glass=new THREE.MeshPhysicalMaterial({color:0x0d1620,metalness:0.1,roughness:0.03,transparent:true,opacity:0.62,clearcoat:1,envMapIntensity:1.6});
  M.chrome=new THREE.MeshStandardMaterial({color:0xe5e5e5,metalness:1,roughness:0.1});
  M.interior=new THREE.MeshStandardMaterial({color:0x1b1b1e,roughness:0.9});
  M.leather=new THREE.MeshStandardMaterial({color:0x2b1d18,roughness:0.65});
  M.head=new THREE.MeshStandardMaterial({color:0x9aa2aa,emissive:0xfff2d8,emissiveIntensity:0.25,roughness:0.05,metalness:0.6});
  M.disc=new THREE.MeshStandardMaterial({color:0x777777,metalness:0.9,roughness:0.4});
  M.caliper=new THREE.MeshStandardMaterial({color:0xd8262f,roughness:0.4});
  M.well=new THREE.MeshStandardMaterial({color:0x050505,roughness:1,side:THREE.BackSide});
  return M;
}
function wheelGroup(R,detail=1){
  const g=new THREE.Group();
  const tg=new THREE.CylinderGeometry(R,R,0.26,Math.round(30*detail)); tg.rotateX(Math.PI/2);
  const tire=new THREE.Mesh(tg,M.tire); tire.castShadow=true; g.add(tire);
  const side=new THREE.TorusGeometry(R*0.86,R*0.13,6,Math.round(26*detail)); // sidewall bulge
  for(const z of [-0.13,0.13]){ const t=new THREE.Mesh(side,M.tire); t.position.z=z; g.add(t); }
  const rg=new THREE.CylinderGeometry(R*0.7,R*0.7,0.27,24); rg.rotateX(Math.PI/2); g.add(new THREE.Mesh(rg,M.black));
  for(let k=0;k<5;k++){ const s=new THREE.Mesh(new THREE.BoxGeometry(0.055,R*1.32,0.03),M.rim); s.rotation.z=k*Math.PI*2/5; s.position.z=0.135; g.add(s); const s2=s.clone(); s2.position.z=-0.135; g.add(s2); }
  const lip=new THREE.TorusGeometry(R*0.69,0.018,6,28); for(const z of [-0.135,0.135]){ const l=new THREE.Mesh(lip,M.rim); l.position.z=z; g.add(l); }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.29,10).rotateX(Math.PI/2),M.chrome));
  return g;
}

export function buildCar(color, opts={}){
  mats(); const S=SHAPES.sport;
  const paint=new THREE.MeshPhysicalMaterial({color,metalness:0.6,roughness:0.28,clearcoat:1,clearcoatRoughness:0.03,envMapIntensity:1.25});
  const root=new THREE.Group(), body=new THREE.Group(); root.add(body);
  const lowerMesh=new THREE.Mesh(bodyGeo(S),paint); lowerMesh.castShadow=true; lowerMesh.receiveShadow=true; body.add(lowerMesh);
  const glass=new THREE.Mesh(glassGeo(S),M.glass); body.add(glass);
  const roof=new THREE.Mesh(roofGeo(S),paint); roof.castShadow=true; body.add(roof);
  for(const pg of pillarGeos(S)){ const pm=new THREE.Mesh(pg,paint); pm.castShadow=true; body.add(pm); }
  const G=S.gh;
  for(const s of [-1,1]){
    // mirrors
    const mir=new THREE.Mesh(new THREE.SphereGeometry(0.1,12,8),paint); mir.scale.set(0.9,0.6,1.1); mir.position.set(0.72,1.0,s*1.0); body.add(mir);
    const arm=beam([0.72,0.97,s*0.88],[0.72,0.98,s*0.96],0.03,M.trim); body.add(arm);
    // side skirt + door line + handle
    const sk=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.06,0.05),M.trim); sk.position.set(-0.05,0.25,s*0.95); body.add(sk);
    const dl=new THREE.Mesh(new THREE.BoxGeometry(0.012,0.5,0.01),M.black); dl.position.set(0.85,0.66,s*0.93); body.add(dl);
    const dl2=dl.clone(); dl2.position.x=-0.55; body.add(dl2);
    const h=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.025,0.02),M.chrome); h.position.set(-0.3,0.82,s*0.945); body.add(h);
    // side intake
    const it=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.14,0.02),M.black); it.position.set(-0.95,0.55,s*0.955); body.add(it);
    // headlight cluster
    const hl=new THREE.Mesh(new THREE.SphereGeometry(0.2,16,8),M.head); hl.scale.set(0.95,0.17,0.8); hl.position.set(2.04,0.7,s*0.6); hl.rotation.z=-0.32; body.add(hl);
    const drl=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.02,0.32),M.head); drl.position.set(2.15,0.63,s*0.62); drl.rotation.y=s*0.35; body.add(drl);
    // wheel wells (dark inside the arches)
    for(const xw of [S.a,-S.b]){ const wl=new THREE.Mesh(new THREE.CylinderGeometry(ARCH_R,ARCH_R,0.4,20,1,true).rotateX(Math.PI/2),M.well); wl.position.set(xw,0.34,s*0.78); body.add(wl); }
  }
  // grille, splitter, plate, diffuser, lights, exhausts, wing
  const gr=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.16,1.05),M.black); gr.position.set(2.22,0.42,0); body.add(gr);
  const spl=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.03,1.7),M.trim); spl.position.set(2.12,0.22,0); body.add(spl);
  const brakeMat=new THREE.MeshStandardMaterial({color:0x4a0000,emissive:0xff0a0a,emissiveIntensity:0.6,roughness:0.2});
  for(const s of [-1,1]){ const tl=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.08,0.5),brakeMat); tl.position.set(-2.24,0.82,s*0.55); tl.rotation.y=-s*0.25; body.add(tl); }
  const tlb=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.025,0.7),brakeMat); tlb.position.set(-2.27,0.84,0); body.add(tlb);
  const plate=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.11,0.5),new THREE.MeshStandardMaterial({color:0xf2f2f2,roughness:0.5})); plate.position.set(-2.27,0.55,0); body.add(plate);
  const df=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.14,1.4),M.trim); df.position.set(-2.12,0.3,0); body.add(df);
  const exG=new THREE.CylinderGeometry(0.055,0.055,0.22,14).rotateZ(Math.PI/2); const exhausts=[];
  for(const s of [-0.35,0.35]){ const ex=new THREE.Mesh(exG,M.chrome); ex.position.set(-2.25,0.3,s); body.add(ex); exhausts.push(ex.position.clone()); }
  const wing=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.035,1.6),M.trim); wing.position.set(-2.0,1.13,0); wing.rotation.z=0.07; wing.castShadow=true; body.add(wing);
  for(const s of [-1,1]){ body.add(beam([-1.95,0.95,s*0.5],[-2.0,1.12,s*0.5],0.035,M.trim)); }

  // ----- interior (cockpit cam) -----
  const interior=new THREE.Group(); body.add(interior);
  const dash=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.17,1.6),M.interior); dash.position.set(0.66,0.84,0); interior.add(dash);
  const dashTop=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.03,1.6),M.leather); dashTop.position.set(0.7,0.935,0); dashTop.rotation.z=-0.08; interior.add(dashTop);
  const binn=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.04,0.42),M.interior); binn.position.set(0.47,1.0,-0.38); interior.add(binn);
  const gCanvas=document.createElement('canvas'); gCanvas.width=256; gCanvas.height=128;
  const gTex=new THREE.CanvasTexture(gCanvas); gTex.colorSpace=THREE.SRGBColorSpace;
  const gauge=new THREE.Mesh(new THREE.PlaneGeometry(0.36,0.18),new THREE.MeshBasicMaterial({map:gTex,toneMapped:false}));
  gauge.position.set(0.42,0.905,-0.38); gauge.rotation.y=-Math.PI/2; interior.add(gauge);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(0.22,0.13),new THREE.MeshBasicMaterial({color:0x10304a,toneMapped:false})); screen.position.set(0.5,0.86,0.02); screen.rotation.y=-Math.PI/2; interior.add(screen);
  const steer=new THREE.Group(); steer.position.set(0.3,0.86,-0.38); steer.rotation.z=0.5; steer.scale.setScalar(0.88); interior.add(steer);
  const sw=new THREE.Group(); steer.add(sw);
  const rimSW=new THREE.Mesh(new THREE.TorusGeometry(0.17,0.022,10,32),M.leather); rimSW.rotation.y=Math.PI/2; sw.add(rimSW);
  for(const r of [0,2.1,-2.1]){ const spk=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.16,0.035),M.trim); spk.rotation.x=r; spk.position.set(0,-Math.cos(r)*0.08,Math.sin(r)*0.08); sw.add(spk); }
  sw.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.04,16).rotateZ(Math.PI/2),M.trim));
  const mk=new THREE.Mesh(new THREE.BoxGeometry(0.025,0.03,0.02),new THREE.MeshBasicMaterial({color:0xffd32a})); mk.position.set(0,0.17,0); sw.add(mk);
  for(const s of [-0.38,0.38]){ const seat=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.12,0.48),M.leather); seat.position.set(-0.45,0.42,s); interior.add(seat);
    const back=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.65,0.48),M.leather); back.position.set(-0.74,0.76,s); back.rotation.z=0.2; interior.add(back); }
  const cons=new THREE.Mesh(new THREE.BoxGeometry(0.9,0.22,0.22),M.interior); cons.position.set(0.05,0.52,0); interior.add(cons);
  const floor=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.04,1.7),M.interior); floor.position.set(-0.2,0.3,0); interior.add(floor);
  for(const s of [-1,1]){ const door=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.6,0.05),M.interior); door.position.set(-0.25,0.62,s*0.84); interior.add(door);
    const sill=new THREE.Mesh(new THREE.BoxGeometry(2.0,0.04,0.12),M.leather); sill.position.set(-0.25,0.93,s*0.82); interior.add(sill); }
  const head=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.2),M.interior); head.rotation.x=Math.PI/2; head.position.set(-0.3,G.top(-0.3)-0.03,0); interior.add(head);

  // wheels
  const wheels=[], pivots=[];
  for(const [x,front] of [[S.a,true],[-S.b,false]]) for(const s of [-1,1]){
    const pivot=new THREE.Group(); pivot.position.set(x,S.wheelR,s*S.track); root.add(pivot);
    const w=wheelGroup(S.wheelR); pivot.add(w); wheels.push({spin:w,pivot,front,side:s});
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.21,0.03,20).rotateX(Math.PI/2),M.disc); disc.position.z=-s*0.09; pivot.add(disc);
    const cal=new THREE.Mesh(new THREE.BoxGeometry(0.13,0.17,0.05),M.caliper); cal.position.set(0.13,0.07,-s*0.07); pivot.add(cal);
    if(front) pivots.push(pivot);
  }
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(5.0,2.4),new THREE.MeshBasicMaterial({map:shadowTex(),transparent:true,depthWrite:false,opacity:0.8}));
  sh.rotation.x=-Math.PI/2; sh.position.y=0.04; root.add(sh);
  const flameMat=new THREE.MeshBasicMaterial({color:0x66b3ff,transparent:true,opacity:0.85,blending:THREE.AdditiveBlending,depthWrite:false});
  const flames=exhausts.map(p=>{ const f=new THREE.Mesh(new THREE.ConeGeometry(0.07,0.7,10).rotateZ(Math.PI/2),flameMat); f.position.set(p.x-0.45,p.y,p.z); f.visible=false; body.add(f); return f; });
  const pos=lowerMesh.geometry.attributes.position;
  return { root, body, paint, brakeMat, wheels, pivots, steer:sw, interior, gauge:{canvas:gCanvas,tex:gTex,ctx:gCanvas.getContext('2d')}, flames, lowerMesh, origPos:pos.array.slice(), color };
}

// ---------- instanced low-poly cars for traffic & parking ----------
// returns {add(type,colorHex)->id, set(id,x,y,a,brake,lights), hide(id), meshes}
export function makeFleet(scene,max,quality){
  mats(); const det=quality==='low'?0.3:0.4;
  const kinds=['sedan','suv','hatch'];
  const bodyMat=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0.55,roughness:0.35,clearcoat:0.8,clearcoatRoughness:0.08,envMapIntensity:1.1});
  const lampMat=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
  const fleetGlass=new THREE.MeshPhysicalMaterial({color:0x0a1016,metalness:0.2,roughness:0.05,transparent:true,opacity:0.88,clearcoat:1,envMapIntensity:1.4});
  const sets={};
  for(const k of kinds){ const S=SHAPES[k];
    const body=mergeGeometries([bodyGeo(S,det),roofGeo(S,det),...pillarGeos(S).map(g=>g.toNonIndexed())].map(g=>{ const n=g.index?g.toNonIndexed():g; n.deleteAttribute('uv'); return n; }));
    const glass=glassGeo(S,det*0.8);
    const parts=[];
    for(const [x] of [[S.a],[-S.b]]) for(const s of [-1,1]){ const w=new THREE.CylinderGeometry(S.wheelR,S.wheelR,0.24,12).rotateX(Math.PI/2); w.translate(x,S.wheelR,s*(S.track+0.02)); parts.push(w);
      const hub=new THREE.CylinderGeometry(S.wheelR*0.62,S.wheelR*0.62,0.02,10).rotateX(Math.PI/2); hub.translate(x,S.wheelR,s*(S.track+0.15)); parts.push(hub); }
    parts.push(new THREE.BoxGeometry(0.06,0.14,1.0).translate(S.L/2-0.02,0.45,0));          // grille
    parts.push(new THREE.BoxGeometry(0.06,0.12,0.5).translate(-S.L/2+0.02,0.5,0));          // plate area
    for(const s of [-1,1]) for(const xw of [S.a,-S.b]) parts.push(new THREE.CylinderGeometry(ARCH_R,ARCH_R,0.14,12,1,true).rotateX(Math.PI/2).translate(xw,0.34,s*0.66));
    const dark=mergeGeometries(parts.map(g=>{ const n=g.index?g.toNonIndexed():g; n.deleteAttribute('uv'); return n; }));
    const lamps=[]; for(const s of [-1,1]){ lamps.push(new THREE.BoxGeometry(0.05,0.08,0.34).translate(S.L/2-0.08,S.top(S.L/2-0.1)-0.1,s*0.6)); }
    const rear=[]; for(const s of [-1,1]){ rear.push(new THREE.BoxGeometry(0.05,0.09,0.36).translate(-S.L/2+0.03,S.top(-S.L/2+0.1)-0.1,s*0.6)); }
    const mk=(g,m)=>{ const im=new THREE.InstancedMesh(g,m,max); im.count=0; im.castShadow=quality==='high'&&(m===bodyMat); im.receiveShadow=false; im.frustumCulled=false; im.userData.fleet=true; scene.add(im); return im; };
    sets[k]={ S, body:mk(body,bodyMat), glass:mk(glass,fleetGlass), dark:mk(dark,M.black), head:mk(mergeGeometries(lamps),lampMat), tail:mk(mergeGeometries(rear),lampMat), n:0 };
  }
  const items=[]; const m4=new THREE.Matrix4(), q=new THREE.Quaternion(), up=new THREE.Vector3(0,1,0), pv=new THREE.Vector3(), one=new THREE.Vector3(1,1,1), col=new THREE.Color();
  const HEAD_ON=new THREE.Color(1.6,1.5,1.2), HEAD_OFF=new THREE.Color(0.75,0.75,0.72), TAIL_ON=new THREE.Color(2.4,0.08,0.05), TAIL_OFF=new THREE.Color(0.45,0.03,0.03), TAIL_NIGHT=new THREE.Color(1.1,0.04,0.03);
  const fleet={ kinds, items, night:false,
    add(kind,color){ const s=sets[kind]; const i=s.n++; for(const k of ['body','glass','dark','head','tail']) s[k].count=s.n; s.body.setColorAt(i,col.set(color)); items.push({kind,i}); return items.length-1; },
    set(id,x,y,a,brake,visible=true){ const it=items[id], s=sets[it.kind];
      if(!visible) m4.makeScale(0,0,0); else { q.setFromAxisAngle(up,-a); pv.set(x,0,y); m4.compose(pv,q,one); }
      for(const k of ['body','glass','dark','head','tail']) s[k].setMatrixAt(it.i,m4);
      s.tail.setColorAt(it.i, brake?TAIL_ON:(fleet.night?TAIL_NIGHT:TAIL_OFF)); s.head.setColorAt(it.i, fleet.night?HEAD_ON:HEAD_OFF); },
    commit(){ for(const s of Object.values(sets)){ for(const k of ['body','glass','dark','head','tail']) s[k].instanceMatrix.needsUpdate=true; if(s.body.instanceColor) s.body.instanceColor.needsUpdate=true; if(s.tail.instanceColor) s.tail.instanceColor.needsUpdate=true; if(s.head.instanceColor) s.head.instanceColor.needsUpdate=true; } },
    shape(kind){ return sets[kind].S; }
  };
  return fleet;
}

let _shadowTex=null;
function shadowTex(){
  if(_shadowTex) return _shadowTex;
  const c=document.createElement('canvas'); c.width=128; c.height=64; const g=c.getContext('2d');
  const gr=g.createRadialGradient(64,32,6,64,32,62); gr.addColorStop(0,'rgba(0,0,0,.8)'); gr.addColorStop(.6,'rgba(0,0,0,.4)'); gr.addColorStop(1,'rgba(0,0,0,0)');
  g.save(); g.scale(1,0.5); g.translate(0,32); g.fillStyle=gr; g.fillRect(0,-32,128,128); g.restore();
  _shadowTex=new THREE.CanvasTexture(c); return _shadowTex;
}
export function dentCar(car,lx,lz,strength){
  const pos=car.lowerMesh.geometry.attributes.position, a=pos.array, r=0.9; let changed=false;
  for(let i=0;i<a.length;i+=3){ const dx=a[i]-lx, dz=a[i+2]-lz, d=Math.hypot(dx,dz); if(d<r){ const k=(1-d/r)*strength*0.08;
      const len=Math.hypot(a[i],a[i+2]*1.6)||1; a[i]-=a[i]/len*k; a[i+2]-=a[i+2]/len*k; a[i+1]-=k*0.3*Math.random(); changed=true; } }
  const o=car.origPos; for(let i=0;i<a.length;i++){ const lim=0.25; if(a[i]-o[i]>lim) a[i]=o[i]+lim; if(o[i]-a[i]>lim) a[i]=o[i]-lim; }
  if(changed){ pos.needsUpdate=true; car.lowerMesh.geometry.computeVertexNormals(); }
}
export function repairCar(car){ const pos=car.lowerMesh.geometry.attributes.position; pos.array.set(car.origPos); pos.needsUpdate=true; car.lowerMesh.geometry.computeVertexNormals(); }
export function drawGauges(car,rpm,kmh,gear,nitro,redline=7600){
  const g=car.gauge.ctx, w=256, h=128; g.fillStyle='#07080a'; g.fillRect(0,0,w,h);
  const cx=78, cy=72, R=52, a0=Math.PI*0.8, a1=Math.PI*2.2;
  g.lineWidth=7; g.strokeStyle='#22262c'; g.beginPath(); g.arc(cx,cy,R,a0,a1); g.stroke();
  const fr=Math.min(1,rpm/8000); g.strokeStyle=rpm>redline-600?'#ff3b3b':'#ffd32a'; g.beginPath(); g.arc(cx,cy,R,a0,a0+(a1-a0)*fr); g.stroke();
  g.strokeStyle='#ff3b3b'; g.lineWidth=3; g.beginPath(); g.arc(cx,cy,R+7,a0+(a1-a0)*(redline/8000),a1); g.stroke();
  const na=a0+(a1-a0)*fr; g.strokeStyle='#fff'; g.lineWidth=3; g.beginPath(); g.moveTo(cx,cy); g.lineTo(cx+Math.cos(na)*(R-6),cy+Math.sin(na)*(R-6)); g.stroke();
  g.fillStyle='#fff'; g.font='bold 30px Bungee, Inter, sans-serif'; g.textAlign='center'; g.fillText(gear,cx,cy+12);
  g.font='10px Inter,sans-serif'; g.fillStyle='#8a929c'; g.fillText('x1000 rpm',cx,cy+34);
  g.textAlign='right'; g.fillStyle='#fff'; g.font='bold 40px Bungee, Inter, sans-serif'; g.fillText(String(kmh),236,70);
  g.font='12px Inter,sans-serif'; g.fillStyle='#8a929c'; g.fillText('km/s',236,88);
  g.fillStyle='#1a2330'; g.fillRect(150,100,86,8); g.fillStyle='#4aa8ff'; g.fillRect(150,100,86*nitro,8);
  car.gauge.tex.needsUpdate=true;
}
