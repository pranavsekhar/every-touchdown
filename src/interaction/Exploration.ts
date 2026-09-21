import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Touchdown } from '../data/types.js';
import { PathPicker, type RenderedTouchdown } from './PathPicker.js';

export class Exploration {
  private suspended = false;
  private picker: PathPicker;
  private selected: string | null = null;
  private hovered: string | null = null;
  private active: string | null = null;
  private pointer: { x: number; y: number; touch: boolean } | null = null;
  private down: { x: number; y: number; id: number } | null = null;
  private pointers = new Set<number>();
  private dragged = false;
  private focusableClick = false;
  private navigating = false;
  private onNavigationStart = () => { if (this.suspended) return; this.navigating = true; this.hovered = null; this.refresh(); };
  private onNavigationEnd = () => { this.navigating = false; this.pickDirty = true; };
  private dirty = true;
  private pickDirty = true;
  private abort = new AbortController();
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private records: { id: string; material: THREE.MeshBasicMaterial; opacity: number; color: THREE.Color; highlight: THREE.Color }[] = [];
  private plays: Map<string, Touchdown>;
  private caption = document.querySelector<HTMLElement>('#play-caption')!;
  private description = document.querySelector<HTMLElement>('#play-description')!;
  private onCameraChange = () => { this.dirty = true; this.pickDirty = true; };

