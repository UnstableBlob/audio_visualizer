import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 10, 8000);
    camera.position.set(0, 800, 1600);

    const renderer = new THREE.WebGLRenderer({ antialias: false, logarithmicDepthBuffer: true }); // post processing works better without standard MSAA sometimes, or use custom pass
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    document.getElementById('app').appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Environmental Lights
    const ambientLight = new THREE.AmbientLight(0x101015, 1.0);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0xff00ff, 50000, 3000);
    pointLight1.position.set(300, 300, 300);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x00ffff, 50000, 3000);
    pointLight2.position.set(-300, 300, -300);
    scene.add(pointLight2);

    // Reflective Pitch-Black Floor
    const floorGeo = new THREE.PlaneGeometry(10000, 10000);
    const floorMat = new THREE.MeshPhysicalMaterial({
        color: 0x020202,
        metalness: 0.95,
        roughness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -200;
    scene.add(floor);

    // Post Processing Pipeline
    const composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,   // strength
        1.0,   // radius
        0.1    // threshold
    );
    composer.addPass(bloomPass);

    const bokehPass = new BokehPass(scene, camera, {
        focus: 25.0,
        aperture: 0.0001,
        maxblur: 0.015,
        width: window.innerWidth,
        height: window.innerHeight
    });
    composer.addPass(bokehPass);

    const filmPass = new FilmPass(0.35, false);
    composer.addPass(filmPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, controls, composer };
}

