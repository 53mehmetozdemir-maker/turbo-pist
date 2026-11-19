// Vehicle dynamics: planar rigid body, bicycle model with Pacejka-style tyres,
// load transfer, engine torque curve, gearbox, brakes, handbrake, downforce,
// surface grip, wall collisions and damage.  World plane = (x, y); heading a,
// forward = (cos a, sin a), right = (-sin a, cos a).
import { CAR } from './car.js';

const G = 9.81;
const P = {
  mass: 1350, inertia: 2350, a: CAR.a, b: CAR.b, cgH: 0.44, r: CAR.wheelR,
  gears: [3.38, 2.36, 1.78, 1.39, 1.12, 0.92], reverse: 3.2, final: 3.85, eff: 0.88,
  idle: 950, redline: 7600, shiftUp: 7150, shiftDown: 3300, shiftTime: 0.16,
  brakeForce: 15500, brakeBias: 0.64, drag: 0.39, roll: 14, downforce: 0.7,
  Bf: 10.5, Br: 11.5, C: 1.6, muRear: 1.15,
};
// torque curve [rpm, Nm]
const TQ = [[0,200],[1000,260],[2500,390],[4000,490],[5200,530],[6200,515],[7000,470],[7600,420],[8000,300]];
function torqueAt(rpm){ for(let i=1;i<TQ.length;i++) if(rpm<=TQ[i][0]){ const [r0,t0]=TQ[i-1],[r1,t1]=TQ[i]; return t0+(t1-t0)*(rpm-r0)/(r1-r0); } return 0; }
const SURF = [ {mu:1.0, drag:0}, {mu:0.93, drag:0}, {mu:0.55, drag:3.2}, {mu:0.95, drag:0.3}, {mu:0.62, drag:1.6} ];   // asphalt, kerb, gravel, sidewalk(curb), grass
export const OPTS = { forceSurface: null, wet: false };
const pac = (s,B) => Math.sin(P.C*Math.atan(B*s));

export class Car {
  constructor(){ this.reset(0,0,0); this.manual=false; this.assists=true; }
  reset(x,y,a){
    Object.assign(this,{ x,y,a, vx:0, vy:0, yawRate:0, steer:0, gear:1, rpm:P.idle, shiftT:0, clutch:1,
      throttle:0, brake:0, hand:0, axPrev:0, ayPrev:0, nitro:1, nitroOn:false, damage:0, hint:-1,
      wheelSpin:[0,0,0,0], wheelAng:[0,0,0,0], slipF:0, slipR:0, spinR:0, surfF:0, surfR:0, lat:0,
      impact:0, impactAt:null, scrape:0, bump:0, bumpV:0, hitV:0, kerb:0, speed:0, vLong:0, vLat:0, pitch:0, rollA:0, reversing:false });
  }
  get kmh(){ return Math.round(Math.abs(this.vLong)*3.6); }
  gearLabel(){ return this.reversing ? 'R' : (this.speed<0.5 && this.throttle===0 && this.gear===1 ? 'N' : String(this.gear)); }
  shift(d){ if(this.reversing) { if(d>0){ this.reversing=false; this.gear=1; } return; }
    const g=this.gear+d; if(g<1 && Math.abs(this.vLong)<2){ this.reversing=true; return; }
    if(g>=1 && g<=P.gears.length && this.shiftT<=0){ this.gear=g; this.shiftT=P.shiftTime; } }