  constructor(private container: HTMLElement, private canvas: HTMLCanvasElement, private camera: THREE.Camera, private controls: OrbitControls, paths: RenderedTouchdown[], plays: Touchdown[], private focus: (id: string) => void) {
    this.picker = new PathPicker(paths);
    this.plays = new Map(plays.map(p => [p.id, p]));
    const colors: Record<string, THREE.Color> = {
      pass: new THREE.Color('#89c9e9'), yac: new THREE.Color('#c7dfdb'), rush: new THREE.Color('#e4dfd0'),
      catch: new THREE.Color('#effbff'), los: new THREE.Color('#9bcddd'), score: new THREE.Color('#e3eee9'),
    };
    for (const { group } of paths) group.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial) {
        this.records.push({ id: group.name, material: object.material, opacity: object.material.opacity, color: object.material.color.clone(), highlight: colors[object.name] ?? colors.pass });
      }
    });
    const options = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', this.pointerDown, options);
    canvas.addEventListener('dblclick', this.doubleClick, options);
    canvas.addEventListener('pointermove', this.pointerMove, options);
    canvas.addEventListener('pointerup', this.pointerUp, options);
    canvas.addEventListener('pointercancel', this.pointerCancel, options);
    canvas.addEventListener('pointerleave', this.pointerLeave, options);
    container.addEventListener('keydown', this.keyDown, options);
    window.addEventListener('keydown', this.escape, options);
    window.addEventListener('blur', this.pointerCancel, options);
    window.addEventListener('resize', this.onCameraChange, options);
    controls.addEventListener('change', this.onCameraChange);
    controls.addEventListener('start', this.onNavigationStart);
    controls.addEventListener('end', this.onNavigationEnd);
  }
  private locate(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, touch: 'pointerType' in e && e.pointerType === 'touch' };
    this.pickDirty = true;
  }
  private hit() {
    if (!this.pointer) return null;
    const { x, y, touch } = this.pointer;
    const { width, height } = this.canvas.getBoundingClientRect();
    if (x < 0 || y < 0 || x > width || y > height) return null;
    if (this.dirty) { this.picker.project(this.camera, width, height); this.dirty = false; }
    return this.picker.pick(x, y, touch ? 12 : 8);
  }
  private pointerDown = (e: PointerEvent) => {
    if (this.suspended) return;
    this.focusableClick = false; this.locate(e); this.pointers.add(e.pointerId);
    if (!this.down) { this.down = { x: e.clientX, y: e.clientY, id: e.pointerId }; this.dragged = false; }
    if (this.pointers.size > 1 || e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) this.dragged = true;
  };
  private pointerMove = (e: PointerEvent) => {
    if (this.suspended) return;
    this.locate(e);
    if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) this.dragged = true;
    if (this.dragged && this.down) { this.hovered = null; this.refresh(); this.canvas.style.cursor = 'grabbing'; }
  };
  private pointerUp = (e: PointerEvent) => {
    if (this.suspended) return;
    this.locate(e);
    const clicked = this.down?.id === e.pointerId && !this.dragged && this.pointers.size === 1;
    this.focusableClick = clicked;
    this.pointers.delete(e.pointerId);
    if (clicked) { this.selected = this.hit(); this.hovered = this.selected; this.refresh(); }
    if (!this.pointers.size) {
      this.down = null; this.dragged = false;
      if (e.pointerType === 'touch') { this.pointer = null; this.hovered = null; this.refresh(); }
      this.pickDirty = true;
    }
  };
  private doubleClick = (e: MouseEvent) => {
    if (this.suspended) return;
    if (!this.focusableClick || e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) return;
    this.locate(e); const id = this.hit();
    if (id) { this.selected = id; this.hovered = id; this.refresh(); this.focus(id); }
  };
  private pointerCancel = () => {
    this.navigating = false; this.focusableClick = false; this.down = null; this.pointers.clear(); this.dragged = false; this.pointer = null; this.hovered = null; this.refresh(); this.canvas.style.cursor = 'grab';
  };
  private pointerLeave = () => { if (this.suspended) return; if (!this.down) { this.pointer = null; this.hovered = null; this.refresh(); this.canvas.style.cursor = 'grab'; } };
  private escape = (e: KeyboardEvent) => {
    if (this.suspended) return;
    if (e.key !== 'Escape') return;
    this.selected = null; this.hovered = null; this.pointer = null; this.refresh(); this.canvas.style.cursor = 'grab';
  };
  private keyDown = (e: KeyboardEvent) => {
    if (this.suspended) return;
    if (e.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault(); const delta = new THREE.Vector3(e.key === 'ArrowLeft' ? -4 : e.key === 'ArrowRight' ? 4 : 0, 0, e.key === 'ArrowUp' ? -4 : e.key === 'ArrowDown' ? 4 : 0);
      this.controls.target.add(delta); this.camera.position.add(delta); this.controls.update(); return;
    }
    if (e.key.toLowerCase() === 'f' && this.active) { e.preventDefault(); this.selected = this.active; this.refresh(); this.focus(this.active); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const ids = [...this.plays.keys()]; const current = ids.indexOf(this.active ?? '');
      const index = current < 0 ? (e.key === 'ArrowDown' ? 0 : ids.length - 1) : (current + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length;
      this.hovered = ids[index]; this.selected = null; this.pointer = null; this.refresh();
    } else if (e.key === 'Enter' && this.active) { e.preventDefault(); this.selected = this.active; this.refresh(); }
  };
  private refresh() {
    const next = this.selected ?? this.hovered;
    const locked = this.selected !== null;
    this.container.dataset.selectedPlay = this.selected ?? '';
    this.container.dataset.activePlay = next ?? '';
    if (next === this.active && this.caption.dataset.locked === String(locked)) return;
    this.active = next; this.caption.dataset.locked = String(locked);
    this.caption.classList.toggle('visible', !!next);
    this.description.classList.toggle('visible', locked);
    this.caption.setAttribute('aria-hidden', String(!next));
    this.caption.setAttribute('aria-label', locked ? 'Selected touchdown' : 'Touchdown preview');
    if (next) this.container.setAttribute('aria-describedby', 'play-caption');
    else this.container.removeAttribute('aria-describedby');
    this.description.setAttribute('aria-hidden', String(!locked));
    if (!next) return;
    const p = this.plays.get(next)!;
    const surname = (name: string | null) => name?.replace(/^[A-Z]\./, '') ?? 'Unknown';
    const rushName = p.scorer === 'J.Gibbs' ? 'Jahmyr Gibbs' : p.scorer === 'D.Montgomery' ? 'David Montgomery' : p.scorer?.replace('.', '. ') ?? 'Unknown';
    document.querySelector('#play-name')!.textContent = p.type === 'pass' ? `${surname(p.passer)} → ${surname(p.scorer)}` : rushName;
    document.querySelector('#play-yards')!.textContent = `${p.yards ?? '—'} ${p.type === 'rush' ? 'YD RUSH' : 'YDS'}`;
    const split = document.querySelector<HTMLElement>('#play-split')!;
    split.textContent = p.type === 'pass' ? (p.geometry.segmentation === 'recorded' ? `${p.airYards} AIR · ${p.yardsAfterCatch} YAC` : 'AIR / YAC UNAVAILABLE') : '';
    split.hidden = p.type !== 'pass';
    document.querySelector('#play-game')!.textContent = `WEEK ${p.week} · ${p.gameId.split('_')[2] === 'DET' ? 'at' : 'vs'} ${p.opponent}`;
    this.description.textContent = locked ? p.description : '';
  }
  setSuspended(value: boolean) {
    this.suspended = value; this.caption.setAttribute('aria-live', value ? 'off' : 'polite'); this.selected = null; this.hovered = null; this.pointer = null; this.down = null; this.pointers.clear(); this.navigating = false; this.dragged = false; this.focusableClick = false; this.refresh(); this.canvas.style.cursor = 'grab';
  }
  showPlayback(id: string | null) { this.hovered = id; this.refresh(); }
  update(dt: number) {
    if (this.suspended) return;
    if (this.pickDirty && !this.down && !this.navigating && this.pointer && !this.pointer.touch) {
      const hit = this.hit(); this.hovered = hit; this.refresh(); this.canvas.style.cursor = hit ? 'pointer' : 'grab'; this.pickDirty = false;
    }
    const blend = this.reduced.matches ? 1 : 1 - Math.exp(-dt / 0.065);
    for (const r of this.records) {
      const focused = r.id === this.active;
      const target = this.active ? (focused ? 0.98 : r.opacity * 0.68) : r.opacity;
      r.material.opacity += (target - r.material.opacity) * blend;
      r.material.color.lerp(focused ? r.highlight : r.color, blend);
      if (Math.abs(target - r.material.opacity) < 0.0001) { r.material.opacity = target; r.material.color.copy(focused ? r.highlight : r.color); }
    }
  }
  dispose() { this.abort.abort(); this.controls.removeEventListener('change', this.onCameraChange); this.controls.removeEventListener('start', this.onNavigationStart); this.controls.removeEventListener('end', this.onNavigationEnd); }
}
