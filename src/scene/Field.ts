import * as THREE from 'three';
export function createField() {
  const group = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(120, 0.9, 53.3), new THREE.MeshStandardMaterial({ color: '#182129', roughness: 0.95, metalness: 0.12 }));
  slab.position.y = -0.48; group.add(slab);
  const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1066;
  const c = canvas.getContext('2d')!;
  const scale = 20;
  c.fillStyle = '#162027'; c.fillRect(0, 0, 2400, 1066);
  c.fillStyle = '#192730'; c.fillRect(0, 0, 200, 1066); c.fillRect(2200, 0, 200, 1066);
  for (let x = 10; x < 110; x += 10) { c.fillStyle = 'rgba(220,230,235,0.018)'; c.fillRect(x * scale, 0, 5 * scale, 1066); }
  c.strokeStyle = 'rgba(220,222,214,0.24)'; c.lineWidth = 1.8;
  c.strokeRect(2, 2, 2396, 1062);
  for (let x = 10; x <= 110; x += 5) { c.beginPath(); c.moveTo(x * scale, 0); c.lineTo(x * scale, 1066); c.stroke(); }
  c.strokeStyle = 'rgba(220,222,214,0.15)';
  for (let x = 11; x < 110; x++) {
    if (x % 5 === 0) continue;
    for (const z of [0.5, 23.55, 28.75, 51.8]) { c.beginPath(); c.moveTo(x * scale, z * scale); c.lineTo(x * scale, (z + 0.85) * scale); c.stroke(); }
  }
  c.fillStyle = 'rgba(225,226,217,0.24)'; c.font = '500 62px Helvetica Neue, Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let x = 20; x <= 100; x += 10) {
    const n = String(Math.min(x - 10, 110 - x));
    c.save(); c.translate(x * scale, 870); c.fillText(n, 0, 0); c.restore();
    c.save(); c.translate(x * scale, 196); c.rotate(Math.PI); c.fillText(n, 0, 0); c.restore();
  }
  c.font = '500 58px Helvetica Neue, Arial'; c.fillStyle = 'rgba(159,185,199,0.16)';
  for (const x of [100, 2300]) { c.save(); c.translate(x, 533); c.rotate(-Math.PI / 2); c.fillText('D E T R O I T', 0, 0); c.restore(); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(120, 53.3), new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 }));
  surface.rotation.x = -Math.PI / 2; surface.position.y = 0.01; group.add(surface);
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(120.2, 0.95, 53.5)), new THREE.LineBasicMaterial({ color: '#71848c', transparent: true, opacity: 0.1 })); border.position.y = -0.48; group.add(border);
  return group;
}
