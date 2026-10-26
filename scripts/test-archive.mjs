import assert from 'node:assert/strict';
import fs from 'node:fs';
import { derivePath } from '../work/check/touchdowns/geometry.js';
import { buildTimeline, cueState } from '../work/check/playback/timeline.js';
const catalog=JSON.parse(fs.readFileSync('public/data/index.json'));
let datasets=0, touchdowns=0, missing=0;
for(const [year, teams] of Object.entries(catalog.seasons)) for(const [team,summary] of Object.entries(teams)) {
 const data=JSON.parse(fs.readFileSync(`public/data/${year}/${team}.json`));
 assert.equal(data.team,team); assert.equal(data.season,Number(year));
 assert.equal(data.touchdowns.length,summary.total);
 assert.equal(new Set(data.touchdowns.map(p=>p.id)).size,summary.total);
 assert.equal(summary.passing+summary.rushing,summary.total);
 assert.equal(data.summary.unrenderablePlays,0);
 const timeline=buildTimeline(data.touchdowns);
 assert.ok(timeline.cues.every(c=>c.drawEnd>c.start&&c.end>c.drawEnd));
 assert.ok(timeline.duration>=12-1e-8&&timeline.duration<60);
 assert.ok(timeline.cues.every(c=>cueState(c,timeline.duration).progress===1));
 for(const p of data.touchdowns) {
  assert.ok(p.description&&p.playId&&p.gameId);
  assert.ok(p.homeAway==='home'||p.homeAway==='away');
  const path=derivePath(p);assert.ok(path, p.id);
  assert.equal(path.los,p.geometry.losX);assert.equal(path.endX,50);
  for(const curve of [path.airCurve,path.groundCurve]) if(curve) for(const point of curve.getPoints(16)) assert.ok(Number.isFinite(point.x+point.y+point.z));
  if(p.geometry.segmentation==='recorded') {
   assert.ok(Math.abs(path.catchPoint.x-path.los-p.airYards)<.01);
   assert.ok(Math.abs(50-path.catchPoint.x-p.yardsAfterCatch)<.01);
  } else if(p.type==='pass') {assert.equal(path.catchPoint,null);missing++;}
 }
 datasets++;touchdowns+=summary.total;
}
assert.equal(datasets,320);assert.deepEqual(Object.keys(catalog.seasons),Array.from({length:10},(_,i)=>String(2016+i)));
assert.deepEqual(fs.readdirSync('public/data').filter(n=>/^\d{4}$/.test(n)).sort(),Object.keys(catalog.seasons));
assert.ok(catalog.seasons['2016'].HOU);assert.equal(catalog.seasons['2015'],undefined);
console.log(`${datasets} datasets / ${touchdowns} touchdowns: unique source IDs, finite geometry, signed distances, historical availability, and dynamic playback pass. ${missing} unsegmented passes remain explicitly flagged.`);
