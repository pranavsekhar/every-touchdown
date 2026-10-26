import * as THREE from 'three';
import type {RenderedTouchdown} from '../interaction/PathPicker.js';
import type {Touchdown} from '../data/types.js';
import {DrawTouchdown} from '../playback/DrawTouchdown.js';
import {buildTimeline} from '../playback/timeline.js';
/** A single short invitation, owned by the existing render loop; input always wins. */
export class LandingReveal {
 private elapsed=0;
 private done=false;
 private drawings:DrawTouchdown[];
 private chosen:Set<string>;
 private cues;
 private fieldMaterials:{material:THREE.Material;opacity:number;transparent:boolean}[]=[];
 constructor(private paths:RenderedTouchdown[],plays:Touchdown[],field:THREE.Group) {
  this.drawings=paths.map(p=>new DrawTouchdown(p));
  const representative=[...plays].sort((a,b)=>(b.yards??0)-(a.yards??0)).slice(0,5);
  this.chosen=new Set(representative.map(p=>p.id));
  this.cues=new Map(buildTimeline(plays).cues.map(c=>[c.play.id,c]));
  const seen=new Set<THREE.Material>();field.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!seen.has(m)){seen.add(m);this.fieldMaterials.push({material:m,opacity:m.opacity,transparent:m.transparent});m.transparent=true;}});
  this.update(0);
 }
 update(dt:number) {
  if(this.done)return;
  this.elapsed+=dt;
  const t=this.elapsed,fade=THREE.MathUtils.smoothstep(t,.85,2.1);
  for(const r of this.fieldMaterials)r.material.opacity=r.opacity*THREE.MathUtils.smoothstep(t,0,.5);
  this.drawings.forEach((d,i)=>{
   const id=this.paths[i].group.name;
   if(this.chosen.has(id))d.setProgress(THREE.MathUtils.clamp((t-.2)/1.05,0,1),0,0,this.cues.get(id)!);
   else {d.restore();d.rendered.group.traverse(o=>{if(o instanceof THREE.Mesh)o.material.opacity*=fade;});}
  });
  if(t>=2.1)this.finish();
 }
 finish(){if(this.done)return;this.done=true;this.drawings.forEach(d=>d.restore());for(const r of this.fieldMaterials){r.material.opacity=r.opacity;r.material.transparent=r.transparent;}}
 get complete(){return this.done;}
}
