import { Peer } from 'peerjs';
// Peer-to-peer rooms over WebRTC (PeerJS). The first player to open a room code
// becomes host and relays everyone's "presence" (a small state object) to all.
//
// Protokol sürümü (PROTO): mesajlara yalnızca alan EKLENİR, hiçbir alan silinmez/anlamı değişmez; böylece
// eski ve yeni sürüm aynı odada oynayabilir, farkı oyuncuya "sayfayı yenile" diye söyleriz (main.js).
// Uyumsuz (eski sürümün anlayamayacağı) bir değişiklik gerekirse PROTO_ANA artırılır: oda ön eki değişir,
// eski ve yeni sürüm birbirinin odasına hiç düşmez.
export const PROTO=3;          // 1: Aşama 4 öncesi (pv alanı yok) · 2: pv, misafir→host trafik darbesi, paket efektleri · 3: araç kimlikleri (ti), darbe kimlikle (H25)
const PROTO_ANA=1;
// Oda kimliği ön eki. Canlı: 'turbopist-v3-' (değişmedi: önbellekte eski sürümü olan oyuncular da aynı odaya
// düşsün). Önizleme derlemesi VITE_ODA_ONEK=onizleme- verir: canlı ve önizleme oyuncuları asla aynı odaya düşmez.
const PREFIX='turbopist-v3-'+(PROTO_ANA>1?'p'+PROTO_ANA+'-':'')+(import.meta.env.VITE_ODA_ONEK||'');
export const ODA_ONEK=PREFIX;

// ICE (bağlantı kurma) sunucuları. TURN bilgisi Cloudflare Worker'dan gelir (worker/turn.js);
// API anahtarı orada gizli durur, oyunun koduna girmez. Worker yoksa/cevap vermezse sadece STUN:
// aynı ağdaki ya da çoğu ev ağındaki oyuncular yine bağlanır, sadece zor ağlarda (bazı mobil
// operatörler) bağlantı kurulamayabilir.
const STUN=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.relay.metered.ca:80'}];
const TURN_URL=import.meta.env.VITE_TURN_URL||'';
let iceOnbellek=null, iceZaman=0;
export async function iceSunucular(){
  if(iceOnbellek && performance.now()-iceZaman<20*60*1000) return iceOnbellek;
  if(!TURN_URL) return STUN;
  try{
    const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),4000);
    const r=await fetch(TURN_URL,{signal:ctl.signal,credentials:'omit'}); clearTimeout(t);
    const l=r.ok?await r.json():null;
    if(Array.isArray(l) && l.length && l.every(s=>s&&s.urls)){ iceOnbellek=l; iceZaman=performance.now(); return l; }
  }catch(e){}
  return STUN;
}
// Test kancası: testler yerel bir PeerJS sunucusu verebilir (tests/baseline/mp.mjs). Oyuncuda tanımsız.
const sunucu=()=>window.__tpPeerSunucu||{};

function merge(obj,patch){ for(const k in patch){ if(patch[k]===null) delete obj[k]; else obj[k]=patch[k]; } return obj; }