  step(dt, inp, others){
    const ca=Math.cos(this.a), sa=Math.sin(this.a);
    let vLong=this.vx*ca+this.vy*sa, vLat=-this.vx*sa+this.vy*ca;
    const speed=Math.hypot(this.vx,this.vy);
    // ---- driver inputs ----
    let thr=inp.gas, brk=inp.brake;
    // automatic: holding brake at standstill engages reverse; gas releases it
    if(!this.manual){
      if(!this.reversing && brk>0.5 && thr<0.1 && vLong<0.6) this.reversing=true;
      if(this.reversing && thr>0.1 && vLong>-0.6) this.reversing=false;
    }
    if(this.reversing){ const t=thr; thr=brk; brk=t; }
    this.throttle=thr; this.brake=brk; this.hand=inp.hand?1:0;
    // steering: speed-sensitive lock, rate-limited (keyboard) or direct (analog)
    const lock = 0.6/(1+speed*(this.assists?0.13:0.10));
    let target = inp.steer*lock;
    if(this.assists && speed>5){   // keep the front tyres near peak grip instead of past it
      const thetaF=Math.atan2(vLat+this.yawRate*P.a, Math.max(Math.abs(vLong),1));
      target=Math.max(thetaF-0.15,Math.min(thetaF+0.15,target));
    }
    if(inp.analog) this.steer += (target-this.steer)*Math.min(1,dt*14);
    else { const back=(Math.abs(target)<Math.abs(this.steer)||Math.sign(target)!==Math.sign(this.steer));
      const rate=Math.max(0.35,lock*(back?6:3.2)); const d=target-this.steer; this.steer+=Math.sign(d)*Math.min(Math.abs(d),rate*dt); }
    // damage pulls the steering a little
    const delta=this.steer + this.damage*0.0004;

    // ---- surfaces under each axle ----
    const fx=this.x+ca*P.a, fy=this.y+sa*P.a, rx=this.x-ca*P.b, ry=this.y-sa*P.b;
    this.surfF=OPTS.forceSurface??this.world.surface(fx,fy,this); this.surfR=OPTS.forceSurface??this.world.surface(rx,ry,this);
    const wetK=OPTS.wet?0.74:1; const muF=SURF[this.surfF].mu*wetK, muR=SURF[this.surfR].mu*P.muRear*wetK;
    this.kerb=(this.surfF===1||this.surfR===1)?1:0;
    if(this.prevSurfF!=null && this.prevSurfF!==this.surfF && (this.prevSurfF===3||this.surfF===3)) this.bumpV-=Math.min(2.5,speed*0.12); this.prevSurfF=this.surfF;
    if(this.prevSurfR!=null && this.prevSurfR!==this.surfR && (this.prevSurfR===3||this.surfR===3)) this.bumpV-=Math.min(2.5,speed*0.12); this.prevSurfR=this.surfR;

    // ---- engine & gearbox ----
    const ratio=(this.reversing?P.reverse:P.gears[this.gear-1])*P.final;
    const wheelRpm=Math.abs(vLong)/P.r*60/(2*Math.PI);
    let rpm=Math.max(P.idle, wheelRpm*ratio);
    if(this.shiftT>0) this.shiftT-=dt;
    if(!this.manual && !this.reversing && this.shiftT<=0){
      if(rpm>P.shiftUp && this.gear<P.gears.length && thr>0.2){ this.gear++; this.shiftT=P.shiftTime; }
      else if(this.gear>1){ const lower=wheelRpm*P.gears[this.gear-2]*P.final; if(rpm<P.shiftDown && lower<P.shiftUp-500){ this.gear--; this.shiftT=P.shiftTime*0.7; } }
    }
    // free-revving at standstill / clutch slip in 1st
    if(wheelRpm*ratio<P.idle+600) rpm = rpm + (P.idle+thr*3500 - rpm)*0.5;
    this.rpm += (Math.min(rpm,P.redline+150)-this.rpm)*Math.min(1,dt*20);
    this.nitroOn = inp.nitro && this.nitro>0 && thr>0.3 && !this.reversing;
    if(this.nitroOn) this.nitro=Math.max(0,this.nitro-dt/4.5); else this.nitro=Math.min(1,this.nitro+dt/30);
    let Te = thr*torqueAt(this.rpm) * (this.nitroOn?1.55:1) * (1-this.damage*0.0025);
    if(this.rpm>=P.redline) Te=0;                       // limiter
    Te -= (1-thr)*45*(this.rpm/7000);                   // engine braking
    let Fdrive = this.shiftT>0 ? 0 : Te*ratio*P.eff/P.r;
    if(this.reversing) Fdrive=-Fdrive;

    // ---- loads with longitudinal & lateral transfer ----
    const L=P.a+P.b, down=P.downforce*speed*speed;
    let Wf=P.mass*G*P.b/L - P.cgH/L*P.mass*this.axPrev + down*0.45;
    let Wr=P.mass*G*P.a/L + P.cgH/L*P.mass*this.axPrev + down*0.55;
    Wf=Math.max(800,Wf); Wr=Math.max(800,Wr);

    // ---- longitudinal forces ----
    const sgn = vLong>0.3?1: vLong<-0.3?-1:0;
    let Fbf = brk*P.brakeForce*P.brakeBias, Fbr = brk*P.brakeForce*(1-P.brakeBias);
    // ABS (assists) or lock-up limit
    const absK = this.assists?0.97:1.0;
    Fbf=Math.min(Fbf, muF*Wf*absK); Fbr=Math.min(Fbr, muR*Wr*absK);
    let lockF = !this.assists && brk*P.brakeForce*P.brakeBias > muF*Wf;
    if(this.hand){ Fbr=Math.max(Fbr, muR*Wr*0.95); }
    // rear: drive minus brake, limited by grip (traction control when assists on)
    let Fxr = Fdrive - Fbr*sgn;
    const maxR = muR*Wr*(this.assists?0.88:1.0);
    const spin = Math.abs(Fdrive)>maxR && !this.hand;
    this.spinR = spin ? Math.min(1,(Math.abs(Fdrive)-maxR)/maxR) : 0;
    if(Math.abs(Fxr)>muR*Wr) Fxr=Math.sign(Fxr)*muR*Wr;
    let Fxf = -Fbf*sgn;
    if(sgn===0){ Fxf=0; if(Math.abs(Fdrive)<1) Fxr=0; }

    // ---- lateral forces (tyre slip angles) ----
    const vLatF=vLat+this.yawRate*P.a, vLatR=vLat-this.yawRate*P.b;
    const cd=Math.cos(delta), sd=Math.sin(delta);
    const wLong=vLong*cd+vLatF*sd, wLat=-vLong*sd+vLatF*cd;
    const minV=3.0;
    const slipF=Math.atan2(wLat, Math.max(Math.abs(wLong),minV));
    const slipR=Math.atan2(vLatR, Math.max(Math.abs(vLong),minV));
    let FyF=-muF*Wf*pac(slipF,P.Bf);
    let FyR=-muR*Wr*pac(slipR,P.Br);
    // friction circle
    const uF=Math.min(1,Math.abs(Fxf)/(muF*Wf)), uR=Math.min(1,Math.abs(Fxr)/(muR*Wr));
    FyF*=Math.sqrt(1-uF*uF)*(lockF?0.3:1); FyR*=Math.sqrt(1-uR*uR*0.92);
    if(this.hand) FyR*=0.38;
    if(spin) FyR*=(1-0.55*this.spinR);
    this.slipF=slipF; this.slipR=slipR;

    // ---- body frame force sum ----
    let Fx = Fxr + Fxf*cd - FyF*sd;
    let Fy = FyR + Fxf*sd + FyF*cd;
    // aero drag + rolling + gravel drag
    Fx -= P.drag*vLong*Math.abs(vLong) + P.roll*vLong;
    Fy -= P.drag*0.6*vLat*Math.abs(vLat);
    const gravel=(SURF[this.surfF].drag+SURF[this.surfR].drag)/2;
    if(gravel>0 && speed>0.1){ Fx -= gravel*P.mass*vLong/speed; Fy -= gravel*P.mass*vLat/speed; }
    const torque = P.a*(FyF*cd + Fxf*sd) - P.b*FyR;

    // ---- integrate (world frame) ----
    const ax=Fx/P.mass, ay=Fy/P.mass;
    this.axPrev += (ax-this.axPrev)*Math.min(1,dt*8); this.ayPrev += (ay-this.ayPrev)*Math.min(1,dt*8);
    this.vx += (ax*ca - ay*sa)*dt; this.vy += (ax*sa + ay*ca)*dt;
    this.yawRate += torque/P.inertia*dt;
    // stability control (assists): pull yaw toward the driver's intent, not while handbraking
    if(this.hand) this.escFade=0; else this.escFade=Math.min(1,(this.escFade||0)+dt*0.8);
    if(this.assists && speed>6){
      let yawDes = vLong*delta/(L+0.0022*vLong*vLong); const yawMax=0.92*Math.min(muF,muR)*G*(1+down/(P.mass*G))/Math.max(speed,1); yawDes=Math.max(-yawMax,Math.min(yawMax,yawDes));
      const err=this.yawRate-yawDes, beta=Math.atan2(vLat,Math.max(Math.abs(vLong),1));
      if(Math.abs(err)>0.08 || Math.abs(beta)>0.08) this.yawRate -= err*Math.min(1,dt*4.5)*this.escFade;
    }
    // low speed stabilisation (no creeping, no spinning on the spot)
    if(speed<1.5 && thr<0.05){ const k=Math.exp(-dt*(brk>0||this.hand?12:2.5)); this.vx*=k; this.vy*=k; }
    if(speed<4){ this.yawRate*=Math.exp(-dt*(4-speed)*1.6); }
    this.a += this.yawRate*dt;
    this.x += this.vx*dt; this.y += this.vy*dt;

    // ---- walls ----
    this.impact=0; this.scrape=Math.max(0,this.scrape-dt*3); this.hitV=0;
    this.collideWalls(dt);
    // one damage event per crash (cooldown), scaled by impact speed
    this.hitCool=Math.max(0,(this.hitCool||0)-dt);
    if(this.hitV>4 && this.hitCool<=0){ this.damage=Math.min(100,this.damage+Math.pow(this.hitV-4,1.3)*0.9); this.hitCool=0.4; }
    if(others) for(const o of others) this.collideCar(o);

    // ---- bookkeeping ----
    const c2=Math.cos(this.a), s2=Math.sin(this.a);
    this.vLong=this.vx*c2+this.vy*s2; this.vLat=-this.vx*s2+this.vy*c2; this.speed=Math.hypot(this.vx,this.vy);
    const wv=this.vLong/P.r;
    for(let i=0;i<4;i++){ let w=wv; if(i>=2){ if(this.hand && Math.abs(this.vLong)>1) w=0; else if(spin) w+=Math.sign(Fdrive)*this.spinR*60; } if(lockF && i<2) w=0; this.wheelSpin[i]=w; this.wheelAng[i]+=w*dt; }
    // suspension bounce (visual)
    this.bumpV += (-this.bump*180 - this.bumpV*14)*dt; this.bump += this.bumpV*dt;
    // body pitch/roll (visual)
    // sprung body: damped springs so the nose dives and rebounds, the body leans and settles
    const kP=95, cP=11, kR=80, cR=9;
    this.pitchV=(this.pitchV||0)+((-this.axPrev*0.014)-this.pitch)*kP*dt-(this.pitchV||0)*cP*dt; this.pitch+=this.pitchV*dt;
    this.rollV=(this.rollV||0)+((this.ayPrev*0.018)-this.rollA)*kR*dt-(this.rollV||0)*cR*dt; this.rollA+=this.rollV*dt;
    this.pitch=Math.max(-0.07,Math.min(0.07,this.pitch)); this.rollA=Math.max(-0.08,Math.min(0.08,this.rollA));
    // road texture: tiny vibration growing with speed, stronger on kerbs/gravel
    this.rough=(this.kerb?0.012:0)+((this.surfF===2||this.surfF===4)?0.02:0)+speed*0.00006;
  }

