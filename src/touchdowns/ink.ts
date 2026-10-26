import * as THREE from 'three';
export function selectedInk(_name: string, base: THREE.Color) { return base.clone().multiplyScalar(.62); }
export function appearance(material: THREE.MeshBasicMaterial) {
 return {opacity: material.userData.restOpacity ?? material.opacity, color: (material.userData.restColor ?? material.color).clone(), highlight: (material.userData.highlight ?? selectedInk('',material.color)).clone()};
}
