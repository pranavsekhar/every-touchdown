import { appearance } from '../touchdowns/ink.js';
import * as THREE from 'three';
import type { RenderedTouchdown } from '../interaction/PathPicker.js';
import type { Cue } from './timeline.js';

/** Reveal the existing indexed tubes in their native LOS-to-score order. No geometry is rebuilt. */
export class DrawTouchdown {
  private meshes: { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; opacity: number; color: THREE.Color; highlight: THREE.Color }[] = [];
  constructor(readonly rendered: RenderedTouchdown) {
    rendered.group.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) this.meshes.push({ mesh: o, ...appearance(o.material) }); });
  }
  setProgress(progress: number, emphasis: number, pulse: number, cue: Cue, openingOpacity = 0) {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    for (const { mesh, opacity, color, highlight } of this.meshes) {
      const name = mesh.name;
      let part = p;
      if (name === 'pass') part = Math.min(1, p / (cue.catchAt || 1));
      if (name === 'yac') part = Math.max(0, (p - cue.catchAt) / (1 - cue.catchAt || 1));
      if (name === 'catch') part = p >= cue.catchAt && p > 0 ? 1 : 0;
      if (name === 'score') part = p === 1 ? 1 : 0;
      if (name === 'los') part = p > 0 ? 1 : 0;
      const tube = name === 'pass' || name === 'yac' || name === 'rush';
      mesh.visible = openingOpacity > 0 || part > 0;
      if (tube) mesh.geometry.setDrawRange(0, openingOpacity > 0 ? Infinity : Math.floor(part * 64 + 1e-8) * 36);
      mesh.material.opacity = openingOpacity > 0 ? opacity * openingOpacity : THREE.MathUtils.lerp(opacity, 0.98, emphasis);
      mesh.material.color.copy(color).lerp(highlight, emphasis);
      const catchFlash = name === 'catch' && p >= cue.catchAt ? Math.max(0, 1 - (p - cue.catchAt) / 0.18) * emphasis : 0;
      mesh.scale.setScalar(1 + catchFlash * 0.8 + ((name === 'score' || name === 'catch' && cue.catchAt === 1) ? pulse * 2.3 : 0));
    }
  }
  refreshAppearance() { for(const r of this.meshes) Object.assign(r,appearance(r.mesh.material)); }
  restore() {
    for (const { mesh, opacity, color } of this.meshes) { mesh.visible = true; mesh.geometry.setDrawRange(0, Infinity); mesh.scale.setScalar(1); mesh.material.opacity = opacity; mesh.material.color.copy(color); }
  }
}