  corners(){ const ca=Math.cos(this.a), sa=Math.sin(this.a), hl=2.2, hw=0.92;
    return [[hl,-hw],[hl,hw],[-hl,-hw],[-hl,hw],[0,-hw],[0,hw],[hl+0.05,0],[-hl-0.05,0]].map(([lx,lz])=>({lx,lz,x:this.x+ca*lx-sa*lz,y:this.y+sa*lx+ca*lz})); }

  collideWalls(dt){ this.world.collide(this); }
  // resolve a contact at body point c (world x,y; local lx,lz) penetrating along n by pen
  contact(c,nx,ny,pen){
    this.x-=nx*pen; this.y-=ny*pen;
    const rx=c.x-this.x, ry=c.y-this.y;
    const pvx=this.vx-this.yawRate*ry, pvy=this.vy+this.yawRate*rx;
    const vn=pvx*nx+pvy*ny; if(vn<=0) return;
    const e=0.22, mu=0.35, rn=rx*ny-ry*nx, invM=1/P.mass+rn*rn/P.inertia, j=(1+e)*vn/invM;
    const tx=-ny, ty=nx, vt=pvx*tx+pvy*ty; const jt=Math.max(-mu*j,Math.min(mu*j,-vt/(1/P.mass+((rx*ty-ry*tx)**2)/P.inertia)));
    const Jx=-j*nx+jt*tx, Jy=-j*ny+jt*ty;
    this.vx+=Jx/P.mass; this.vy+=Jy/P.mass; this.yawRate+=(rx*Jy-ry*Jx)/P.inertia;
    if(vn>this.impact){ this.impact=vn; this.impactAt={lx:c.lx,lz:c.lz}; }
    if(vn>this.hitV) this.hitV=vn;
    this.scrape=Math.min(1,this.scrape+Math.abs(vt)*0.02);
  }
  collideCar(o){
    // two circles per car (front & rear) against the other car's two circles
    const ca=Math.cos(this.a), sa=Math.sin(this.a), oa=Math.cos(o.a), osa=Math.sin(o.a), R=1.05;
    const mine=[[1.1],[-1.1]].map(([d])=>[this.x+ca*d,this.y+sa*d,d]);
    const theirs=[[1.1],[-1.1]].map(([d])=>[o.x+oa*d,o.y+osa*d]);
    for(const m of mine) for(const t of theirs){
      const dx=m[0]-t[0], dy=m[1]-t[1], d=Math.hypot(dx,dy); if(d>=2*R||d<1e-4) continue;
      const nx=dx/d, ny=dy/d, pen=2*R-d; this.x+=nx*pen*0.5; this.y+=ny*pen*0.5;
      const rvx=this.vx-(o.vx||0), rvy=this.vy-(o.vy||0), vn=rvx*nx+rvy*ny;
      if(vn<0){ const j=-(1.3)*vn*0.5; this.vx+=nx*j; this.vy+=ny*j; this.yawRate+=(m[2]*(-sa*nx+ca*ny))*j*0.25;
        if(-vn>this.impact){ this.impact=-vn; this.impactAt={lx:Math.sign(m[2])*2,lz:0}; } if(-vn>this.hitV) this.hitV=-vn; }
    }
  }
}
export { P as CAR_PARAMS };
