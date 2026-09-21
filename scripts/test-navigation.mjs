import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { focusFrame, constrainTarget, OVERVIEW_POSITION, OVERVIEW_TARGET } from '../work/check/scene/Navigation.js';
import { createTouchdown } from '../work/check/touchdowns/geometry.js';
const {touchdowns} = JSON.parse(readFileSync(new URL('../public/data/2025/DET.json',import.meta.url)));
const camera = new THREE.PerspectiveCamera(36,806/749,.1,600);
camera.position.copy(OVERVIEW_POSITION);camera.lookAt(OVERVIEW_TARGET);
for (const play of touchdowns) {
 const frame = focusFrame(createTouchdown(play),camera);
 assert.ok(frame.distance>=42 && frame.distance<=230);
 assert.ok(frame.center.x>=-55 && frame.center.x<=55 && Math.abs(frame.center.z)<=25);
 const direction = OVERVIEW_POSITION.clone().sub(OVERVIEW_TARGET).normalize();
 const position = frame.center.clone().addScaledVector(direction,frame.distance);
 assert.ok(position.clone().sub(frame.center).normalize().distanceTo(direction)<1e-10);
 assert.ok(position.y>1);
}
assert.deepEqual(constrainTarget(new THREE.Vector3(100,-10,-100)).toArray(),[55,.5,-25]);
assert.deepEqual(constrainTarget(new THREE.Vector3(-100,30,100)).toArray(),[-55,6,25]);
assert.ok(.5 + 38*Math.cos(Math.PI*.44)>7,'Minimum allowed height must stay safely above turf');
console.log('56 focus frames preserve viewing direction, fit within navigation bounds, and stay above the field. Pan clamps and close-camera clearance pass.');
const { Navigation } = await import('../work/check/scene/Navigation.js');
globalThis.matchMedia = () => ({matches:false});
class TestControls extends THREE.EventDispatcher {
 target=OVERVIEW_TARGET.clone();mouseButtons={};touches={};enableDamping=true;
 update(){camera.lookAt(this.target);camera.updateMatrixWorld();}
}
const controls = new TestControls();
const paths = touchdowns.map(createTouchdown);
const navigation = new Navigation(camera,controls,paths);
assert.equal(controls.minDistance,38);assert.equal(controls.enablePan,true);assert.equal(controls.screenSpacePanning,false);
navigation.focus(touchdowns[0].id); navigation.update(.2);
const intermediate=camera.position.clone(); controls.dispatchEvent({type:'start'}); navigation.update(.5);
assert.ok(camera.position.distanceTo(intermediate)<1e-10,'User input must cancel focus');
navigation.focus(touchdowns[0].id); navigation.update(.65);
const frame=focusFrame(paths[0],camera);
assert.ok(controls.target.distanceTo(frame.center)<1e-10);
assert.ok(Math.abs(camera.position.distanceTo(controls.target)-frame.distance)<1e-9);
controls.target.set(100,2,-100);navigation.update(.016);
assert.ok(controls.target.x===55 && controls.target.z===-25);
navigation.reset();
assert.ok(camera.position.distanceTo(OVERVIEW_POSITION)<1e-10);assert.ok(controls.target.distanceTo(OVERVIEW_TARGET)<1e-10);
navigation.dispose();
console.log('Focus completes smoothly, cancels on user input, clamps pan targets, and resets to the exact canonical overview.');
