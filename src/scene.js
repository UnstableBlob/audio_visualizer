import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Sunlight for dramatic shadows
    const sun = new THREE.DirectionalLight(0xfff5e0, 3.0);
    sun.position.set(400, 800, 300);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.far = 2000;
    sun.shadow.camera.left = -1200;
    sun.shadow.camera.right = 1200;
    sun.shadow.camera.top = 1200;
    sun.shadow.camera.bottom = -1200;
    scene.add(sun);

    // Fill light for better ambient lighting
    const fill = new THREE.DirectionalLight(0x6b7c9c, 1.2);
    fill.position.set(-300, 400, -400);
    scene.add(fill);

    // Ambient light for overall ambient illumination
    const ambient = new THREE.AmbientLight(0x8090b0, 0.65);
    scene.add(ambient);

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 10, 5000);
    camera.position.set(0, 800, 1400);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, controls };
}
