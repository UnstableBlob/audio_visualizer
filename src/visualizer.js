import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Visualizer {
    constructor(scene) {
        this.scene = scene;
        this.noiseTime = 0;
        this.dynamicGain = 1.0;
        this.lastDebug = {
            avgBand: 0,
            peakBand: 0,
            gain: 1,
            maxHeight: 0
        };

        this.zCurrent = new Float32Array(CONFIG.N_RINGS * CONFIG.N_ANGLES).fill(0);
        this.radialProfile = new Float32Array(CONFIG.N_RINGS);
        this.staticOffsets = new Float32Array(CONFIG.N_RINGS * CONFIG.N_ANGLES);

        this.geometry = new THREE.BufferGeometry();
        this.initGeometry();

        // Load the sharp, craggy mountain textures
        const loader = new THREE.TextureLoader();
        const rockTex = loader.load('assets/textures/rock.png');
        const mossTex = loader.load('assets/textures/moss.png');
        const sandTex = loader.load('assets/textures/sand.png');

        // Set wrapping for triplanar tiling
        [rockTex, mossTex, sandTex].forEach(tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.colorSpace = THREE.SRGBColorSpace;
        });

        // Initialize uniforms for our custom shader
        this.uniforms = {
            tRock: { value: rockTex },
            tMoss: { value: mossTex },
            tSand: { value: sandTex },
            tNoise: { value: null },
            uScale: { value: 0.008 }, // Slightly more tiling for detail
            uSlopeSharpness: { value: 12.0 }, // Sharper rock-to-moss transitions
            uHeightScale: { value: CONFIG.Z_SCALE }
        };

        // Custom Material using onBeforeCompile to inject Triplanar Blending
        this.material = new THREE.MeshStandardMaterial({
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true,
            side: THREE.DoubleSide
        });

        this.material.onBeforeCompile = (shader) => {
            shader.uniforms = { ...shader.uniforms, ...this.uniforms };

            shader.vertexShader = `
                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;
                ${shader.vertexShader}
            `.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                 vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
                 vWorldNormal = normalize(normalMatrix * normal);`
            );

            shader.fragmentShader = `
                uniform sampler2D tRock;
                uniform sampler2D tMoss;
                uniform sampler2D tSand;
                uniform float uScale;
                uniform float uSlopeSharpness;
                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;

                vec3 getTriplanarBlend(sampler2D tex, vec3 p, vec3 n) {
                    vec3 blending = abs(n);
                    blending /= (blending.x + blending.y + blending.z);
                    vec3 x = texture2D(tex, p.yz * uScale).rgb;
                    vec3 y = texture2D(tex, p.xz * uScale).rgb;
                    vec3 z = texture2D(tex, p.xy * uScale).rgb;
                    return x * blending.x + y * blending.y + z * blending.z;
                }

                ${shader.fragmentShader}
            `.replace(
                '#include <map_fragment>',
                `
                vec3 worldN = normalize(vWorldNormal);
                vec3 rockSample = getTriplanarBlend(tRock, vWorldPosition, worldN);
                vec3 mossSample = getTriplanarBlend(tMoss, vWorldPosition, worldN);
                vec3 sandSample = getTriplanarBlend(tSand, vWorldPosition, worldN);

                float slope = 1.0 - worldN.y; // 0 = flat, 1 = vertical
                float height = vWorldPosition.y;
                
                // Mix biomes
                // Steep cliffs = Rock
                // Flat low area = Sand
                // Flat/Mid area = Moss/Grass
                float rockFactor = clamp(slope * uSlopeSharpness - 0.2, 0.0, 1.0);
                float heightFactor = clamp((height - 5.0) / 40.0, 0.0, 1.0); 
                
                vec3 baseColor = mix(sandSample, mossSample, heightFactor);
                // Blend in rock on slopes or very high peaks
                float peakFactor = clamp((height - 180.0) / 150.0, 0.0, 1.0);
                baseColor = mix(baseColor, rockSample, max(rockFactor, peakFactor));
                
                // Darken rock peaks for ambient depth
                baseColor *= (1.0 - peakFactor * 0.4);

                diffuseColor.rgb = baseColor;
                `
            );
        };

        this.terrain = new THREE.Mesh(this.geometry, this.material);
        this.terrain.receiveShadow = true;
        this.terrain.castShadow = true;
        this.scene.add(this.terrain);
    }

    getDebugInfo() {
        return this.lastDebug;
    }

    initGeometry() {
        const { N_RINGS, N_ANGLES, RADIUS_START, RADIUS_END } = CONFIG;
        const positions = new Float32Array(N_RINGS * N_ANGLES * 3);

        // Pre-calculate radial profile (Donut/Ring shape)
        for (let r = 0; r < N_RINGS; r++) {
            const t = r / (N_RINGS - 1); // 0 = inner, 1 = outer
            // Peak farther from center so animated ring sits outside the water disk.
            const landMask = Math.exp(-Math.pow((t - 0.66) / 0.17, 2));
            this.radialProfile[r] = landMask;
        }

        // Generate Polar Grid
        let idx = 0;
        for (let r = 0; r < N_RINGS; r++) {
            const radius = RADIUS_START + (r / (N_RINGS - 1)) * (RADIUS_END - RADIUS_START);

            for (let a = 0; a < N_ANGLES; a++) {
                const theta = (a / N_ANGLES) * Math.PI * 2;
                const x = radius * Math.cos(theta);
                const z = radius * Math.sin(theta);

                positions[idx * 3] = x;
                positions[idx * 3 + 1] = 0; // Y is height
                positions[idx * 3 + 2] = z;

                // Bake high-frequency rocky spire noise for the heights
                let noise = Math.sin(x * 0.01 + z * 0.015) * 0.5 + 0.5;
                noise += (Math.sin(x * 0.03 - z * 0.04) * 0.5 + 0.5) * 0.5;
                noise += (Math.sin(-x * 0.08 + z * 0.07) * 0.5 + 0.5) * 0.25;
                noise = noise / 1.75;

                // Sharpen peaks for natural mountains
                const spikeNoise = Math.pow(noise, 3) * 1.5;
                const jitter = (Math.sin(a * 7.3 + r * 3.1) * 0.2 + 0.8);
                this.staticOffsets[idx] = spikeNoise * jitter;

                idx++;
            }
        }

        // Generate indices for triangulation
        const indices = [];
        for (let r = 0; r < N_RINGS - 1; r++) {
            for (let a = 0; a < N_ANGLES; a++) {
                const next_a = (a + 1) % N_ANGLES;
                const p1 = r * N_ANGLES + a;
                const p2 = r * N_ANGLES + next_a;
                const p3 = (r + 1) * N_ANGLES + a;
                const p4 = (r + 1) * N_ANGLES + next_a;

                // Two triangles per quad
                indices.push(p1, p3, p2);
                indices.push(p2, p3, p4);
            }
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
    }

    update(audioBands) {
        const { N_RINGS, N_ANGLES, Z_SCALE, ATTACK_RATE, DECAY_RATE, NOISE_STRENGTH } = CONFIG;

        // Track frame energy and auto-lift low masters so displacement remains visible.
        let sumBand = 0;
        let peakBand = 0;
        for (let i = 0; i < audioBands.length; i++) {
            const v = audioBands[i];
            sumBand += v;
            if (v > peakBand) peakBand = v;
        }
        const avgBand = audioBands.length > 0 ? sumBand / audioBands.length : 0;
        const targetGain = THREE.MathUtils.clamp(0.32 / Math.max(peakBand, 0.02), 1.0, 8.0);
        this.dynamicGain = THREE.MathUtils.lerp(this.dynamicGain, targetGain, 0.12);

        // Mirror waves onto N_ANGLES
        const halfAngles = N_ANGLES / 2;
        const waves = new Float32Array(N_ANGLES);
        for (let a = 0; a < halfAngles; a++) {
            const t = a / (halfAngles - 1);
            const bandIdx = Math.floor(t * (audioBands.length - 1));
            const val = audioBands[bandIdx] * this.dynamicGain;
            waves[a] = val;
            waves[N_ANGLES - 1 - a] = val;
        }

        this.noiseTime += 0.03;
        const posAttr = this.geometry.attributes.position.array;
        let maxHeight = 0;

        for (let r = 0; r < N_RINGS; r++) {
            const rProf = this.radialProfile[r];

            for (let a = 0; a < N_ANGLES; a++) {
                const i = r * N_ANGLES + a;
                const theta = (a / N_ANGLES) * Math.PI * 2;

                // Target Height combines Audio + Baked Jitter
                const targetZ = waves[a] * rProf * Z_SCALE * (this.staticOffsets[i] * 0.8 + 0.2);

                if (targetZ > this.zCurrent[i]) {
                    this.zCurrent[i] = this.zCurrent[i] * (1 - ATTACK_RATE) + targetZ * ATTACK_RATE;
                } else {
                    this.zCurrent[i] *= DECAY_RATE;
                }

                // Add slight continuous noise for water/beach ripple
                const noise1 = Math.sin(theta * 4 + this.noiseTime) * 0.5;
                const totalNoise = noise1 * NOISE_STRENGTH * rProf * 0.2;

                const finalZ = this.zCurrent[i] + totalNoise;
                posAttr[i * 3 + 1] = finalZ;
                if (finalZ > maxHeight) {
                    maxHeight = finalZ;
                }
            }
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();

        this.lastDebug.avgBand = avgBand;
        this.lastDebug.peakBand = peakBand;
        this.lastDebug.gain = this.dynamicGain;
        this.lastDebug.maxHeight = maxHeight;
    }
}

