import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {LandingReveal} from '../work/check/scene/LandingReveal.js';
import {createTouchdown} from '../work/check/touchdowns/geometry.js';
const plays=JSON.parse(readFileSync('public/data/2025/DET.json')).touchdowns;
for(const elapsed of [0,.2,.8,1.5,2.2]){
 const paths=plays.map(p=>createTouchdown(p));const field=new THREE.Group();const material=new THREE.MeshBasicMaterial({opacity:.8});field.add(new THREE.Mesh(new THREE.PlaneGeometry(),material));
 const baseline=paths.map(p=>p.group.children.map(m=>[m.material.opacity,m.material.color.getHex()]));
 const reveal=new LandingReveal(paths,plays,field);reveal.update(elapsed);reveal.finish();
 assert.equal(reveal.complete,true);assert.equal(material.opacity,.8);assert.equal(material.transparent,false);
 paths.forEach((p,i)=>p.group.children.forEach((m,j)=>{assert.equal(m.visible,true);assert.equal(m.geometry.drawRange.count,Infinity);assert.deepEqual([m.material.opacity,m.material.color.getHex()],baseline[i][j]);}));
}
for(const [team,year,name] of [['DET',2025,'Detroit Lions'],['MIA',2023,'Miami Dolphins'],['LV',2016,'Oakland Raiders']]){
 const html=readFileSync(`dist/${team}/${year}/index.html`,'utf8');assert.ok(html.includes(`<title>Every Touchdown — ${name} ${year}</title>`));assert.ok(html.includes('property="og:description"'));assert.ok(html.includes('name="twitter:title"'));
}
console.log('Reveal completes/cancels at every stage with exact restoration; built route metadata includes correct franchise names.');
