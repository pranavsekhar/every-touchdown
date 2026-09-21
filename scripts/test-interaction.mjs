import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createTouchdown } from '../work/check/touchdowns/geometry.js';
import { PathPicker } from '../work/check/interaction/PathPicker.js';
const data = JSON.parse(readFileSync(new URL('../public/data/2025/DET.json',import.meta.url)));
const paths = data.touchdowns.map(createTouchdown);
const picker = new PathPicker(paths);
const camera = new THREE.PerspectiveCamera(36,806/749,0.1,600);
camera.position.set(150,82,126); camera.lookAt(4,2,0);camera.updateMatrixWorld();picker.project(camera,806,749);
let reached = 0;
for (const p of paths) {
  let found = false;
  for (const curve of [p.path.airCurve,p.path.groundCurve]) {
    if (!curve || found) continue;
    for (const point of curve.getPoints(128)) {
      const s = point.clone().project(camera); const x = (s.x+1)*403, y=(1-s.y)*749/2;
      if (picker.pick(x,y) === p.group.name) { found=true;break; }
    }
  }
  assert.ok(found,`Unreachable play at default camera: ${p.group.name}`); reached++;
}
assert.equal(picker.pick(-200,-200),null);
assert.equal(picker.pick(400,20),null);
console.log(`${reached}/56 touchdowns individually reachable at default camera; empty space gives no hit.`);
const start = performance.now();
for (let i=0;i<1000;i++) picker.pick(300+(i%200),350+(i%100));
console.log(`Picking cost: ${((performance.now()-start)/1000).toFixed(3)} ms per query (1,000 queries).`);
