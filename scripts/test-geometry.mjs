import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTouchdown, derivePath } from '../work/check/touchdowns/geometry.js';
const { touchdowns } = JSON.parse(readFileSync(new URL('../public/data/2025/DET.json', import.meta.url)));
let catches = 0, yacTrails = 0;
for (const play of touchdowns) {
  const path = derivePath(play), repeat = derivePath(play);
  assert.ok(path, play.id);
  assert.equal(path.los, 50 - play.yardline100);
  assert.equal(path.endX, 50);
  for (const key of ['airCurve', 'groundCurve']) {
    if (!path[key]) continue;
    assert.deepEqual(path[key].getPoints(8), repeat[key].getPoints(8), `${play.id}: deterministic geometry`);
    for (const point of path[key].getPoints(64)) {
      assert.ok([point.x, point.y, point.z].every(Number.isFinite));
      assert.ok(point.y >= 0 && point.y <= 12);
      assert.ok(Math.abs(point.z) <= 26.65);
    }
  }
  if (play.type === 'pass') {
    catches++;
    assert.equal(path.airCurve.getPoint(0).x, path.los);
    assert.equal(path.catchPoint.x - path.los, play.airYards);
    assert.equal(50 - path.catchPoint.x, play.yardsAfterCatch);
    const lane = { left: [-26.65, -8.88], middle: [-8.88, 8.88], right: [8.88, 26.65] }[play.location];
    assert.ok(path.catchPoint.z >= lane[0] && path.catchPoint.z <= lane[1]);
    if (play.yardsAfterCatch === 0) assert.equal(path.groundCurve, null);
    else { yacTrails++; assert.deepEqual(path.groundCurve.getPoint(0), path.catchPoint); assert.equal(path.groundCurve.getPoint(1).x, 50); }
  } else {
    assert.equal(path.airCurve, null);
    assert.ok(Math.abs(path.groundCurve.getPoint(1).x - path.groundCurve.getPoint(0).x - play.yards) < 1e-9);
    const points = path.groundCurve.getPoints(128);
    assert.ok(points.every((p, i) => p.y <= 0.35 && p.x >= path.los - 1e-9 && p.x <= 50 + 1e-9 && (!i || p.x >= points[i - 1].x)));
    if (play.yards >= 25) {
      const deviation = Math.max(...points.map(p => Math.abs(p.z - (path.startZ + (path.endZ - path.startZ) * (p.x - path.los) / play.yards))));
      assert.ok(deviation > 0.6, `${play.id}: long runs must have a gentle bend, not a straight rod`);
    }
    if (play.yards === 1) assert.ok(Math.abs(path.endZ - path.startZ) < 1);
  }
  const built = createTouchdown(play);
  assert.equal(built.group.name, play.id);
  built.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
const sample = structuredClone(touchdowns.find(p => p.type === 'pass'));
for (const field of ['airYards', 'yardsAfterCatch']) {
  const bad = { ...sample, [field]: null };
  const path = derivePath(bad);
  assert.ok(path.airCurve);
  assert.equal(path.catchPoint, null);
  assert.equal(path.groundCurve, null);
  assert.equal(path.airCurve.getPoint(1).x, 50);
}
assert.equal(derivePath({ ...sample, yardline100: null, yards: null, geometry: { ...sample.geometry, losX: null } }), null);
console.log(`Validated ${touchdowns.length} real paths: ${catches} exact catch nodes, ${yacTrails} nonzero YAC trails; signed distances, deterministic placement, finite geometry, zero-YAC handling, short rushes, and null fallbacks pass.`);
