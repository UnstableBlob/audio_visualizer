import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createBowl(scene) {
  // Load concrete texture
  const loader = new THREE.TextureLoader();
  const concreteTex = loader.load('assets/textures/concrete.png');
  concreteTex.wrapS = THREE.RepeatWrapping;
  concreteTex.wrapT = THREE.RepeatWrapping;
  concreteTex.repeat.set(4, 4);

  // Outer rim — a flat torus-like ring
  // RADIUS_END from config is 950. Let's make rim slightly larger or fit.
  const rimGeo = new THREE.TorusGeometry(
    CONFIG.RADIUS_END + 30, // pushed out a tiny bit so terrain fits inside
    60,    // thickness of the rim
    16,    // radial segments
    64     // tubular segments
  );

  const stoneMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xcccccc,
    roughness: 0.8,
    metalness: 0.2,
  });

  const rim = new THREE.Mesh(rimGeo, stoneMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -20; // drop it slightly below the terrain max height zero
  rim.receiveShadow = true;
  rim.castShadow = true;
  scene.add(rim);

  // Pedestal base
  const baseGeo = new THREE.CylinderGeometry(CONFIG.RADIUS_END + 30, 200, 150, 48);
  const base = new THREE.Mesh(baseGeo, stoneMat);
  base.position.y = -95;
  base.receiveShadow = true;
  base.castShadow = true;
  scene.add(base);

  return { rim, base };
}
