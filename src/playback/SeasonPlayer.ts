import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Touchdown } from '../data/types.js';
import type { RenderedTouchdown } from '../interaction/PathPicker.js';
import type { Exploration } from '../interaction/Exploration.js';
import type { Navigation } from '../scene/Navigation.js';
import { OVERVIEW_POSITION, OVERVIEW_TARGET } from '../scene/Navigation.js';
import { buildTimeline, cueState } from './timeline.js';
import { DrawTouchdown } from './DrawTouchdown.js';

export class SeasonPlayer {
  private timeline;
  private drawings: Map<string, DrawTouchdown>;
  private time = 0;
  private running = false;
  private engaged = false;
  private entrance = true;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private fromPosition = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private axis = new THREE.Vector3(0, 1, 0);
  private abort = new AbortController();
  private panel = document.querySelector<HTMLElement>('#season-player')!;
  private label = document.querySelector<HTMLElement>('#season-time')!;
  private moment = document.querySelector<HTMLElement>('#season-moment')!;
  private scrub = document.querySelector<HTMLInputElement>('#season-seek')!;
  private pauseButton = document.querySelector<HTMLButtonElement>('#season-pause')!;
  private pulse: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  constructor(plays: Touchdown[], paths: RenderedTouchdown[], private camera: THREE.PerspectiveCamera, private controls: OrbitControls, private navigation: Navigation, private exploration: Exploration, scene: THREE.Scene, private container: HTMLElement) {
    this.timeline = buildTimeline(plays);
    this.drawings = new Map(paths.map(p => [p.group.name, new DrawTouchdown(p)]));
    this.scrub.max = String(this.timeline.duration);
    this.pulse = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color: '#c5dee8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    this.pulse.rotation.x = -Math.PI / 2; this.pulse.visible = false; scene.add(this.pulse);
    const options = { signal: this.abort.signal };
    document.querySelector('#play-season')!.addEventListener('click', () => this.start(), options);
    this.pauseButton.addEventListener('click', () => this.setRunning(!this.running), options);
    document.querySelector('#season-restart')!.addEventListener('click', () => this.start(), options);
    document.querySelector('#season-exit')!.addEventListener('click', () => this.exit(), options);
    this.scrub.addEventListener('input', () => {
      this.setRunning(false); this.entrance = false; this.time = Number(this.scrub.value);
      // Seeking bypasses the entrance camera move; the spatial state remains freely inspectable.
      this.renderState();
    }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.engaged) this.setRunning(false); }, options);
    window.addEventListener('keydown', e => { if (this.engaged && e.key === 'Escape') this.exit(); }, options);
  }
  private setRunning(value: boolean) {
    this.running = value; this.controls.enabled = !value;
    this.pauseButton.textContent = value ? 'Pause' : 'Resume';
    this.container.dataset.playback = value ? 'playing' : 'paused';
  }
  private start() {
    this.navigation.interrupt();
    // Clear damping before taking camera ownership.
    const damping = this.controls.enableDamping; this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = damping;
    this.fromPosition.copy(this.camera.position); this.fromTarget.copy(this.controls.target);
    this.time = 0; this.entrance = true; this.engaged = true; this.exploration.setSuspended(true);
    this.moment.hidden = true; this.panel.hidden = false; document.querySelector('main')!.classList.add('is-playing');
    this.setRunning(true); this.renderState(); this.pauseButton.focus();
  }
  private exit(completed = false) {
    this.engaged = false; this.running = false; this.controls.enabled = true;
    this.drawings.forEach(d => d.restore()); this.pulse.visible = false;
    this.panel.hidden = true; document.querySelector('main')!.classList.remove('is-playing');
    this.exploration.setSuspended(false); this.container.dataset.playback = 'exploring';
    this.moment.hidden = !completed;
    document.querySelector<HTMLButtonElement>('#play-season')!.focus({ preventScroll: true });
  }
  private renderState() {
    let current = this.timeline.cues[0];
    let completed = 0;
    this.pulse.visible = false;
    for (const cue of this.timeline.cues) {
      const state = cueState(cue, this.time);
      const drawing = this.drawings.get(cue.play.id)!;
      const openingOpacity = this.entrance && this.time < 0.45 ? 1 - this.time / 0.45 : 0;
      drawing.setProgress(state.progress, state.emphasis, state.pulse, cue, openingOpacity);
      if (this.time >= cue.start) current = cue;
      if (state.progress === 1) completed++;
      if (state.pulse > 0 && !this.reduced.matches) {
        this.pulse.visible = true;
        this.pulse.position.set(drawing.rendered.path.endX, 0.25, drawing.rendered.path.endZ);
        this.pulse.scale.setScalar(0.4 + (this.time - cue.drawEnd) / (cue.end - cue.drawEnd) * 1.4);
        this.pulse.material.opacity = state.pulse * 0.38;
      }
    }
    const last = this.timeline.cues[this.timeline.cues.length - 1];
    const finale = this.time >= last.end;
    this.label.textContent = finale ? `2025 DETROIT LIONS · ${this.timeline.cues.length} TOUCHDOWNS` : `WEEK ${current.play.week} · ${current.play.gameId.split('_')[2] === 'DET' ? '@' : 'vs'} ${current.play.opponent}`;
    this.exploration.showPlayback(this.time >= current.start && !finale ? current.play.id : null);
    this.scrub.value = String(this.time);
    this.scrub.setAttribute('aria-valuetext', `${this.label.textContent}, ${completed} of ${this.timeline.cues.length} touchdowns complete`);
    this.container.dataset.completedTouchdowns = String(completed);
    this.container.dataset.playbackTime = this.time.toFixed(3);
  }
  update(dt: number) {
    if (!this.engaged || !this.running) return;
    const previous = this.time;
    this.time = Math.min(this.timeline.duration, this.time + dt);
    if (this.entrance && this.time <= this.timeline.opening) {
      const t = this.reduced.matches ? 1 : Math.min(1, this.time / this.timeline.opening);
      const eased = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(this.fromPosition, OVERVIEW_POSITION, eased);
      this.controls.target.lerpVectors(this.fromTarget, OVERVIEW_TARGET, eased);
      this.controls.update();
    } else if (!this.reduced.matches && this.time > this.timeline.opening) {
      if (this.entrance && previous < this.timeline.opening) { this.camera.position.copy(OVERVIEW_POSITION); this.controls.target.copy(OVERVIEW_TARGET); }
      // A total of six degrees over the season, independent of frame rate. Never chase a play.
      this.offset.copy(this.camera.position).sub(this.controls.target).applyAxisAngle(this.axis, (this.time - Math.max(previous, this.timeline.opening)) * 0.0027);
      this.camera.position.copy(this.controls.target).add(this.offset); this.controls.update();
    }
    this.renderState();
    if (this.time >= this.timeline.duration) this.exit(true);
  }
  dispose() { this.abort.abort(); this.pulse.geometry.dispose(); this.pulse.material.dispose(); }
}
