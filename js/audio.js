// Synthesised car audio: engine (rpm/throttle), tyre squeal, wind, gravel, kerb rumble, impacts, beeps.
export class CarAudio {
  constructor(){ this.ctx=null; this.muted=false; }
  start(){
    if(this.ctx) { if(this.ctx.state==='suspended') this.ctx.resume(); return; }
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    const c=this.ctx=new AC();
    this.master=c.createGain(); this.master.gain.value=this.muted?0:0.55; this.master.connect(c.destination);
    const comp=c.createDynamicsCompressor(); comp.connect(this.master); this.out=comp;
    // engine: 3 oscillators -> waveshaper -> lowpass -> gain
    this.eng=c.createGain(); this.eng.gain.value=0;
    this.engLP=c.createBiquadFilter(); this.engLP.type='lowpass'; this.engLP.frequency.value=900; this.engLP.Q.value=1.5;
    const shaper=c.createWaveShaper(); shaper.curve=(()=>{ const n=1024,a=new Float32Array(n); for(let i=0;i<n;i++){ const x=i/n*2-1; a[i]=Math.tanh(x*2.5); } return a; })();
    this.oscs=[['sawtooth',1,0.5],['sawtooth',2,0.25],['square',0.5,0.35],['triangle',4,0.08]].map(([type,mul,g])=>{ const o=c.createOscillator(); o.type=type; const gg=c.createGain(); gg.gain.value=g; o.connect(gg); gg.connect(shaper); o.start(); return {o,mul}; });
    shaper.connect(this.engLP); this.engLP.connect(this.eng); this.eng.connect(this.out);
    // noise source
    const buf=c.createBuffer(1,c.sampleRate*2,c.sampleRate), d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const noise=()=>{ const s=c.createBufferSource(); s.buffer=buf; s.loop=true; s.start(); return s; };
    const chain=(type,f,q)=>{ const src=noise(), fl=c.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q; const g=c.createGain(); g.gain.value=0; src.connect(fl); fl.connect(g); g.connect(this.out); return {g,fl}; };
    this.squeal=chain('bandpass',1100,6); this.squeal2=chain('bandpass',2300,8);
    this.wind=chain('lowpass',500,0.5);
    this.gravel=chain('lowpass',260,1);
    this.rumble=chain('lowpass',140,2); this.rumbleLfo=0;
    this.noiseBuf=buf;
  }
  setMuted(m){ this.muted=m; if(this.master) this.master.gain.setTargetAtTime(m?0:0.55,this.ctx.currentTime,0.05); }
  update(car,dt,active){
    if(!this.ctx) return; const t=this.ctx.currentTime, k=0.04;
    if(!active){ this.eng.gain.setTargetAtTime(0,t,0.2); for(const ch of [this.squeal,this.squeal2,this.wind,this.gravel,this.rumble]) ch.g.gain.setTargetAtTime(0,t,0.1); return; }
    const f0=car.rpm/60*3;   // V6-ish firing frequency
    for(const {o,mul} of this.oscs) o.frequency.setTargetAtTime(f0*mul,t,0.015);
    const thr=car.throttle;
    this.engLP.frequency.setTargetAtTime(500+thr*2600+car.rpm*0.25,t,k);
    this.eng.gain.setTargetAtTime(0.10+thr*0.22+(car.nitroOn?0.08:0),t,k);
    const slip=Math.max(Math.abs(car.slipR)-0.09,Math.abs(car.slipF)-0.12,0)*4 + car.spinR + (car.hand&&car.speed>3?0.6:0);
    const sq=car.speed>3 && car.surfR!==2 ? Math.min(0.5,slip*0.45) : 0;
    this.squeal.g.gain.setTargetAtTime(sq,t,0.05); this.squeal2.g.gain.setTargetAtTime(sq*0.4,t,0.05);
    this.squeal.fl.frequency.setTargetAtTime(900+Math.min(600,car.speed*8),t,0.1);
    this.wind.g.gain.setTargetAtTime(Math.min(0.35,car.speed*car.speed*0.00006),t,0.2);
    this.gravel.g.gain.setTargetAtTime((car.surfF===2||car.surfR===2)?Math.min(0.6,car.speed*0.03):0,t,0.08);
    this.rumbleLfo+=dt*car.speed/0.9; const rb=car.kerb&&car.speed>2?(0.25+0.25*Math.sign(Math.sin(this.rumbleLfo*Math.PI*2))):0;
    this.rumble.g.gain.setTargetAtTime(rb*0.9,t,0.01);
  }
  impact(strength){
    if(!this.ctx||strength<1.5) return; const c=this.ctx, t=c.currentTime;
    const s=c.createBufferSource(); s.buffer=this.noiseBuf; const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=600+strength*80;
    const g=c.createGain(); g.gain.setValueAtTime(Math.min(1,strength*0.08),t); g.gain.exponentialRampToValueAtTime(0.001,t+0.35+strength*0.02);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t,Math.random()); s.stop(t+0.8);
    const o=c.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(90,t); o.frequency.exponentialRampToValueAtTime(40,t+0.25);
    const g2=c.createGain(); g2.gain.setValueAtTime(Math.min(0.8,strength*0.06),t); g2.gain.exponentialRampToValueAtTime(0.001,t+0.3); o.connect(g2); g2.connect(this.out); o.start(t); o.stop(t+0.35);
  }
  beep(high){ if(!this.ctx) return; const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain(); o.type='square'; o.frequency.value=high?880:440;
    g.gain.setValueAtTime(0.18,t); g.gain.exponentialRampToValueAtTime(0.001,t+(high?0.6:0.25)); o.connect(g); g.connect(this.out); o.start(t); o.stop(t+0.7); }
  horn(id,on,vol=1){
    if(!this.ctx) return; this.horns=this.horns||{}; let h=this.horns[id];
    if(on && !h){ const c=this.ctx, g=c.createGain(); g.gain.value=0; g.connect(this.out);
      const os=[415,523].map(f=>{ const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=f; const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1800; o.connect(lp); lp.connect(g); o.start(); return o; });
      h=this.horns[id]={g,os}; }
    if(h){ h.g.gain.setTargetAtTime(on?0.16*vol:0,this.ctx.currentTime,0.02); if(!on){ const hh=h; delete this.horns[id]; setTimeout(()=>{ hh.os.forEach(o=>o.stop()); hh.g.disconnect(); },200); } }
  }
  shiftBlip(){ if(!this.ctx) return; this.eng.gain.setTargetAtTime(0.04,this.ctx.currentTime,0.01); }
}
