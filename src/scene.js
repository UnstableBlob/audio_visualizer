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

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) {
        console.error('WebGL Context creation failed:', e);
        const appElem = document.getElementById('app');
        if (appElem) {
            appElem.innerHTML = `
                <div style="padding: 40px; text-align: center; color: white; background: #111; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif;">
                    <h2 style="color: #ff4d4d;">WebGL Not Available</h2>
                    <p style="max-width: 500px; line-height: 1.6; opacity: 0.8;">Your browser or graphics hardware doesn't seem to support WebGL, or it is currently disabled.</p>
                    <div style="margin-top: 20px; text-align: left; background: #222; padding: 20px; border-radius: 8px; font-size: 0.9rem;">
                        <strong style="display: block; margin-bottom: 10px; color: #4f46e5;">How to fix:</strong>
                        <ul style="padding-left: 20px;">
                            <li>Ensure "Hardware Acceleration" is enabled in browser settings.</li>
                            <li>Update your graphics card drivers.</li>
                            <li>Try a different browser like Chrome or Firefox.</li>
                        </ul>
                    </div>
                    <button onclick="window.location.reload()" style="margin-top: 30px; padding: 10px 30px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Retry</button>
                </div>
            `;
        }
        throw new Error("Failed to create WebGL context.");
    }
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