export class Net {
  constructor(onPeers,onLost,toast){
    this.onPeers=onPeers; this.onLost=onLost; this.toast=toast||(()=>{});
    this.peer=null; this.isHost=false; this.myId=null; this.hostConn=null; this.conns=new Map();
    this.map={}; this.mine={}; this.pending={}; this.dirty=false; this.ping=null; this.peers=[];
    this.tick=0; this.seq=0; this.lastHostSeq=-1; this.onExtra=null;
    setInterval(()=>this.pump(),33);
  }
  get available(){ return typeof Peer==='function'; }
  get online(){ return !!this.peer; }
  get hostId(){ return this.isHost?this.myId:(this.hostConn?this.hostConn.peer:null); }
  // host -> everyone: extra messages (e.g. traffic state)
  sendAll(obj){ if(!this.isHost) return; for(const c of this.conns.values()) if(c.open){ try{ c.send(obj); }catch(e){} } }
  // misafir -> host: ek mesajlar (ör. trafik aracına çarpma). Eski host bilmediği türü yok sayar.
  sendHost(obj){ if(this.isHost||!this.hostConn||!this.hostConn.open) return; try{ this.hostConn.send(Object.assign({t:'x'},obj)); }catch(e){} }
  rebuild(){ this.peers=Object.keys(this.map).sort().map(id=>({id, me:id===this.myId, p:this.map[id]})); this.onPeers(this.peers); }
  set(patch){
    if(!this.peer) return; merge(this.mine,patch);
    if(this.isHost){ this.map[this.myId]={...this.mine}; this.dirty=true; } else merge(this.pending,patch);
  }
  pump(){
    if(!this.peer) return; this.tick++; const full=this.tick%15===0;
    if(this.isHost){
      if(!this.dirty && !full) return; this.dirty=false; this.rebuild();
      const msg={t:'m',s:++this.seq,m:this.map};
      for(const c of this.conns.values()) if(c.open){ try{ c.send(msg); }catch(e){} }
    } else if(this.hostConn && this.hostConn.open){
      try{
        if(full){ this.hostConn.send({t:'p',s:++this.seq,d:this.mine}); this.hostConn.send({t:'ping',c:performance.now()}); this.pending={}; }
        else if(Object.keys(this.pending).length){ this.hostConn.send({t:'p',s:++this.seq,d:this.pending}); this.pending={}; }
      }catch(e){}
    }
  }
  hostSetup(c){
    if(this.conns.size>=7){ c.on('open',()=>c.close()); return; }
    this.conns.set(c.peer,c); let last=-1;
    c.on('data',d=>{
      if(!d||typeof d!=='object') return;
      if(d.t==='ping'){ try{ c.send({t:'pong',c:d.c}); }catch(e){} return; }
      if(d.t==='x'){ this.onExtra&&this.onExtra(d,c.peer); return; }
      if(d.t==='p' && d.d && typeof d.d==='object'){ if(typeof d.s==='number'){ if(d.s<=last) return; last=d.s; } this.map[c.peer]=merge(this.map[c.peer]||{},d.d); this.dirty=true; }
    });
    const gone=()=>{ this.conns.delete(c.peer); delete this.map[c.peer]; this.dirty=true; };
    c.on('close',gone); c.on('error',gone); c.on('open',()=>{ this.dirty=true; });
  }
  becomeHost(id,ICE){
    return new Promise((res,rej)=>{ const p=new Peer(id,{debug:0,config:ICE,...sunucu()}); let done=false;
      p.on('open',myId=>{ done=true; this.peer=p; this.isHost=true; this.myId=myId; p.on('connection',c=>this.hostSetup(c)); res('host'); });
      p.on('error',err=>{ if(!done){ done=true; p.destroy(); rej(err); } else if(err.type!=='peer-unavailable') this.toast('Bağlantı sorunu: '+err.type); });
      p.on('disconnected',()=>{ try{ p.reconnect(); }catch(e){} });
    });
  }
  becomeClient(hostId,ICE){
    return new Promise((res,rej)=>{ const p=new Peer({debug:0,config:ICE,...sunucu()}); let done=false;
      const fail=e=>{ if(!done){ done=true; try{p.destroy();}catch(_){} rej(e); } };
      const to=setTimeout(()=>fail({type:'zaman aşımı'}),15000);
      p.on('error',e=>{ if(!done) fail(e); else this.toast('Bağlantı sorunu: '+e.type); });
      p.on('open',id=>{
        const c=p.connect(hostId,{serialization:'json',reliable:false}); this.lastHostSeq=-1;
        c.on('open',()=>{ clearTimeout(to); done=true; this.peer=p; this.isHost=false; this.myId=id; this.hostConn=c; res('client'); });
        c.on('data',d=>{
          if(!d||typeof d!=='object') return;
          if(d.t==='pong' && typeof d.c==='number'){ this.ping=Math.round(performance.now()-d.c); return; }
          if(d.t==='x'){ this.onExtra&&this.onExtra(d); return; }
          if(d.t==='m' && d.m && typeof d.m==='object'){ if(typeof d.s==='number'){ if(d.s<=this.lastHostSeq) return; this.lastHostSeq=d.s; }
            this.map=d.m; if(this.myId) this.map[this.myId]=Object.assign({},this.map[this.myId],this.mine); this.rebuild(); }
        });
        c.on('close',()=>{ if(this.hostConn===c){ this.toast('Oda kurucusu ayrıldı'); this.leave(); this.onLost&&this.onLost(); } });
        c.on('error',()=>{});
      });
    });
  }
  async join(code){
    this.map={}; this.mine={}; this.pending={}; this.conns.clear(); this.ping=null;
    const id=PREFIX+code.toLowerCase(), ICE={iceServers:await iceSunucular()};
    try{ return await this.becomeHost(id,ICE); }
    catch(e){ if(e && e.type==='unavailable-id') return await this.becomeClient(id,ICE); throw e; }
  }
  leave(){ const p=this.peer; this.peer=null; this.hostConn=null; this.conns.clear(); this.map={}; this.peers=[]; this.isHost=false; if(p){ try{p.destroy();}catch(e){} } }
}
