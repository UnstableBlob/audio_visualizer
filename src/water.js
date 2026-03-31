import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';

export function createWater(scene) {
  const waterGeo = new THREE.CircleGeometry(480, 64); // sized to fit inner basin
  const water = new Water(waterGeo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
      (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
    ),
    sunDirection: new THREE.Vector3(400, 800, 300).normalize(),
    sunColor: 0xffffff,
    waterColor: 0x4a90d9,
    distortionScale: 3.5,
  });
  
  water.rotation.x = -Math.PI / 2;
  water.position.y = 10; // slightly above base level
  scene.add(water);
  
  return water;
}
