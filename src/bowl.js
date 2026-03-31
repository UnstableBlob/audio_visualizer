import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createBowl(scene) {
  // Load concrete texture
  const loader = new THREE.TextureLoader();
  const concreteTex = loader.load('assets/textures/concrete.png');
  concreteTex.wrapS = THREE.RepeatWrapping;
  concreteTex.wrapT = THREE.RepeatWrapping;
  concreteTex.repeat.set(4, 4);
  concreteTex.colorSpace = THREE.SRGBColorSpace;

  // Enhanced stone material
  const stoneMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xcccccc,
    roughness: 0.75,
    metalness: 0.0
  });

  // Outer rim — a flat torus-like ring
  const rimGeo = new THREE.TorusGeometry(
    CONFIG.RADIUS_END + 30,
    60,
    32,
    128
  );

  const rim = new THREE.Mesh(rimGeo, stoneMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -20;
  rim.receiveShadow = true;
  rim.castShadow = true;
  scene.add(rim);

  // Pedestal base
  const baseGeo = new THREE.CylinderGeometry(CONFIG.RADIUS_END + 30, 200, 150, 64);
  const base = new THREE.Mesh(baseGeo, stoneMat);
  base.position.y = -95;
  base.receiveShadow = true;
  base.castShadow = true;
  scene.add(base);

  return { rim, base };
}
