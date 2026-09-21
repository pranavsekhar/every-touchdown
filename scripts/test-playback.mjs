import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTimeline, chronological, cueState } from '../work/check/playback/timeline.js';
import { DrawTouchdown } from '../work/check/playback/DrawTouchdown.js';
import { createTouchdown } from '../work/check/touchdowns/geometry.js';
const plays = JSON.parse(readFileSync('public/data/2025/DET.json')).touchdowns;
const timeline = buildTimeline([...plays].reverse());
assert.equal(timeline.cues.length, 56);
assert.ok(Math.abs(timeline.duration - 40) < 1e-9);
const fixture = [
 { ...plays[0], id: 'a', quarter: 1, clock: '08:00', playId: '100' },
 { ...plays[0], id: 'b', quarter: 1, clock: '08:00', playId: '101' },
 { ...plays[0], id: 'c', quarter: 1, clock: '01:00', playId: '200' },
 { ...plays[0], id: 'd', quarter: 2, clock: '15:00', playId: '201' },
];
assert.deepEqual(chronological([...fixture].reverse()).map(p => p.id), ['a','b','c','d']);
for (let time = 0; time <= 40; time += 0.017) {
 const states = timeline.cues.map(c => cueState(c, time));
 assert.ok(states.filter(s => s.emphasis > 0).length <= 1);
 assert.ok(states.every(s => s.progress >= 0 && s.progress <= 1));
 const partial = states.findIndex(s => s.progress < 1);
 if (partial >= 0) assert.ok(states.slice(partial + 1).every(s => s.progress === 0));
}
const durations = timeline.cues.map(c => c.drawEnd-c.start);
assert.ok(Math.max(...durations) - Math.min(...durations) > .15);
for (const cue of timeline.cues) {
 const rendered = createTouchdown(cue.play);
 const draw = new DrawTouchdown(rendered);
 const baseline = rendered.group.children.map(m => ({ opacity: m.material.opacity, color: m.material.color.getHex(), positions: Array.from(m.geometry.attributes.position.array) }));
 const snapshot = time => {
  const state = cueState(cue, time); draw.setProgress(state.progress,state.emphasis,state.pulse,cue);
  return rendered.group.children.map(m => [m.visible,m.geometry.drawRange.count,m.material.opacity,m.scale.x]);
 };
 const a = snapshot(cue.start + (cue.drawEnd-cue.start)*.47);
 snapshot(40); snapshot(0);
 assert.deepEqual(snapshot(cue.start + (cue.drawEnd-cue.start)*.47), a, 'backward and forward seeks are deterministic');
 draw.setProgress(0,0,0,cue);
 assert.ok(rendered.group.children.every(m => !m.visible));
 if (rendered.path.airCurve && rendered.path.groundCurve) {
  draw.setProgress(cue.catchAt*.5,1,0,cue);
  assert.equal(rendered.group.getObjectByName('yac').visible,false);
  assert.equal(rendered.group.getObjectByName('catch').visible,false);
  draw.setProgress(cue.catchAt + (1-cue.catchAt)*.5,1,0,cue);
  assert.equal(rendered.group.getObjectByName('pass').geometry.drawRange.count,2304);
  assert.equal(rendered.group.getObjectByName('catch').visible,true);
  assert.equal(rendered.group.getObjectByName('yac').geometry.drawRange.count,1152);
 }
 draw.restore();
 rendered.group.children.forEach((m,i) => {
  assert.equal(m.visible,true); assert.equal(m.geometry.drawRange.count,Infinity);
  assert.equal(m.material.opacity,baseline[i].opacity); assert.equal(m.material.color.getHex(),baseline[i].color);
  assert.deepEqual(Array.from(m.geometry.attributes.position.array),baseline[i].positions);
  assert.equal(m.scale.x,1);
 });
}
assert.equal(timeline.cues.filter(c => c.play.airYards < 0).length,7);
console.log(`Playback: all 56 plays, 40-second chronology, sequential pass/catch/YAC, negative air yards, deterministic seeking and exact geometry/material restoration passed. Draw durations ${Math.min(...durations).toFixed(2)}–${Math.max(...durations).toFixed(2)}s.`);
