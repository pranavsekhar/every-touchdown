import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { RenderedTouchdown } from '../interaction/PathPicker.js';

export const OVERVIEW_POSITION = new THREE.Vector3(150, 82, 126);
export const OVERVIEW_TARGET = new THREE.Vector3(4, 2, 0);
export function constrainTarget(target: THREE.Vector3) {
  target.x = THREE.MathUtils.clamp(target.x, -55, 55);
  target.z = THREE.MathUtils.clamp(target.z, -25, 25);
  target.y = THREE.MathUtils.clamp(target.y, 0.5, 6);
  return target;
}
export function focusFrame(path: RenderedTouchdown, camera: THREE.PerspectiveCamera) {
  const bounds = new THREE.Box3();
  for (const curve of [path.path.airCurve, path.path.groundCurve]) {
    if (curve) for (const point of curve.getPoints(64)) bounds.expandByPoint(point);
  }
  const center = constrainTarget(bounds.getCenter(new THREE.Vector3()));
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  const vertical = THREE.MathUtils.degToRad(camera.fov / 2);
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const distance = THREE.MathUtils.clamp(radius / Math.sin(Math.min(vertical, horizontal)) * 1.2, 42, 230);
  return { center, distance };
}
export class Navigation {
  private motion: { from: THREE.Vector3; to: THREE.Vector3; direction: THREE.Vector3; startDistance: number; endDistance: number; elapsed: number } | null = null;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private scratch = new THREE.Vector3();
  private cancel = () => { this.motion = null; };
  constructor(private camera: THREE.PerspectiveCamera, private controls: OrbitControls, private paths: RenderedTouchdown[]) {
    controls.enablePan = true; controls.screenSpacePanning = false;
    controls.panSpeed = 0.72; controls.rotateSpeed = 0.5; controls.zoomSpeed = 0.8;
    controls.dampingFactor = 0.07;
    controls.minDistance = 38; controls.maxDistance = 255;
    controls.minPolarAngle = Math.PI * 0.09; controls.maxPolarAngle = Math.PI * 0.44;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.addEventListener('start', this.cancel);
  }
  private settle() {
    // Flush residual orbit/pan deltas before a programmatic move, using the public API.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false; this.controls.update(); this.controls.enableDamping = damping;
  }
  interrupt() { this.cancel(); }
  reset() {
    this.cancel(); this.settle();
    this.controls.target.copy(OVERVIEW_TARGET); this.camera.position.copy(OVERVIEW_POSITION); this.controls.update();
  }
  focus(id: string) {
    const path = this.paths.find(p => p.group.name === id); if (!path) return;
    this.settle();
    const frame = focusFrame(path, this.camera);
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.motion = { from: this.controls.target.clone(), to: frame.center, direction: offset.clone().normalize(), startDistance: offset.length(), endDistance: frame.distance, elapsed: 0 };
  }
  update(dt: number) {
    if (this.motion) {
      const m = this.motion; m.elapsed += dt;
      const t = this.reduced.matches ? 1 : Math.min(1, m.elapsed / 0.65);
      const ease = t * t * (3 - 2 * t);
      this.controls.target.lerpVectors(m.from, m.to, ease);
      this.camera.position.copy(this.controls.target).addScaledVector(m.direction, THREE.MathUtils.lerp(m.startDistance, m.endDistance, ease));
      if (t === 1) this.motion = null;
    }
    this.controls.update();
    this.scratch.copy(this.controls.target);
    constrainTarget(this.controls.target);
    this.scratch.sub(this.controls.target);
    if (this.scratch.lengthSq() > 0) {
      this.camera.position.sub(this.scratch);
    }
  }
  dispose() { this.controls.removeEventListener('start', this.cancel); }
}
