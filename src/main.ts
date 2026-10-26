import { analyticsContext, track } from './analytics';
import { LandingReveal } from './scene/LandingReveal';
import { paletteFor, paintTouchdown, type Theme } from './appearance';
import type { Touchdown } from './data/types';
import { filterTouchdowns, type TouchdownFilter } from './data/filter';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createField } from './scene/Field';
import { loadCatalog, loadSeason } from './data/loader';
import { teams, aliases, teamName } from './data/teams';
import { createTouchdown } from './touchdowns/geometry';
import { Navigation } from './scene/Navigation';
import { SeasonPlayer } from './playback/SeasonPlayer';
import { Exploration } from './interaction/Exploration';
import type { RenderedTouchdown } from './interaction/PathPicker';

const app = document.querySelector<HTMLDivElement>('#app')!;
async function initialize() {

app.innerHTML = `
<header><a class="wordmark" href="/" aria-label="Every Touchdown home">Every Touchdown</a><button id="theme-toggle" aria-label="Switch to dark theme">Dark theme</button></header>
<main><section class="heading" aria-label="Team and season"><div><div class="eyebrow"><button id="choose-team" aria-haspopup="dialog">Choose team</button></div></div><div class="season"><button id="choose-season" aria-haspopup="dialog">2025</button><span id="season-scope"></span></div></section>
<div id="scene" role="group" aria-roledescription="interactive touchdown sculpture" tabindex="0"></div>
<section id="play-caption" class="play-caption" role="status" aria-live="polite" aria-atomic="true" aria-hidden="true"><p id="play-name"></p><p id="play-yards"></p><p id="play-split"></p><p id="play-game"></p><p id="play-description" class="play-description" aria-hidden="true"></p></section>

<div class="camera-tools" aria-label="Camera controls"><button id="play-season"><svg viewBox="0 0 12 14" aria-hidden="true"><path d="M2 1.5 10.5 7 2 12.5Z"/></svg><span>Play Season</span></button><button id="rotate-left" aria-label="Rotate view left">↶</button><button id="reset" title="Reset view (R)">Reset view</button><button id="rotate-right" aria-label="Rotate view right">↷</button></div>
<section id="season-player" class="season-player" aria-label="Season playback" hidden><div class="player-top"><span id="season-time"></span><div><button id="season-pause">Pause</button><button id="season-restart">Restart</button><button id="season-exit">Exit</button></div></div><input id="season-seek" aria-label="Season progression" type="range" min="0" max="40" step="0.01" value="0"></section>
<p id="season-moment" hidden></p>
<section id="route-error" role="alert" hidden><p></p><a href="/DET/2025">Return to Detroit 2025 ↗</a></section>
<footer><div class="count"><strong id="td-count"></strong><div>Touchdowns<span id="source-caption"></span></div></div><div class="legend" role="group" aria-label="Touchdown type"><button data-filter="all" aria-pressed="true">All <b id="all-count"></b></button><button data-filter="pass" aria-pressed="false"><i class="pass"></i>Pass <b id="pass-count"></b></button><button data-filter="rush" aria-pressed="false"><i class="rush"></i>Rush <b id="rush-count"></b></button></div><div class="instructions">Drag to orbit <span>·</span> Shift-drag to pan <span>·</span> Scroll to zoom</div></footer>
<div class="bottom-line"><button id="about" aria-expanded="false" aria-controls="help" aria-haspopup="dialog">About the data</button></div>
<p id="route-notice" role="status" hidden></p>
</main><dialog id="picker" aria-labelledby="picker-title"><div class="picker-heading"><h2 id="picker-title"></h2><button id="close-picker" aria-label="Close picker">×</button></div><div id="picker-options"></div><p class="picker-note">Regular season + postseason · nflverse</p></dialog><dialog id="help" aria-labelledby="help-title"><div class="picker-heading"><h2 id="help-title">Every path is a touchdown.</h2><button id="close-help" aria-label="Close help">×</button></div><p class="intro-lead">This sculpture shows every offensive touchdown from your team’s season.</p><p>Passes rise to the catch, then follow the run. Rushes stay near the field.</p><p>Drag to explore. Select a path to inspect the play, or press <strong>Play Season</strong> to watch the year unfold.</p><button id="explore-season" class="intro-action" autofocus>Explore the season</button><details class="help-methodology"><summary>How the paths use the data</summary><dl><dt>Passing</dt><dd>The aerial arc runs from the line of scrimmage to the catch point using air yards. The lower continuation shows yards after catch.</dd><dt>Rushing</dt><dd>The field-level path shows the scoring run from the line of scrimmage to the end zone.</dd><dt>Placement & data</dt><dd>Paths use nflverse/nflfastR play-by-play. Lateral placement uses coarse left/middle/right locations and deterministic variation—not player tracking. Missing air/YAC is shown without an invented catch. Defensive and special-teams scores are excluded.</dd></dl><p class="help-controls">Drag to orbit · Shift/right-drag to pan · Scroll or two-finger pinch to zoom/pan · Click/tap a path to inspect · Double-click to focus · Play Season builds chronologically.</p><p class="help-controls">Keyboard: focus the field, then ↑/↓ to explore, Enter to select, F to focus, R to reset, Escape to clear.</p></details></dialog>`;
const container = document.querySelector<HTMLDivElement>('#scene')!;
const main = document.querySelector('main')!;
const picker = document.querySelector<HTMLDialogElement>('#picker')!;
const [catalog] = await Promise.all([loadCatalog(),document.fonts.load('400 12px "Plex Mono"').catch(()=>[]),document.fonts.load('500 12px Plex').catch(()=>[])]);
let renderer: THREE.WebGLRenderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
catch { throw new Error('This sculpture needs WebGL. Please use a browser with hardware acceleration enabled.'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0xf7f5ef, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.35;
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 600);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
camera.position.set(150,82,126); controls.target.set(4,2,0); controls.update();
scene.add(new THREE.HemisphereLight('#ffffff', '#c8c8be', 2.1));
const key = new THREE.DirectionalLight('#fffaf0', 2.0); key.position.set(-30,80,40); scene.add(key);
const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 256;
const ctx = shadowCanvas.getContext('2d')!;
const gradient = ctx.createRadialGradient(128,128,0,128,128,128); gradient.addColorStop(0,'rgba(69,76,65,0.17)'); gradient.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gradient; ctx.fillRect(0,0,256,256);
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(175,100),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false})); shadow.rotation.x=-Math.PI/2; shadow.position.y=-1.5; scene.add(shadow);
let paths: RenderedTouchdown[] = [], field: THREE.Group | undefined;
let navigation: Navigation | undefined, exploration: Exploration | undefined, player: SeasonPlayer | undefined;
let reveal: LandingReveal | undefined, firstLoad=true;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function finishReveal(){reveal?.finish();reveal=undefined;}
let currentTeam='DET', currentYear=2025, request=0, pending: AbortController | undefined;
const events = new AbortController(); const options = {signal:events.signal};
function disposeObject(root: THREE.Object3D) {
  root.removeFromParent();
  const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
  root.traverse(o => { if(o instanceof THREE.Mesh || o instanceof THREE.LineSegments) { geometries.add(o.geometry); (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m)); } });
  materials.forEach(m => { if('map' in m && m.map instanceof THREE.Texture) textures.add(m.map); m.dispose(); });
  textures.forEach(t=>t.dispose()); geometries.forEach(g=>g.dispose());
}
function disposeSeason() {
  finishReveal();
  player?.dispose(); exploration?.dispose(); navigation?.dispose();
  player=undefined; exploration=undefined; navigation=undefined;
  paths.forEach(p=>disposeObject(p.group)); paths=[];
  if(field) disposeObject(field); field=undefined;
  document.querySelector('#play-caption')!.classList.remove('visible');
  document.querySelector('#play-description')!.classList.remove('visible');
  container.removeAttribute('aria-describedby'); container.dataset.selectedPlay=''; container.dataset.activePlay='';
  container.dataset.playback='exploring'; delete container.dataset.playbackTime; delete container.dataset.completedTouchdowns;
  container.setAttribute('aria-label','No season selected');
}
const text = (id: string, value: string) => { document.querySelector(id)!.textContent=value; };
let theme: Theme = 'light';
try { if(localStorage.getItem('touchdown-theme')==='dark') theme='dark'; } catch {}
let filter: TouchdownFilter = 'all';
let plays: Touchdown[]=[];
const weights=new Map<string,number>();
function setTheme() {
 finishReveal();
 const palette=paletteFor(currentTeam,theme);
 document.documentElement.dataset.theme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='light'?'#f7f5ef':'#202a30');
 document.documentElement.style.setProperty('--team-accent',palette.pass);
 document.documentElement.style.setProperty('--rush-accent',palette.rush);
 text('#theme-toggle',theme==='light'?'Dark theme':'Light theme');
 document.querySelector('#theme-toggle')!.setAttribute('aria-label',`Switch to ${theme==='light'?'dark':'light'} theme`);
 if(field) {disposeObject(field);field=createField(currentTeam,palette);scene.add(field);}
 paths.forEach((p,i)=>paintTouchdown(p.group,palette,plays[i].type));
 exploration?.refreshAppearance();player?.refreshAppearance();
}
function applyFilter() {
 finishReveal();
 if(plays.length && !filterTouchdowns(plays,filter).length)filter='all';
 player?.dispose(); exploration?.setSuspended(true); exploration?.dispose();
 const visible=filterTouchdowns(plays,filter), ids=new Set(visible.map(p=>p.id));
 const shown=paths.filter(p=>ids.has(p.group.name));
 // Restore baseline materials before the new interaction records capture their state.
 paths.forEach(p=>p.group.traverse(o=>{if(o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) o.material.opacity=o.material.userData.restOpacity;}));
 exploration=new Exploration(container,renderer.domElement,camera,controls,shown,visible,id=>navigation!.focus(id));
 player=visible.length?new SeasonPlayer(visible,shown,camera,controls,navigation!,exploration,scene,container,`${currentYear} ${teamName(currentTeam,currentYear)}`):undefined;
 document.querySelector<HTMLButtonElement>('#play-season')!.disabled=!visible.length;
 text('#td-count',String(visible.length));
 text('#all-count',String(plays.length));
 document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
 container.dataset.filter=filter;container.dataset.visibleTouchdownCount=String(visible.length);container.dataset.playback='exploring';
 const count=document.querySelector('#season-moment span');if(count) count.textContent=`${visible.length} TOUCHDOWNS`;
}
document.querySelector('#theme-toggle')!.addEventListener('click',()=>{theme=theme==='light'?'dark':'light';try{localStorage.setItem('touchdown-theme',theme);}catch{}setTheme();track('theme_toggle',{theme});},options);
document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>b.addEventListener('click',()=>{if(!paths.length||main.classList.contains('is-changing'))return;filter=b.dataset.filter as typeof filter;applyFilter();track('type_filter',{type:filter});},options));
setTheme();
async function navigate(team: string, year: number, push = true) {
  finishReveal();
  if(push)document.querySelector<HTMLElement>('#route-notice')!.hidden=true;
  if(push) history.pushState(null,'',`/${team}/${year}`);
  const token=++request; pending?.abort(); pending=new AbortController();
  main.classList.add('is-changing'); exploration?.setSuspended(true); player?.dispose(); player=undefined;
  const error=document.querySelector<HTMLElement>('#route-error')!; error.hidden=true;
  if(year < 2016 || year > 2025 || !teams[team] || !catalog.seasons[year]?.[team]) {
    history.replaceState(null,'','/DET/2025');
    const notice=document.querySelector<HTMLElement>('#route-notice')!;notice.textContent='That season is unavailable. Showing Detroit 2025.';notice.hidden=false;
    await navigate('DET',2025,false);return;
  }
  try {
    const [data] = await Promise.all([loadSeason(team,year,pending.signal),new Promise(resolve=>setTimeout(resolve,180))]);
    if(token!==request) return;
    disposeSeason(); main.classList.remove('invalid-route');
    const previousTeam=currentTeam,previousYear=currentYear;
    currentTeam=team; currentYear=year;analyticsContext(team,year);track('season_view');
    if(push && previousTeam!==team)track('team_change');if(push && previousYear!==year)track('season_change');
    const name=teamName(team,year), accent=paletteFor(team,theme).pass;
    document.documentElement.style.setProperty('--team-accent',accent);
    text('#choose-team',name); text('#choose-season',String(year));

    text('#season-scope',data.seasonTypes.includes('POST')?'Regular + postseason':'Regular season');
    text('#td-count',String(data.summary.total)); text('#pass-count',String(data.summary.passing)); text('#rush-count',String(data.summary.rushing));
    text('#source-caption',`Offense · ${year} · nflverse`);
    const moment=document.querySelector('#season-moment')!; moment.replaceChildren(document.createTextNode(`${year} ${name.toUpperCase()}`)); const count=document.createElement('span'); count.textContent=`${data.summary.total} TOUCHDOWNS`; moment.append(count);
    document.title=`Every Touchdown — ${name} ${year}`;
    const description=`Explore every offensive touchdown from the ${name}' ${year} season as an interactive 3D visualization.`;
    for(const key of ['description','og:description','twitter:description'])document.querySelector(`meta[${key.startsWith('og:')?'property':'name'}="${key}"]`)?.setAttribute('content',description);
    for(const key of ['og:title','twitter:title'])document.querySelector(`meta[${key.startsWith('og:')?'property':'name'}="${key}"]`)?.setAttribute('content',document.title);
    const site=import.meta.env.VITE_SITE_URL||document.querySelector<HTMLLinkElement>('link[rel=canonical]')?.href;
    if(site){const url=new URL(`/${team}/${year}`,site).href;document.querySelector('link[rel=canonical]')?.setAttribute('href',url);document.querySelector('meta[property="og:url"]')?.setAttribute('content',url);}
    field=createField(team,paletteFor(team,theme)); scene.add(field);
    paths=data.touchdowns.map(p=>createTouchdown(p,accent)).filter(p=>p!==null);
    if(paths.length!==data.touchdowns.length) throw new Error('Some touchdowns could not be rendered.');
    paths.forEach(p=>scene.add(p.group));
    navigation=new Navigation(camera,controls,paths);
    plays=data.touchdowns; weights.clear(); paths.forEach(p=>weights.set(p.group.name,filter==='all'||plays.find(t=>t.id===p.group.name)!.type===filter?1:0));
    setTheme(); applyFilter();
    container.dataset.touchdownCount=String(paths.length); container.dataset.team=team; container.dataset.season=String(year);
    container.dataset.passingCount=String(data.summary.passing); container.dataset.rushingCount=String(data.summary.rushing);
    container.setAttribute('aria-label',`${name} ${year}: ${paths.length} real offensive touchdowns. Drag to orbit, Shift-drag to pan, scroll to zoom. Up/Down explores plays, Enter selects, F focuses, Escape clears, R resets.`);
    main.classList.remove('is-changing');
    const introduced=firstLoad && showFirstVisit();
    if(firstLoad && !reduced.matches && !introduced)reveal=new LandingReveal(paths,plays,field!);firstLoad=false;
  } catch(e) {
    if(token!==request || (e instanceof Error && e.name==='AbortError')) return;
    disposeSeason(); main.classList.remove('is-changing'); main.classList.add('invalid-route'); error.hidden=false;
    error.querySelector('p')!.textContent="We couldn't load this season. Choose another team or season, or return to Detroit.";
  }
}
function readRoute() {
  const segments=location.pathname.split('/').filter(Boolean);
  if(!segments.length) { history.replaceState(null,'','/DET/2025'); void navigate('DET',2025,false); return; }
  const raw=segments[0].toUpperCase(), team=aliases[raw]??raw, year=Number(segments[1]);
  if(segments.length!==2 || !/^\d{4}$/.test(segments[1]??'')) { void navigate('',0,false); return; }
  if(team!==segments[0] && teams[team] && catalog.seasons[year]?.[team]) history.replaceState(null,'',`/${team}/${year}`);
  void navigate(team,year,false);
}
function openPicker(kind:'team'|'season') {
  text('#picker-title',kind==='team'?'Choose a team':'Choose a season');
  const grid=document.querySelector('#picker-options')!; grid.replaceChildren(); grid.className=kind;
  const values=kind==='team'?Object.keys(teams).sort((a,b)=>teamName(a,currentYear).localeCompare(teamName(b,currentYear))):Object.keys(catalog.seasons).filter(y=>Number(y)>=2016&&Number(y)<=2025&&catalog.seasons[y][currentTeam]).sort((a,b)=>Number(b)-Number(a));
  for(const value of values) {
    const button=document.createElement('button');
    button.textContent=kind==='team'?`${value}  ·  ${teamName(value,currentYear)}`:value;
    button.setAttribute('aria-pressed',String(kind==='team'?value===currentTeam:Number(value)===currentYear));
    button.disabled=kind==='team'&&!catalog.seasons[currentYear]?.[value];
    if(button.disabled) button.title=`No ${currentYear} season`;
    button.addEventListener('click',()=>{picker.close();void navigate(kind==='team'?value:currentTeam,kind==='season'?Number(value):currentYear);}); grid.append(button);
  }
  picker.showModal();
}
document.querySelector('#choose-team')!.addEventListener('click',()=>openPicker('team'),options);
document.querySelector('#choose-season')!.addEventListener('click',()=>openPicker('season'),options);
document.querySelector('#close-picker')!.addEventListener('click',()=>picker.close(),options);
picker.addEventListener('click',e=>{if(e.target===picker) {const r=picker.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) picker.close();}},options);
const home=()=>navigation?.overview();
function rotate(amount:number) { navigation?.interrupt(); const offset=camera.position.clone().sub(controls.target); offset.applyAxisAngle(new THREE.Vector3(0,1,0),amount); camera.position.copy(controls.target).add(offset); controls.update(); }
document.querySelector('#reset')!.addEventListener('click',home,options);
document.querySelector('#rotate-left')!.addEventListener('click',()=>rotate(-.2),options);
document.querySelector('#rotate-right')!.addEventListener('click',()=>rotate(.2),options);
container.addEventListener('keydown',e=>{if(e.shiftKey&&e.key.startsWith('Arrow')) navigation?.interrupt(); if(!e.shiftKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')) {e.preventDefault();rotate(e.key==='ArrowLeft'?-.15:.15);} if(e.key.toLowerCase()==='r')home();},options);
const about=document.querySelector<HTMLButtonElement>('#about')!;
const help=document.querySelector<HTMLDialogElement>('#help')!;
const introductionKey='touchdown-introduction-seen-v1';
let introductionSeen=false;
try{introductionSeen=localStorage.getItem(introductionKey)==='true';}catch{}
let helpReturn:HTMLElement=about;
function openHelp(automatic=false){
 finishReveal();helpReturn=automatic?container:about;
 help.querySelector('details')!.open=false;
 help.returnValue='';help.showModal();about.setAttribute('aria-expanded','true');track('help_open');
}
function showFirstVisit(){if(introductionSeen)return false;openHelp(true);return true;}
about.addEventListener('click',()=>openHelp(),options);
document.querySelector('#close-help')!.addEventListener('click',()=>help.close(),options);
document.querySelector('#explore-season')!.addEventListener('click',()=>help.close('explore'),options);
help.addEventListener('click',e=>{if(e.target!==help)return;const r=help.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)help.close();},options);
help.addEventListener('keydown',e=>{
 if(e.key!=='Tab')return;
 const controls=Array.from(help.querySelectorAll<HTMLElement>('button,summary'));
 const first=controls[0],last=controls[controls.length-1];
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
},options);
help.addEventListener('close',()=>{
 introductionSeen=true;try{localStorage.setItem(introductionKey,'true');}catch{}
 about.setAttribute('aria-expanded','false');helpReturn.focus({preventScroll:true});
 if(help.returnValue==='explore' && paths.length && field){
  applyFilter();
  if(!reduced.matches){
   const visible=filterTouchdowns(plays,filter),ids=new Set(visible.map(p=>p.id));
   reveal=new LandingReveal(paths.filter(p=>ids.has(p.group.name)),visible,field);
  }
 }
},options);
for(const event of ['pointerdown','pointermove','wheel','keydown'] as const)document.addEventListener(event,finishReveal,{capture:true,passive:true,signal:events.signal});
reduced.addEventListener('change',()=>{if(reduced.matches)finishReveal();},options);
window.addEventListener('popstate',readRoute,options);
const resize=()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.fov=camera.aspect<.8?51:Math.max(24,Math.min(36,45-camera.aspect*8));camera.updateProjectionMatrix();};
const observer=new ResizeObserver(resize);observer.observe(container);resize();
let previousFrame=performance.now();
renderer.setAnimationLoop(()=>{const now=performance.now(),dt=Math.min((now-previousFrame)/1000,.1);previousFrame=now;navigation?.update(dt);exploration?.update(dt);player?.update(dt);
  paths.forEach((p,i)=>{const target=filter==='all'||plays[i].type===filter?1:0;let weight=weights.get(p.group.name)??target;weight=reduced.matches?target:weight+(target-weight)*(1-Math.exp(-dt/.065));if(Math.abs(target-weight)<.001)weight=target;weights.set(p.group.name,weight);p.group.visible=weight>0;
   if(weight<1)p.group.traverse(o=>{if(o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial)o.material.opacity=target?o.material.opacity*weight:o.material.userData.restOpacity*weight;});
  });reveal?.update(dt);if(reveal?.complete)reveal=undefined;renderer.render(scene,camera);
  const geometries=String(renderer.info.memory.geometries), textures=String(renderer.info.memory.textures);
  if(container.dataset.geometries!==geometries) container.dataset.geometries=geometries; if(container.dataset.textures!==textures) container.dataset.textures=textures;
});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);container.innerHTML='<p class="fallback">The graphics connection was interrupted. Refresh to return to the sculpture.</p>';},options);
window.addEventListener('pagehide',()=>{pending?.abort();events.abort();renderer.setAnimationLoop(null);observer.disconnect();disposeSeason();controls.dispose();disposeObject(shadow);renderer.dispose();},{once:true});
window.addEventListener('pageshow',e=>{if(e.persisted) location.reload();});
readRoute();
}
initialize().catch(error=>{app.replaceChildren();const p=document.createElement('p');p.className='fallback';p.textContent=error instanceof Error?error.message:'The archive could not be loaded. Please refresh to try again.';const retry=document.createElement('a');retry.href='/';retry.textContent=' Return to Every Touchdown';p.append(retry);app.append(p);});
