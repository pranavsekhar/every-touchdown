import * as THREE from 'three';
export type Theme = 'light' | 'dark';
// Curated exhibition inks: pass / rush on paper, then pass / rush in the dark gallery.
const inks: Record<string, string[]> = {
 ARI:['#a34753','#987c52','#d98892','#c5af83'], ATL:['#a74648','#64737f','#db8586','#a6b5bf'],
 BAL:['#70579a','#9a803f','#af97d8','#d2ba7c'], BUF:['#356ca4','#aa565d','#80acda','#d9979c'],
 CAR:['#267f9c','#686f81','#76bed1','#a8adc2'], CHI:['#475e80','#b16b3f','#91a5c9','#dbaa7e'],
 CIN:['#b26635','#66747c','#dea578','#a6b4bc'], CLE:['#996543','#b17f43','#cda589','#d8ba85'],
 DAL:['#466785','#838d97','#93b1ce','#b7c3cd'], DEN:['#ac693d','#4c6b92','#dda67d','#95afd4'],
 DET:['#267ca6','#8a7b64','#79b9d8','#c4b8a1'], GB:['#3e7b66','#aa873e','#8cbfa9','#d5bd80'],
 HOU:['#41667b','#aa555c','#92b2c5','#d9989e'], IND:['#426eaa','#818892','#94b5e2','#bec4ce'],
 JAX:['#367e83','#a5894d','#88c1c3','#d2bf8a'], KC:['#b14f52','#ad8a46','#e09193','#d9c084'],
 LA:['#426fab','#af913f','#91b4e0','#d8c27d'], LAC:['#2988b3','#ae8a42','#79c3e6','#d8be7e'],
 LV:['#525e66','#918575','#adbcc5','#c6bcac'], MIA:['#27858a','#b97544','#80c4c6','#dcac86'],
 MIN:['#79559c','#aa8742','#b49ad8','#d8bd7f'], NE:['#4a6986','#ac5d63','#99b1cd','#d7a0a5'],
 NO:['#95804f','#626d78','#cabb8c','#acbac5'], NYG:['#3f6aa0','#ab5c61','#92b1db','#d9a0a4'],
 NYJ:['#397d65','#8c8a72','#87c0a8','#c3c3aa'], PHI:['#397b7b','#828b97','#88bebe','#b9c3d1'],
 PIT:['#a48638','#626d7b','#d5bf78','#acb8ca'], SEA:['#466d88','#83954c','#92b5cc','#bdcb8b'],
 SF:['#aa5651','#a38b5b','#dc9b93','#cfbf95'], TB:['#ad554d','#857a69','#df9a90','#c5b8a4'],
 TEN:['#5484a3','#a75c64','#9bc4df','#d89da7'], WAS:['#8e505e','#ab8845','#c994a2','#d8be81'],
};
export function paletteFor(team: string, theme: Theme) {
 const c=inks[team] ?? inks.DET, offset=theme==='dark'?2:0;
 return {pass:c[offset],rush:c[offset+1],theme};
}
export type Palette = ReturnType<typeof paletteFor>;
export function paintTouchdown(group: THREE.Group, palette: Palette, type: 'pass'|'rush') {
 group.traverse(o=>{
  if(!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshBasicMaterial)) return;
  const base=new THREE.Color(type==='pass'?palette.pass:palette.rush);
  if(o.name==='yac') base.lerp(new THREE.Color(palette.theme==='dark'?'#bacfc5':'#536c65'),.25);
  const highlight=base.clone().lerp(new THREE.Color(palette.theme==='dark'?'#ffffff':'#142126'),palette.theme==='dark'?.34:.35);
  o.material.userData.restColor=base; o.material.userData.highlight=highlight;
  o.material.userData.restOpacity ??= o.material.opacity;
  o.material.color.copy(base);
 });
}
