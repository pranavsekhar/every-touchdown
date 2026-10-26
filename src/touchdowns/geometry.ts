import * as THREE from 'three';
import { seededRandom } from '../utils/seededRandom.js';
import type { Touchdown, Location } from '../data/types.js';
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const finite = (n: number | null): n is number => n !== null && Number.isFinite(n);
const inField = (z: number) => THREE.MathUtils.clamp(z, -24.5, 24.5);

/** Longitudinal coordinates are data; height and lateral placement are illustrative. */
export function derivePath(play: Touchdown) {
  const random = seededRandom(play.id);
  let los = play.geometry.losX;
  if (!finite(los)) {
    const distance = finite(play.yardline100) ? play.yardline100 : play.yards;
    los = finite(distance) && distance > 0 && distance <= 100 ? 50 - distance : null;
  }
  if (!finite(los) || los < -50 || los >= 50) return null;
  const endX = 50;
  const distance = endX - los;
  const region = (location: Location | null) => location === null ? (random() - 0.5) * 44 : ({ left: -17.1, middle: 0, right: 17.1 }[location] + (random() - 0.5) * 14.2);
  let startZ = (random() - 0.5) * 12;
  let catchPoint: THREE.Vector3 | null = null;
  let airCurve: THREE.CubicBezierCurve3 | null = null;
  let groundCurve: THREE.Curve<THREE.Vector3> | null = null;
  let endZ: number;
  if (play.type === 'pass') {
    const catchZ = inField(region(play.location));
    // Never clamp negative air yards or silently manufacture a catch from missing data.
    const segmented = play.geometry.segmentation === 'recorded' && finite(play.airYards) && finite(play.yardsAfterCatch)
      && los + play.airYards >= -60 && los + play.airYards <= 60
      && Math.abs(play.airYards + play.yardsAfterCatch - distance) < 0.01;
    const catchX = segmented ? los + play.airYards! : endX;
    const signedAir = catchX - los;
    // One shallow canopy: positive air distance controls height; screens stay low.
    const h = 2.1 + 8.4 * (1 - Math.exp(-Math.max(0, signedAir) / 27));
    const landing = v(catchX, 0.3, catchZ);
    // Asymmetric, flattened sweep. X control points preserve signed air-yard distance.
    airCurve = new THREE.CubicBezierCurve3(v(los, 0.3, startZ), v(los + signedAir * 0.34, h, startZ + (catchZ - startZ) * 0.36), v(los + signedAir * 0.8, h * 0.58, catchZ), landing);
    catchPoint = segmented ? landing : null;
    const yac = segmented ? play.yardsAfterCatch! : 0;
    endZ = inField(catchZ + (random() - 0.5) * Math.min(Math.abs(yac) * 0.25, 7));
    if (segmented && Math.abs(yac) > 0.001) {
      groundCurve = new THREE.CubicBezierCurve3(landing, v(catchX + yac * 0.3, 0.18, catchZ), v(catchX + yac * 0.75, 0.18, endZ), v(endX, 0.2, endZ));
    } else endZ = catchZ;
  } else {
    // run_location/run_gap describe the initial gap, not a tracked final sideline position.
    // A short plunge therefore remains short laterally, too.
    const direction = play.runLocation === 'left' ? -1 : play.runLocation === 'right' ? 1 : 0;
    const gapWidth = { guard: 2, tackle: 4, end: 7 }[play.runGap ?? 'guard'];
    const lateral = direction * Math.min(distance * 0.6, gapWidth + distance * 0.11);
    startZ = (random() - 0.5) * 10;
    endZ = inField(startZ + lateral + (random() - 0.5) * Math.min(distance * 0.16, 5));
    const exitZ = inField(startZ + direction * Math.min(distance * 0.22, gapWidth));
    const bendSign = direction || (random() < 0.5 ? -1 : 1);
    const bend = bendSign * Math.min(5.5, distance * 0.09) * THREE.MathUtils.smoothstep(distance, 8, 32) * (0.8 + random() * 0.35);
    const level = 0.14 + random() * 0.07;
    // Coarse initial gap, then a gentle seeded change of direction. No tracked route implied.
    // Evenly advancing anchors keep the real LOS and exact scoring distance intact.
    groundCurve = new THREE.CatmullRomCurve3([
      v(los, level, startZ),
      v(los + distance * 0.2, level + 0.025, exitZ),
      v(los + distance * 0.48, level + 0.06, inField(THREE.MathUtils.lerp(startZ, endZ, 0.48) + bend)),
      v(los + distance * 0.76, level + 0.025, inField(THREE.MathUtils.lerp(startZ, endZ, 0.76) - bend * 0.35)),
      v(endX, level, endZ),
    ], false, 'centripetal');
  }
  return { los, endX, endZ, startZ, airCurve, groundCurve, catchPoint };
}

export function createTouchdown(play: Touchdown, accent = '#0076b6') {
  const path = derivePath(play);
  if (!path) return null; // One malformed record must not crash the scene.
  const group = new THREE.Group(); group.name = play.id;
  group.userData = { touchdownId: play.id, playId: play.playId, gameId: play.gameId };
  const blue = new THREE.Color(accent);
  const yacBlue = new THREE.Color(accent).lerp(new THREE.Color('#42867f'), .55);
  const silver = new THREE.Color(accent).lerp(new THREE.Color('#6d7973'), .78);
  // Aerial threads carry the canopy; crowded red-zone plays remain present but quiet.
  const airWeight = Math.min(1, Math.max(0, play.airYards ?? 0) / 42);
  const line = (curve: THREE.Curve<THREE.Vector3>, color: THREE.Color, radius: number, opacity: number, name: string) => {
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }));
    mesh.name = name; group.add(mesh);
  };
  const point = (position: THREE.Vector3, color: THREE.Color, radius: number, opacity: number, name: string) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false })); mesh.position.copy(position); mesh.name = name; group.add(mesh);
  };
  if (path.airCurve) line(path.airCurve, blue, 0.095 + airWeight * 0.023, 0.66 + airWeight * 0.16, 'pass');
  if (path.groundCurve) line(path.groundCurve, play.type === 'pass' ? yacBlue : silver, play.type === 'pass' ? 0.073 : 0.078, play.type === 'pass' ? 0.48 : 0.40, play.type === 'pass' ? 'yac' : 'rush');
  if (path.catchPoint) point(path.catchPoint, blue, 0.19, 0.4, 'catch');
  point(v(path.los, 0.22, path.startZ), play.type === 'pass' ? blue : silver, 0.09, 0.19, 'los');
  // The catch is already the endpoint for zero-YAC scores. Avoid doubled markers and rings.
  if (!path.catchPoint || path.groundCurve) point(v(path.endX, 0.22, path.endZ), play.type === 'pass' ? yacBlue : silver, 0.11, 0.2, 'score');
  return { group, path };
}
