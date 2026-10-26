import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {paletteFor,paintTouchdown} from '../work/check/appearance.js';
import {teams} from '../work/check/data/teams.js';
import {filterTouchdowns} from '../work/check/data/filter.js';
import {createTouchdown} from '../work/check/touchdowns/geometry.js';
import {DrawTouchdown} from '../work/check/playback/DrawTouchdown.js';
import {buildTimeline} from '../work/check/playback/timeline.js';
import {PathPicker} from '../work/check/interaction/PathPicker.js';
const plays=JSON.parse(readFileSync('public/data/2025/DET.json')).touchdowns;
const paths=plays.map(p=>createTouchdown(p));
const camera=new THREE.PerspectiveCamera(36,806/749,.1,600);camera.position.set(150,82,126);camera.lookAt(4,2,0);
for(const [type,count] of [['all',56],['pass',35],['rush',21]]) {
 const filtered=filterTouchdowns(plays,type),ids=new Set(filtered.map(p=>p.id));
 assert.equal(filtered.length,count);
 assert.deepEqual(buildTimeline(filtered).cues.map(c=>c.play.id).sort(),[...ids].sort());
 const picker=new PathPicker(paths.filter(p=>ids.has(p.group.name)));picker.project(camera,806,749);
 for(let x=0;x<806;x+=9)for(let y=0;y<749;y+=9){const id=picker.pick(x,y);assert.ok(id===null||ids.has(id),'Filtered-out plays cannot be picked');}
}
for(const team of Object.keys(teams))for(const theme of ['light','dark']) {
 const palette=paletteFor(team,theme);assert.notEqual(palette.pass,palette.rush);
 for(const type of ['pass','rush']) {
  const play=plays.find(p=>p.type===type), rendered=createTouchdown(play);
  const before=rendered.group.children.map(m=>Array.from(m.geometry.attributes.position.array));
  paintTouchdown(rendered.group,palette,type);
  const drawing=new DrawTouchdown(rendered),cue=buildTimeline([play]).cues[0];
  drawing.setProgress(.47,1,0,cue);
  const reveal=rendered.group.children.map(m=>[m.visible,m.geometry.drawRange.count]);
  paintTouchdown(rendered.group,paletteFor(team,theme==='light'?'dark':'light'),type);
  drawing.refreshAppearance();drawing.setProgress(.47,1,0,cue);
  assert.deepEqual(rendered.group.children.map(m=>[m.visible,m.geometry.drawRange.count]),reveal,'Theme preserves playback reveal');
  drawing.restore();
  rendered.group.children.forEach((m,i)=>{assert.deepEqual(Array.from(m.geometry.attributes.position.array),before[i]);assert.equal(m.material.color.getHex(),m.material.userData.restColor.getHex());assert.equal(m.material.opacity,m.material.userData.restOpacity);});
 }
}
console.log('32 team palettes × 2 themes: geometry and partial playback preserved; ALL/PASS/RUSH counts, timelines and hit exclusion pass.');
