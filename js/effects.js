// Tyre smoke / dust / sparks (GPU points) and skid marks (ring-buffer mesh).
import * as THREE from 'three';

export class Particles {
  constructor(scene,max=600){
    this.max=max; this.i=0;
    const g=new THREE.BufferGeometry();
    this.pos=new Float32Array(max*3); this.col=new Float32Array(max*3); this.size=new Float32Array(max); this.alpha=new Float32Array(max);
    this.vel=new Float32Array(max*3); this.life=new Float32Array(max); this.maxLife=new Float32Array(max); this.grow=new Float32Array(max); this.a0=new Float32Array(max); this.grav=new Float32Array(max);
    g.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color',new THREE.BufferAttribute(this.col,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size',new THREE.BufferAttribute(this.size,1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha',new THREE.BufferAttribute(this.alpha,1).setUsage(THREE.DynamicDrawUsage));
    const mat=new THREE.ShaderMaterial({ transparent:true, depthWrite:false, vertexColors:true,
      uniforms:{ scale:{value:600}, lit:{value:1}, maxPx:{value:400} },
      vertexShader:`attribute float size; attribute float alpha; varying float vA; varying vec3 vC; uniform float scale;
        uniform float maxPx; void main(){ vA=alpha; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); float px=size*scale/max(0.1,-mv.z); vA*=clamp(maxPx/px,0.0,1.0); gl_PointSize=min(px,maxPx); gl_Position=projectionMatrix*mv; }`,
      fragmentShader:`varying float vA; varying vec3 vC; uniform float lit; void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d)*4.0; if(r>1.0) discard; float a=vA*exp(-r*3.2)*(1.0-r); vec3 c=vC; if(vC.r<0.95||vC.g<0.6) c*=lit; gl_FragColor=vec4(c,a); }` });
    this.points=new THREE.Points(g,mat); this.points.frustumCulled=false; scene.add(this.points); this.mat=mat;
  }
  emit(x,y,z,vx,vy,vz,{color=[0.85,0.85,0.85],size=1,life=2,grow=1.5,alpha=0.35,grav=0}={}){
    const i=this.i; this.i=(this.i+1)%this.max;
    this.pos.set([x,y,z],i*3); this.vel.set([vx,vy,vz],i*3); this.col.set(color,i*3);
    this.size[i]=size; this.life[i]=life; this.maxLife[i]=life; this.grow[i]=grow; this.a0[i]=alpha; this.alpha[i]=alpha; this.grav[i]=grav;
  }
  update(dt,viewportH){
    this.mat.uniforms.scale.value=viewportH*0.9; this.mat.uniforms.maxPx.value=viewportH*0.35;
    for(let i=0;i<this.max;i++){ if(this.life[i]<=0){ this.alpha[i]=0; continue; }
      this.life[i]-=dt; const k=this.life[i]/this.maxLife[i];
      this.vel[i*3+1]-=this.grav[i]*dt; const drag=Math.exp(-dt*1.5);
      for(let j=0;j<3;j++){ this.vel[i*3+j]*= j===1&&this.grav[i]>0?1:drag; this.pos[i*3+j]+=this.vel[i*3+j]*dt; }
      const fl=this.grav[i]>0?0.05:Math.max(0.05,this.size[i]*0.32); if(this.pos[i*3+1]<fl){ this.pos[i*3+1]=fl; this.vel[i*3+1]*=-0.3; }
      this.size[i]+=this.grow[i]*dt; this.alpha[i]=this.a0[i]*Math.max(0,k)*(k>0.85?(1-k)/0.15:1); }
    const g=this.points.geometry; g.attributes.position.needsUpdate=true; g.attributes.size.needsUpdate=true; g.attributes.alpha.needsUpdate=true; g.attributes.color.needsUpdate=true;
  }
}

export class SkidMarks {
  constructor(scene,max=3000){
    this.max=max; this.i=0;
    this.pos=new Float32Array(max*4*3); const idx=new Uint32Array(max*6); this.alpha=new Float32Array(max*4);
    for(let q=0;q<max;q++){ const v=q*4; idx.set([v,v+1,v+2, v+1,v+3,v+2],q*6); }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha',new THREE.BufferAttribute(this.alpha,1).setUsage(THREE.DynamicDrawUsage)); g.setIndex(new THREE.BufferAttribute(idx,1));
    const mat=new THREE.ShaderMaterial({ transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-6,
      vertexShader:`attribute float alpha; varying float vA; void main(){ vA=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader:`varying float vA; void main(){ gl_FragColor=vec4(0.05,0.05,0.06,vA); }` });
    this.mesh=new THREE.Mesh(g,mat); this.mesh.frustumCulled=false; scene.add(this.mesh);
    this.last=[null,null,null,null]; this.dirty=false;
  }
  // wheel index w, world point (x,z), heading a, strength 0..1
  add(w,x,z,a,s){
    const prev=this.last[w];
    if(s<=0){ this.last[w]=null; return; }
    if(prev && Math.hypot(x-prev.x,z-prev.z)<0.12) return;
    const hw=0.13, nx=-Math.sin(a)*hw, nz=Math.cos(a)*hw;
    if(prev && Math.hypot(x-prev.x,z-prev.z)<3){
      const q=this.i; this.i=(this.i+1)%this.max; const v=q*12, y=0.045;
      this.pos.set([prev.x+prev.nx,y,prev.z+prev.nz, prev.x-prev.nx,y,prev.z-prev.nz, x+nx,y,z+nz, x-nx,y,z-nz],v);
      const al=Math.min(0.55,0.15+s*0.5); this.alpha.set([prev.al,prev.al,al,al],q*4); this.dirty=true;
      this.last[w]={x,z,nx,nz,al};
    } else this.last[w]={x,z,nx,nz,al:Math.min(0.55,0.15+s*0.5)};
  }
  clear(){ this.pos.fill(0); this.alpha.fill(0); this.dirty=true; this.last=[null,null,null,null]; }
  update(){ if(!this.dirty) return; const g=this.mesh.geometry; g.attributes.position.needsUpdate=true; g.attributes.alpha.needsUpdate=true; this.dirty=false; }
}
