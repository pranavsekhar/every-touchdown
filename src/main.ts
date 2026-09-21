import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createField } from './scene/Field';
import { loadSeason } from './data/loader';
import { createTouchdown } from './touchdowns/geometry';
import { Navigation } from './scene/Navigation';
import { SeasonPlayer } from './playback/SeasonPlayer';
import { Exploration } from './interaction/Exploration';

const app = document.querySelector<HTMLDivElement>('#app')!;
async function initialize() {
const data = await loadSeason();
const touchdowns = data.touchdowns;
app.innerHTML = `
<header><a class="wordmark" href="/" aria-label="Every Touchdown home"><span class="brand-mark" aria-hidden="true">∩</span> EVERY TOUCHDOWN</a><span class="edition">A SEASON IN SPACE <span class="slash">/</span> DET / 2025</span></header>
<main><section class="heading" aria-label="Team and season"><div><div class="eyebrow"><span></span> DETROIT LIONS</div><h1>Every score.<br>One sculpture.</h1></div><div class="season">2025<span>REGULAR SEASON</span></div></section>
<div id="scene" role="group" aria-roledescription="interactive touchdown sculpture" aria-keyshortcuts="ArrowUp ArrowDown Enter Escape F" aria-label="Use Up and Down to explore touchdowns, Enter to select, F to focus, Shift plus Left/Right/Up/Down to pan, Escape to clear. Interactive 3D football field with ${data.summary.passing} real passing touchdowns in blue and ${data.summary.rushing} real rushing touchdowns in silver. All paths travel toward the right end zone." tabindex="0"></div>
<section id="play-caption" class="play-caption" role="status" aria-live="polite" aria-atomic="true" aria-hidden="true"><p id="play-name"></p><p id="play-yards"></p><p id="play-split"></p><p id="play-game"></p><p id="play-description" class="play-description" aria-hidden="true"></p></section>
<div class="scene-note"><span class="tiny-cross">+</span> DET / 42.3400° N, 83.0456° W</div>
<div class="camera-tools" aria-label="Camera controls"><button id="play-season">▷ <span>Play Season</span></button><button id="rotate-left" aria-label="Rotate view left">↶</button><button id="reset" title="Reset view (R)">Reset view <span>↗</span></button><button id="rotate-right" aria-label="Rotate view right">↷</button></div>
<section id="season-player" class="season-player" aria-label="Season playback" hidden><div class="player-top"><span id="season-time"></span><div><button id="season-pause">Pause</button><button id="season-restart">Restart</button><button id="season-exit">Exit</button></div></div><input id="season-seek" aria-label="Season progression" type="range" min="0" max="40" step="0.01" value="0"></section>
<p id="season-moment" hidden>2025 DETROIT LIONS<span>56 TOUCHDOWNS</span></p>
<footer><div class="count"><strong>${data.summary.total}</strong><div>TOUCHDOWNS<span>Offense · 2025 · nflverse</span></div></div><div class="legend"><span><i class="pass"></i>Pass + catch & run <b>${data.summary.passing}</b></span><span><i class="rush"></i>Rush <b>${data.summary.rushing}</b></span></div><div class="instructions">Drag to orbit <span>·</span> Shift-drag to pan <span>·</span> Scroll to zoom</div></footer>
<div class="bottom-line"><span>THE SHAPE OF A SEASON.</span><button id="about" aria-expanded="false" aria-controls="data-note">About the data <span>+</span></button></div>
<aside id="data-note" hidden>Every path is a Detroit 2025 offensive touchdown from nflverse. Downfield distance, air yards, and yards after catch come from play-by-play data. Catch nodes separate aerial passes from lower run-after-catch trails. Lateral placement and arc height are illustrative, not NFL tracking coordinates. Scores end at the goal-line plane; returns are excluded.</aside>
</main>`;
const container = document.querySelector<HTMLDivElement>('#scene')!;
let renderer: THREE.WebGLRenderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch { container.innerHTML = '<p class="fallback">This sculpture needs WebGL. Please open it in a browser with hardware acceleration enabled.</p>'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x080b0d, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.065; controls.enablePan = true;
controls.minPolarAngle = Math.PI * 0.15; controls.maxPolarAngle = Math.PI * 0.43;
controls.minDistance = 115; controls.maxDistance = 255; controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.65;
controls.target.set(4, 2, 0);
let navigation: Navigation | undefined;
const home = () => { if (navigation) navigation.reset(); else { camera.position.set(150, 82, 126); controls.target.set(4, 2, 0); controls.update(); } };
home();
scene.add(new THREE.HemisphereLight('#d5e5ed', '#29313a', 2.7));
const key = new THREE.DirectionalLight('#ebf2f6', 2.4); key.position.set(-30, 80, 40); scene.add(key);
scene.add(createField());
const paths = touchdowns.map(createTouchdown).filter(p => p !== null);
paths.forEach(p => scene.add(p.group));
if (paths.length !== touchdowns.length) console.error('Some source touchdowns could not be rendered', { expected: touchdowns.length, rendered: paths.length });
container.dataset.touchdownCount = String(paths.length);
container.dataset.passingCount = String(touchdowns.filter(p => p.type === 'pass').length);
container.dataset.rushingCount = String(touchdowns.filter(p => p.type === 'rush').length);
container.dataset.sourceSha256 = data.source.sha256;
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 256;
const ctx = shadowCanvas.getContext('2d')!; const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128); gradient.addColorStop(0, 'rgba(0,0,0,0.55)'); gradient.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(175, 100), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.5; scene.add(shadow);
const resize = () => { const { width, height } = container.getBoundingClientRect(); renderer.setSize(width, height); camera.aspect = width / height; camera.fov = camera.aspect < 0.8 ? 51 : 36; camera.updateProjectionMatrix(); };
const observer = new ResizeObserver(resize); observer.observe(container); resize();
function rotate(amount: number) { if (!controls.enabled) return; navigation?.interrupt(); const offset = camera.position.clone().sub(controls.target); offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), amount); camera.position.copy(controls.target).add(offset); controls.update(); }
document.querySelector('#reset')!.addEventListener('click', home);
document.querySelector('#rotate-left')!.addEventListener('click', () => rotate(-0.2));
document.querySelector('#rotate-right')!.addEventListener('click', () => rotate(0.2));
container.addEventListener('keydown', e => { if (!controls.enabled) return; if (e.shiftKey && e.key.startsWith('Arrow')) navigation?.interrupt(); if (!e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); rotate(e.key === 'ArrowLeft' ? -0.15 : 0.15); } if (e.key.toLowerCase() === 'r') home(); });
const about = document.querySelector<HTMLButtonElement>('#about')!;
about.addEventListener('click', () => { const note = document.querySelector<HTMLElement>('#data-note')!; note.hidden = !note.hidden; about.setAttribute('aria-expanded', String(!note.hidden)); });
navigation = new Navigation(camera, controls, paths);
const exploration = new Exploration(container, renderer.domElement, camera, controls, paths, touchdowns, id => navigation!.focus(id));
const player = new SeasonPlayer(touchdowns, paths, camera, controls, navigation, exploration, scene, container);
let previousFrame = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - previousFrame) / 1000, 0.1); previousFrame = now;
  navigation!.update(dt);
  exploration.update(dt);
  player.update(dt);
  renderer.render(scene, camera);
});
renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); renderer.setAnimationLoop(null); container.innerHTML = '<p class="fallback">The graphics connection was interrupted. Refresh to return to the sculpture.</p>'; });
window.addEventListener('pagehide', () => { renderer.setAnimationLoop(null); observer.disconnect(); player.dispose(); exploration.dispose(); navigation?.dispose(); controls.dispose(); scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => { if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose(); material.dispose(); }); } }); renderer.dispose(); });

}
initialize().catch(error => {
  console.error(error);
  app.innerHTML = '<p class="fallback">The Detroit season could not be loaded. Please refresh to try again.</p>';
});
