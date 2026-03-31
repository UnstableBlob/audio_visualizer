import * as THREE from 'three';

/**
 * Visual Enhancement Utilities
 * Improves terrain rendering quality and lighting
 */

export function createEnvironmentMap(scene) {
    // Create a simple procedural environment for realistic reflections and lighting
    const pmremGenerator = new THREE.PMREMGenerator(createProceduralCanvas());
    pmremGenerator.compileEquirectangularShader();
    
    const envMap = pmremGenerator.fromEquirectangular(
        new THREE.CanvasTexture(createProceduralCanvas())
    ).texture;
    
    scene.environment = envMap;
    scene.background = new THREE.Color(0x000000);
    
    return envMap;
}

export function createProceduralCanvas(width = 1024, height = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Sky gradient: dark at bottom, lighter at top
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a2e');      // Deep blue-black at top
    gradient.addColorStop(0.3, '#16213e');    // Dark blue
    gradient.addColorStop(0.6, '#0f3460');    // Medium blue
    gradient.addColorStop(1, '#0a1929');      // Very dark at horizon

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Add subtle stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 300; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height * 0.4; // Stars in top 40%
        const size = Math.random() * 1.5;
        ctx.fillRect(x, y, size, size);
    }

    return canvas;
}

/**
 * Enhances terrain material with better properties for realism
 */
export function enhanceTerrainMaterial(material) {
    // Improved default values for PBR
    material.metalness = 0.0;
    material.roughness = 0.7;
    material.normalScale.set(1.2, 1.2);
    
    return material;
}

/**
 * Add depth-of-field style effect for cinematic feel
 */
export function createDepthOfFieldEffect(camera, renderer) {
    return {
        focalDistance: 1200,
        focalLength: 25,
        focalDepth: 800,
        maxblur: 1.0,
        
        update(value = 0.5) {
            // This is a placeholder for potential DOF implementation
            // Can be integrated with post-processing libraries like Postprocessing.js
        }
    };
}

/**
 * Enhance shader rendering with better quality settings
 */
export function optimizeRendererSettings(renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // High quality shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    
    return renderer;
}

/**
 * Add subtle fog for atmosphere (optional, based on preference)
 */
export function addAtmosphericFog(scene, enabled = false) {
    if (enabled) {
        const fog = new THREE.Fog(0x000000, 500, 3500);
        scene.fog = fog;
    }
}

/**
 * Create enhanced lighting setup
 */
export function createEnhancedLighting(scene) {
    // Already handled in scene.js, but this is a reference implementation
    // for additional light enhancements
    
    // Find existing lights
    const lights = scene.children.filter(obj => obj.isLight);
    
    lights.forEach(light => {
        if (light.isDirectionalLight) {
            light.castShadow = true;
            light.shadow.mapSize.set(2048, 2048);
            light.shadow.bias = -0.0005;
            light.shadow.normalBias = 0.05;
        }
    });
    
    return lights;
}
