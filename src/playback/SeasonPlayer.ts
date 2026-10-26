import { track } from '../analytics';
import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Touchdown } from '../data/types.js';
import type { RenderedTouchdown } from '../interaction/PathPicker.js';
import type { Exploration } from '../interaction/Exploration.js';
import type { Navigation } from '../scene/Navigation.js';

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
  private abort = new AbortController();
  private panel = document.querySelector<HTMLElement>('#season-player')!;
  private label = document.querySelector<HTMLElement>('#season-time')!;
  private moment = document.querySelector<HTMLElement>('#season-moment')!;
  private scrub = document.querySelector<HTMLInputElement>('#season-seek')!;
  private pauseButton = document.querySelector<HTMLButtonElement>('#season-pause')!;
  private pulse: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  constructor(plays: Touchdown[], paths: RenderedTouchdown[], private camera: THREE.PerspectiveCamera, private controls: OrbitControls, private navigation: Navigation, private exploration: Exploration, scene: THREE.Scene, private container: HTMLElement, private seasonTitle: string) {
    this.timeline = buildTimeline(plays);
    this.drawings = new Map(paths.map(p => [p.group.name, new DrawTouchdown(p)]));
    this.scrub.max = String(this.timeline.duration);
    this.pulse = new THREE.Mesh(new THREE.RingGeometry(0.84, 1, 48), new THREE.MeshBasicMaterial({ color: document.documentElement.style.getPropertyValue('--team-accent') || '#0076b6', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
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
    window.addEventListener('keydown', e => { if (this.engaged && e.key === 'Escape' && !document.querySelector('dialog[open]')) this.exit(); }, options);
  }
  private setRunning(value: boolean) {
    this.running = value; this.controls.enabled = true;
    this.pauseButton.textContent = value ? 'Pause' : 'Resume';
    this.container.dataset.playback = value ? 'playing' : 'paused';
  }
  private start() {
    track('play_season_start');
    this.navigation.interrupt();
    // Clear damping before taking camera ownership.
    const damping = this.controls.enableDamping; this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = damping;
    this.navigation.overview();
    this.time = 0; this.entrance = true; this.engaged = true; this.exploration.setSuspended(true);
    this.moment.hidden = true; this.panel.hidden = false; document.querySelector('main')!.classList.add('is-playing');
    this.setRunning(true); this.renderState(); this.pauseButton.focus({preventScroll:true});
  }
  private exit(completed = false) {
    if(completed)track('play_season_complete');
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
      drawing.setProgress(this.reduced.matches?(state.progress>0?1:0):state.progress, state.emphasis, this.reduced.matches?0:state.pulse, cue, this.reduced.matches?0:openingOpacity);
      if (this.time >= cue.start) current = cue;
      if (state.progress === 1) completed++;
      if (state.pulse > 0 && !this.reduced.matches) {
        this.pulse.visible = true;
        const ink = document.documentElement.style.getPropertyValue(cue.play.type === 'pass' ? '--team-accent' : '--rush-accent'); if(ink) this.pulse.material.color.set(ink);
        this.pulse.position.set(drawing.rendered.path.endX, 0.25, drawing.rendered.path.endZ);
        this.pulse.scale.setScalar(0.45 + (this.time - cue.drawEnd) / (cue.end - cue.drawEnd) * 2.3);
        this.pulse.material.opacity = state.pulse * 0.65;
      }
    }
    const last = this.timeline.cues[this.timeline.cues.length - 1];
    const finale = this.time >= last.end;
    this.label.textContent = finale ? `${this.seasonTitle.toUpperCase()} · ${this.timeline.cues.length} TOUCHDOWNS` : `WEEK ${current.play.week} · ${current.play.homeAway === 'away' ? '@' : 'vs'} ${current.play.opponent}`;
    this.exploration.showPlayback(this.time >= current.start && !finale ? current.play.id : null);
    this.scrub.value = String(this.time);
    this.scrub.setAttribute('aria-valuetext', `${this.label.textContent}, ${completed} of ${this.timeline.cues.length} touchdowns complete`);
    this.container.dataset.completedTouchdowns = String(completed);
    this.container.dataset.playbackTime = this.time.toFixed(3);
  }
  update(dt: number) {
    if (!this.engaged || !this.running) return;
    this.time = Math.min(this.timeline.duration, this.time + dt);
    this.renderState();
    if (this.time >= this.timeline.duration) this.exit(true);
  }
  refreshAppearance() { this.drawings.forEach(d=>d.refreshAppearance()); if(this.engaged) this.renderState(); }
  dispose() { this.drawings.forEach(d=>d.restore()); this.scrub.value='0';this.scrub.removeAttribute('aria-valuetext');delete this.container.dataset.playbackTime;delete this.container.dataset.completedTouchdowns;this.abort.abort(); this.controls.enabled = true; this.panel.hidden = true; this.moment.hidden = true; document.querySelector('main')!.classList.remove('is-playing'); this.pulse.removeFromParent(); this.pulse.geometry.dispose(); this.pulse.material.dispose(); }
}
