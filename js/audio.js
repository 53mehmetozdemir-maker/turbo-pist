// Synthesised car audio: engine (rpm/throttle), tyre squeal, wind, gravel, kerb rumble, impacts, beeps.

// ---- combustion engine synthesiser (AudioWorklet) ----
// Each cylinder firing is an exhaust pressure pulse at its real crank angle; pulses run through a tuned exhaust pipe
// (feedback comb = pipe resonance) per bank, a muffler low-pass, intake noise and a soft limiter. Firing orders and pipe
// lengths come from the real engines, so a flat-plane V8 screams, a diesel four clatters and a Ducati V4 barks unevenly.
const WORKLET = `
class EngineProc extends AudioWorkletProcessor {
  static get parameterDescriptors(){ return [{name:'rpm',defaultValue:900,minValue:0,maxValue:20000},{name:'load',defaultValue:0,minValue:0,maxValue:1},{name:'gain',defaultValue:0,minValue:0,maxValue:2},{name:'cut',defaultValue:0,minValue:0,maxValue:1}]; }
  constructor(o){ super(); this.set(o.processorOptions||{}); this.port.onmessage=e=>this.set(e.data); this.th=0; this.hp=0; this.hx=0; this.inl=0; this.seed=12345; }
  rnd(){ this.seed=(this.seed*1664525+1013904223)>>>0; return this.seed/4294967296*2-1; }
  set(c){ this.c=Object.assign({ev:[0,180,360,540],bank:[0,0,0,0],tau:0.0015,noise:0.3,pipe:[0.0025,0.0028],fb:0.55,bright:4000,drive:1.5,clatter:0,intake:0.15,jitter:0.06,sub:0.25},c);
    const nb=this.c.pipe.length; this.B=[]; for(let b=0;b<nb;b++) this.B.push({exc:0,nz:0,buf:new Float32Array(4096),i:0,lp:0,lp2:0}); this.tk=0; }
  process(_,outs,P){ const out=outs[0]; const L=out[0].length; const c=this.c, B=this.B, sr=sampleRate;
    const rpm=P.rpm[0], load=P.load[0], gain=P.gain[0], cut=P.cut[0]>0.5;
    const dth=6*rpm/sr, dec=Math.exp(-1/(c.tau*sr*(1+0.6*(1-load)))), ndec=Math.exp(-1/(0.0006*sr)), tdec=Math.exp(-1/(0.00025*sr));
    const cut1=Math.min(0.99,2*Math.PI*Math.min(sr*0.45,c.bright*(0.45+0.55*load)*(0.7+rpm/12000))/sr), cut2=Math.min(0.99,2*Math.PI*(c.bright*1.8)/sr);
    const amp=(0.35+0.65*load)*(cut?0.05:1), lens=c.pipe.map(p=>Math.max(8,Math.min(4000,Math.round(p*sr))));
    for(let n=0;n<L;n++){
      const t0=this.th, t1=t0+dth; this.th=t1>=720?t1-720:t1;
      for(let k=0;k<c.ev.length;k++){ let e=c.ev[k]; if((e>t0&&e<=t1)||(t1>=720&&e+720>t0&&e+720<=t1)){ const b=B[c.bank[k]%B.length]; const a=amp*(1+c.jitter*this.rnd()); b.exc+=a; b.nz+=a*c.noise; this.tk+=c.clatter*a; } }
      let s=0;
      for(let q=0;q<B.length;q++){ const b=B[q]; const src=b.exc+b.nz*this.rnd(); b.exc*=dec; b.nz*=ndec;
        const j=(b.i-lens[q]+4096)&4095; const y=src+c.fb*b.buf[j]; b.buf[b.i]=Math.max(-4,Math.min(4,y)); b.i=(b.i+1)&4095;
        b.lp+=cut1*(y-b.lp); b.lp2+=cut2*(b.lp-b.lp2); s+=b.lp2; }
      // diesel injector / valvetrain clatter: tiny bright ticks at each firing
      const tick=this.tk*this.rnd(); this.tk*=tdec; s+=tick*0.5;
      // intake hiss rising with load and rpm
      this.inl+=0.08*(this.rnd()-this.inl); s+=this.inl*c.intake*load*(rpm/8000);
      // DC block + soft limiter
      const hp=s-this.hx+0.995*this.hp; this.hx=s; this.hp=hp;
      const v=Math.tanh(hp*c.drive)/c.drive*gain; for(let ch=0;ch<out.length;ch++) out[ch][n]=v; }
    return true; }
}
registerProcessor('engine-proc', EngineProc);`;
// engine voicing per real powertrain
export const VOICES = {
  v8:     { ev: [0, 90, 180, 270, 360, 450, 540, 630], bank: [0, 1, 0, 1, 0, 1, 0, 1], tau: 0.0011, noise: 0.22, pipe: [0.0019, 0.0022], fb: 0.58, bright: 5200, drive: 1.6, intake: 0.35, jitter: 0.04 },   // Ferrari 458: 4.5 flat-plane V8, 9000 rpm scream
  turbo:  { ev: [0, 90, 180, 270, 360, 450, 540, 630], bank: [0, 1, 0, 1, 0, 1, 0, 1], tau: 0.0017, noise: 0.3, pipe: [0.0027, 0.0031], fb: 0.5, bright: 2600, drive: 1.9, intake: 0.2, jitter: 0.07 },   // F40: 2.9 twin-turbo flat-plane V8, muffled by the turbines
  v4:     { ev: [0, 90, 290, 380], bank: [0, 1, 0, 1], tau: 0.0014, noise: 0.35, pipe: [0.0016, 0.0019], fb: 0.6, bright: 4800, drive: 2.1, intake: 0.4, jitter: 0.05 },   // Ducati Desmosedici Stradale "Twin Pulse" firing 0-90-290-380
  diesel: { ev: [0, 180, 360, 540], bank: [0, 0, 0, 0], tau: 0.0026, noise: 0.45, pipe: [0.0042], fb: 0.45, bright: 1500, drive: 1.4, clatter: 0.9, intake: 0.1, jitter: 0.09 },   // VW 2.0 TDI inline four
  i4:     { ev: [0, 180, 360, 540], bank: [0, 0, 0, 0], tau: 0.0015, noise: 0.3, pipe: [0.003], fb: 0.5, bright: 3500, drive: 1.6, intake: 0.25, jitter: 0.05 },
};
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
    this.oscs=[['sawtooth',1,0.42],['square',0.5,0.32],['sawtooth',2,0.2],['triangle',0.25,0.28],['sine',3,0.06]].map(([type,mul,g])=>{ const o=c.createOscillator(); o.type=type; const gg=c.createGain(); gg.gain.value=g; o.connect(gg); gg.connect(shaper); o.start(); return {o,mul,gg,base:g}; });
    // slow wobble = uneven V8 firing ("burble")
    this.lfo=c.createOscillator(); this.lfo.frequency.value=7; this.lfoG=c.createGain(); this.lfoG.gain.value=0; this.lfo.connect(this.lfoG); this.lfo.start();
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
    this.lfoG.connect(this.eng.gain);
    this.exhaust=chain('bandpass',420,1.2);    // exhaust roar
    this.rain=chain('highpass',2500,0.4); this.spray=chain('bandpass',1800,0.8);
    this.lastThr=0; this.popCool=0; this.lastGear=1;
    if(c.audioWorklet){ const url=URL.createObjectURL(new Blob([WORKLET],{type:'application/javascript'}));
      c.audioWorklet.addModule(url).then(()=>{ this.wk=new AudioWorkletNode(c,'engine-proc',{numberOfInputs:0,outputChannelCount:[1],processorOptions:VOICES.v8}); this.wkG=c.createGain(); this.wkG.gain.value=1; this.wk.connect(this.wkG); this.wkG.connect(this.out); this.wkVoice=null; }).catch(e=>console.warn('engine worklet',e)); }
  }
  setMuted(m){ this.muted=m; if(this.master) this.master.gain.setTargetAtTime(m?0:0.55,this.ctx.currentTime,0.05); }
  update(car,dt,active){
    if(!this.ctx) return; const t=this.ctx.currentTime, k=0.04;
    if(!active && this.wk) this.wk.parameters.get('gain').setTargetAtTime(0,t,0.1);
    if(!active){ this.eng.gain.setTargetAtTime(0,t,0.2); this.exhaust.g.gain.setTargetAtTime(0,t,0.2); this.spray.g.gain.setTargetAtTime(0,t,0.2); this.rain.g.gain.setTargetAtTime(this.wet?0.06:0,t,0.3); this.lfoG.gain.setTargetAtTime(0,t,0.1); for(const ch of [this.squeal,this.squeal2,this.wind,this.gravel,this.rumble]) ch.g.gain.setTargetAtTime(0,t,0.1); return; }
    const pr=this.profile||{cyl:8};
    if(this.wk && pr.kind==='ev') this.wk.parameters.get('gain').setTargetAtTime(0,t,0.1);
    if(pr.kind==='ev'){ // electric: inverter whine + gear hum rising with motor speed, no exhaust
      const w=car.rpm/60; for(const {o,mul,gg,base} of this.oscs){ o.frequency.setTargetAtTime(w*(mul*2+1)*0.9+40,t,0.03); gg.gain.setTargetAtTime(base*(mul>=2?0.5:0.15),t,0.1); }
      const ld=Math.max(car.throttle,0.15); this.engLP.frequency.setTargetAtTime(1200+w*6,t,k); this.eng.gain.setTargetAtTime(0.02+ld*0.07*Math.min(1,car.speed/4+0.2),t,k);
      this.lfoG.gain.setTargetAtTime(0,t,0.1); this.exhaust.g.gain.setTargetAtTime(0,t,0.1); this.popBurst=0; this.lastThr=car.throttle; this._tail(car,dt,t); return; }
    const voice=VOICES[pr.kind]||VOICES.v8;
    if(this.wk){ if(this.wkVoice!==voice){ this.wkVoice=voice; this.wk.port.postMessage(voice); }
      const P=this.wk.parameters, thr=car.throttle, load=Math.min(1,thr*(0.55+0.45*Math.min(1,car.rpm/(pr.kind==='diesel'?3500:7000))));
      P.get('rpm').setTargetAtTime(Math.max(300,car.rpm),t,0.012); P.get('load').setTargetAtTime(load,t,0.03);
      P.get('gain').setTargetAtTime((pr.kind==='diesel'?0.75:0.6)*(0.55+0.45*load)+(car.nitroOn?0.12:0),t,0.03);
      P.get('cut').setValueAtTime(car.cutEvent && car.cutEvent!==this.lastCutW ? 1 : 0, t); if(car.cutEvent!==this.lastCutW){ this.lastCutW=car.cutEvent; P.get('cut').setValueAtTime(0,t+0.035); }
      for(const {gg} of this.oscs) gg.gain.setTargetAtTime(0,t,0.1); this.eng.gain.setTargetAtTime(0,t,0.1); this.lfoG.gain.setTargetAtTime(0,t,0.1);
      this.exhaust.g.gain.setTargetAtTime(0.01+load*0.04,t,0.05); this.exhaust.fl.frequency.setTargetAtTime(200+car.rpm*0.09,t,0.05);
    } else for(const {gg,base} of this.oscs) gg.gain.setTargetAtTime(base,t,0.1);
    const f0=car.rpm/60*(pr.cyl/2);   // firing frequency (4-stroke)
    for(const {o,mul} of this.oscs) o.frequency.setTargetAtTime(f0*mul,t,0.012);
    const thr=car.throttle, load=thr*(0.6+0.4*Math.min(1,car.rpm/7000));
    if(!this.wk){ this.engLP.frequency.setTargetAtTime(420+load*3200+car.rpm*0.3,t,k);
    this.eng.gain.setTargetAtTime(0.08+load*0.24+(car.nitroOn?0.08:0),t,k);
    this.lfoG.gain.setTargetAtTime(car.rpm<2500?0.035:0.008,t,0.1); this.lfo.frequency.setTargetAtTime(car.rpm/60*0.5,t,0.1);
    this.exhaust.fl.frequency.setTargetAtTime(200+car.rpm*0.09,t,0.05); this.exhaust.g.gain.setTargetAtTime(0.03+load*0.16,t,0.05); }
    if(pr.kind==='turbo'){ const boost=Math.max(0,Math.min(1,(car.rpm-2800)/2200))*thr; this.turbo=this.turbo||(()=>{ const c=this.ctx,o=c.createOscillator(),g=c.createGain(); o.type='sine'; g.gain.value=0; o.connect(g); g.connect(this.out); o.start(); return {o,g}; })();
      this.turbo.o.frequency.setTargetAtTime(2500+car.rpm*0.6,t,0.1); this.turbo.g.gain.setTargetAtTime(boost*0.03,t,0.15);
      if(this.lastThr>0.6 && thr<0.1 && car.rpm>3500) this.blowoff(); }
    // lift-off pops & crackles at high rpm
    this.popCool-=dt; if(this.lastThr>0.6 && thr<0.1 && car.rpm>4200) this.popBurst=0.9; this.lastThr=thr;
    if(this.popBurst>0){ this.popBurst-=dt; if(this.popCool<=0 && Math.random()<0.35){ this.pop(0.5+Math.random()*0.6); this.popCool=0.05+Math.random()*0.1; } }
    if(car.gear!==this.lastGear && car.gear>this.lastGear && thr>0.5) this.pop(0.35); this.lastGear=car.gear;
    // rev limiter: every ignition cut = a sharp bark and a dip in the engine note
    if(car.cutEvent && car.cutEvent!==this.lastCut){ this.lastCut=car.cutEvent; this.pop(0.7); if(!this.wk){ this.eng.gain.cancelScheduledValues(t); this.eng.gain.setValueAtTime(0.05,t); this.eng.gain.linearRampToValueAtTime(0.32,t+0.05); } }
    this._tail(car,dt,t);
  }
  _tail(car,dt,t){
    // rain & wet tyre spray
    this.rain.g.gain.setTargetAtTime(this.wet?0.09:0,t,0.3); this.spray.g.gain.setTargetAtTime(this.wet?Math.min(0.22,car.speed*0.006):0,t,0.1);
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
  blowoff(){ if(!this.ctx) return; const c=this.ctx,t=c.currentTime; const s=c.createBufferSource(); s.buffer=this.noiseBuf; const f=c.createBiquadFilter(); f.type='highpass'; f.frequency.value=2500; const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.45); s.connect(f); f.connect(g); g.connect(this.out); s.start(t,Math.random()); s.stop(t+0.5); }
  pop(v){ if(!this.ctx) return; const c=this.ctx,t=c.currentTime; const s=c.createBufferSource(); s.buffer=this.noiseBuf; const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=300+Math.random()*500; f.Q.value=0.8;
    const g=c.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.5*v,t+0.004); g.gain.exponentialRampToValueAtTime(0.0001,t+0.07+Math.random()*0.05);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t,Math.random()*1.5); s.stop(t+0.2); }
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
