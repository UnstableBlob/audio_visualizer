import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Visualizer {
    constructor(scene) {
        this.scene = scene;
        this.colorMode = 'custom';
        this.noiseTime = 0;
        
        this.zCurrent = new Float32Array(CONFIG.N_RINGS * CONFIG.N_ANGLES).fill(0);
        this.radialProfile = new Float32Array(CONFIG.N_RINGS);
        
        this.geometry = new THREE.BufferGeometry();
        this.initGeometry();
        
        this.material = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });
        
        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
    }

    initGeometry() {
        const { N_RINGS, N_ANGLES, RADIUS_START, RADIUS_END } = CONFIG;
        const positions = new Float32Array(N_RINGS * N_ANGLES * 3);
        const colors = new Float32Array(N_RINGS * N_ANGLES * 3);
        const sizes = new Float32Array(N_RINGS * N_ANGLES);

        // Pre-calculate radial profile
        for (let r = 0; r < N_RINGS; r++) {
            const t = r / (N_RINGS - 1);
            const ripples = Math.pow(Math.sin(t * Math.PI * 3), 2);
            const macroDome = Math.sin(t * Math.PI);
            this.radialProfile[r] = (ripples * 0.85 + 0.15) * macroDome;
        }

        // Generate Polar Grid
        let idx = 0;
        for (let r = 0; r < N_RINGS; r++) {
            const radius = RADIUS_START + (r / (N_RINGS - 1)) * (RADIUS_END - RADIUS_START);
            const radiusRatio = radius / RADIUS_END;

            for (let a = 0; a < N_ANGLES; a++) {
                const theta = (a / N_ANGLES) * Math.PI * 2;
                positions[idx * 3] = radius * Math.cos(theta);
                positions[idx * 3 + 1] = radius * Math.sin(theta);
                positions[idx * 3 + 2] = 0;

                colors[idx * 3] = 0.01;
                colors[idx * 3 + 1] = 0.05;
                colors[idx * 3 + 2] = 0.2;
                
                sizes[idx] = 2.0 + Math.sin(radiusRatio * Math.PI) * 2.0;
                idx++;
            }
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    }

    toggleColorMode() {
        this.colorMode = this.colorMode === 'custom' ? 'chroma' : 'custom';
        return this.colorMode;
    }

    update(audioBands) {
        const { 
            N_RINGS, N_ANGLES, RADIUS_START, RADIUS_END, 
            Z_SCALE, ATTACK_RATE, DECAY_RATE, NOISE_STRENGTH, 
            CHROMA_SPEED, CUSTOM_COLOR 
        } = CONFIG;
        
        // Mirror waves onto N_ANGLES
        const halfAngles = N_ANGLES / 2;
        const waves = new Float32Array(N_ANGLES);
        for (let a = 0; a < halfAngles; a++) {
            const t = a / (halfAngles - 1);
            const bandIdx = Math.floor(t * (audioBands.length - 1));
            const val = audioBands[bandIdx];
            waves[a] = val;
            waves[N_ANGLES - 1 - a] = val;
        }

        this.noiseTime += 0.03;
        const posAttr = this.geometry.attributes.position.array;
        const colorAttr = this.geometry.attributes.color.array;

        for (let r = 0; r < N_RINGS; r++) {
            const rProf = this.radialProfile[r];
            const radius = RADIUS_START + (r / (N_RINGS - 1)) * (RADIUS_END - RADIUS_START);

            for (let a = 0; a < N_ANGLES; a++) {
                const i = r * N_ANGLES + a;
                const theta = (a / N_ANGLES) * Math.PI * 2;
                
                // Audio Height
                const targetZ = waves[a] * rProf * Z_SCALE;
                if (targetZ > this.zCurrent[i]) {
                    this.zCurrent[i] = this.zCurrent[i] * (1 - ATTACK_RATE) + targetZ * ATTACK_RATE;
                } else {
                    this.zCurrent[i] *= DECAY_RATE;
                }

                // Noise Layers
                const noise1 = Math.sin(theta * 4 + this.noiseTime) * Math.cos(radius / 100 - this.noiseTime * 1.5);
                const noise2 = Math.sin(theta * 8 - this.noiseTime * 0.7) * Math.cos(radius / 50 + this.noiseTime * 2.1) * 0.4;
                const totalNoise = (noise1 + noise2) * NOISE_STRENGTH;

                const finalZ = this.zCurrent[i] + totalNoise;
                posAttr[i * 3 + 2] = finalZ;

                // Color Mapping
                const rawIntensity = Math.min(3.0, Math.max(0.0, finalZ / (Z_SCALE * 0.7)));
                const intensity = 1.0 - Math.exp(-rawIntensity * 1.5);

                if (this.colorMode === 'custom') {
                    colorAttr[i * 3] = 0.01 + intensity * CUSTOM_COLOR.r;
                    colorAttr[i * 3 + 1] = 0.05 + intensity * CUSTOM_COLOR.g;
                    colorAttr[i * 3 + 2] = 0.2 + intensity * CUSTOM_COLOR.b;
                    
                    const whiteHot = Math.pow(intensity, 3) * 0.5;
                    colorAttr[i * 3] += whiteHot;
                    colorAttr[i * 3 + 1] += whiteHot;
                    colorAttr[i * 3 + 2] += whiteHot;
                } else {
                    const phase = theta + this.noiseTime * CHROMA_SPEED;
                    colorAttr[i * 3] = (Math.sin(phase) * 0.5 + 0.5) * (0.15 + intensity * 1.2);
                    colorAttr[i * 3 + 1] = (Math.sin(phase + 2.094) * 0.5 + 0.5) * (0.15 + intensity * 1.2);
                    colorAttr[i * 3 + 2] = (Math.sin(phase + 4.188) * 0.5 + 0.5) * (0.15 + intensity * 1.2);
                }
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }
}
