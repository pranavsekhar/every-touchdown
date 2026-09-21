import * as THREE from 'three';
import type { createTouchdown } from '../touchdowns/geometry.js';
export type RenderedTouchdown = NonNullable<ReturnType<typeof createTouchdown>>;

/** Screen-space hit corridors stay generous at every zoom level without altering visible geometry. */
export class PathPicker {
  private strands: { id: string; points: THREE.Vector3[]; projected: Float32Array }[] = [];
  private scratch = new THREE.Vector3();
  constructor(paths: RenderedTouchdown[]) {
    for (const { group, path } of paths) {
      for (const curve of [path.airCurve, path.groundCurve]) {
        if (!curve) continue;
        const points = curve.getPoints(64);
        this.strands.push({ id: group.name, points, projected: new Float32Array(points.length * 3) });
      }
    }
  }
  project(camera: THREE.Camera, width: number, height: number) {
    camera.updateMatrixWorld();
    for (const strand of this.strands) {
      strand.points.forEach((point, i) => {
        const p = this.scratch.copy(point).project(camera);
        strand.projected[i * 3] = (p.x + 1) * width / 2;
        strand.projected[i * 3 + 1] = (1 - p.y) * height / 2;
        strand.projected[i * 3 + 2] = p.z;
      });
    }
  }
  pick(x: number, y: number, radius = 8): string | null {
    let best: string | null = null, bestDistance = radius * radius, bestDepth = Infinity;
    for (const { id, projected: p } of this.strands) {
      for (let i = 3; i < p.length; i += 3) {
        if (p[i + 2] < -1 || p[i + 2] > 1 || p[i - 1] < -1 || p[i - 1] > 1) continue;
        const ax = p[i - 3], ay = p[i - 2], dx = p[i] - ax, dy = p[i + 1] - ay;
        const t = THREE.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        const distance = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
        const depth = p[i - 1] + t * (p[i + 2] - p[i - 1]);
        if (distance < bestDistance - 0.01 || (Math.abs(distance - bestDistance) < 0.01 && depth < bestDepth)) {
          bestDistance = distance; bestDepth = depth; best = id;
        }
      }
    }
    return best;
  }
}
