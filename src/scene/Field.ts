import * as THREE from 'three';
import { paletteFor, type Palette } from '../appearance.js';
export function createField(label = 'DETROIT', palette: Palette = paletteFor('DET','light')) {
  const group = new THREE.Group();
  const dark=palette.theme==='dark';
  const slab = new THREE.Mesh(new THREE.BoxGeometry(120, 0.9, 53.3), new THREE.MeshStandardMaterial({ color: dark?'#3b4649':'#cecfc4', roughness: 0.95, metalness: 0.12 }));
  slab.position.y = -0.48; group.add(slab);
  const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1066;
  const c = canvas.getContext('2d')!;
  const scale = 20;
  c.fillStyle = dark?'#354347':'#e8ece4'; c.fillRect(0, 0, 2400, 1066);
  c.fillStyle = dark?'#394a4e':'#dde5da'; c.fillRect(0, 0, 200, 1066); c.fillRect(2200, 0, 200, 1066);
  c.globalAlpha=dark?.13:.10; c.fillStyle=palette.pass; c.fillRect(2200,0,200,1066); c.globalAlpha=1;
  for (let x = 10; x < 110; x += 10) { c.fillStyle = 'rgba(98,119,107,0.025)'; c.fillRect(x * scale, 0, 5 * scale, 1066); }
  c.strokeStyle = dark?'rgba(190,207,203,0.27)':'rgba(100,117,108,0.26)'; c.lineWidth = 1.8;
  c.strokeRect(2, 2, 2396, 1062);
  for (let x = 10; x <= 110; x += 5) { c.beginPath(); c.moveTo(x * scale, 0); c.lineTo(x * scale, 1066); c.stroke(); }
  c.strokeStyle = dark?'rgba(190,207,203,0.23)':'rgba(100,117,108,0.23)';
  for (let x = 11; x < 110; x++) {
    if (x % 5 === 0) continue;
    for (const z of [0.5, 23.55, 28.75, 51.8]) { c.beginPath(); c.moveTo(x * scale, z * scale); c.lineTo(x * scale, (z + 0.85) * scale); c.stroke(); }
  }
  c.fillStyle = dark?'rgba(190,207,203,0.52)':'rgba(100,117,108,0.52)'; c.font = '500 62px Helvetica Neue, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let x = 20; x <= 100; x += 10) {
    const n = String(Math.min(x - 10, 110 - x));
    c.save(); c.translate(x * scale, 870); c.fillText(n, 0, 0); c.restore();
    c.save(); c.translate(x * scale, 196); c.rotate(Math.PI); c.fillText(n, 0, 0); c.restore();
  }
  c.font = '500 58px Helvetica Neue, Arial'; c.fillStyle = palette.pass; c.globalAlpha=dark?.48:.45;
  for (const x of [2300]) { c.save(); c.translate(x, 533); c.rotate(-Math.PI / 2); c.fillText(label.toUpperCase().split('').join(' '), 0, 0); c.restore(); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(120, 53.3), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  surface.rotation.x = -Math.PI / 2; surface.position.y = 0.01; group.add(surface);
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(120.2, 0.95, 53.5)), new THREE.LineBasicMaterial({ color: '#a2afa0', transparent: true, opacity: 0.1 })); border.position.y = -0.48; group.add(border);
  // NFL goalposts: end line, 18 ft 6 in opening, crossbar 10 ft above the field.
  const metal=new THREE.MeshBasicMaterial({color:dark?'#a8b3b2':'#7d8981',transparent:true,opacity:.57,toneMapped:false});
  const bar=(a:THREE.Vector3,b:THREE.Vector3)=>{const d=b.clone().sub(a); const m=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,d.length(),8),metal); m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());group.add(m);};
  for(const sign of [-1,1]) {
   const x=sign*60, half=37/12, h=10/3;
   bar(new THREE.Vector3(sign*62,0,0),new THREE.Vector3(sign*62,h,0));
   bar(new THREE.Vector3(sign*62,h,0),new THREE.Vector3(x,h,0));
   bar(new THREE.Vector3(x,h,-half),new THREE.Vector3(x,h,half));
   for(const z of [-half,half]) bar(new THREE.Vector3(x,h,z),new THREE.Vector3(x,15,z));
  }
  return group;
}
