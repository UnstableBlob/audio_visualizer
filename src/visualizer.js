import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
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

        // Initialize Simplex noise for organic terrain
        this.noise2D = createNoise2D();

        this.zCurrent = new Float32Array(CONFIG.N_RINGS * CONFIG.N_ANGLES).fill(0);
        this.radialProfile = new Float32Array(CONFIG.N_RINGS);
        this.staticOffsets = new Float32Array(CONFIG.N_RINGS * CONFIG.N_ANGLES);

        this.geometry = new THREE.BufferGeometry();
        this.initGeometry();

        // Load textures - diffuse only for now
        const loader = new THREE.TextureLoader();
        
        const rockDiffuse = loader.load('assets/textures/rock.png');
        const mossDiffuse = loader.load('assets/textures/moss.png');
        const sandDiffuse = loader.load('assets/textures/sand.png');

        // Set wrapping and color space
        const textureList = [rockDiffuse, mossDiffuse, sandDiffuse];
        
        textureList.forEach(tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.colorSpace = THREE.SRGBColorSpace;
        });

        // Initialize uniforms for triplanar blending
        this.uniforms = {
            tRockDiffuse: { value: rockDiffuse },
            tMossDiffuse: { value: mossDiffuse },
            tSandDiffuse: { value: sandDiffuse },
            uScale: { value: 0.008 },
            uSlopeSharpness: { value: 12.0 },
            uHeightScale: { value: CONFIG.Z_SCALE }
        };

        // Custom Material using onBeforeCompile to inject Triplanar Blending
        this.material = new THREE.MeshStandardMaterial({
            roughness: 0.7,
            metalness: 0.0,
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
                uniform sampler2D tRockDiffuse;
                uniform sampler2D tMossDiffuse;
                uniform sampler2D tSandDiffuse;
                uniform float uScale;
                uniform float uSlopeSharpness;
                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;

                // Triplanar blending helper for any texture
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
                
                // Sample all three texture sets using triplanar mapping
                vec3 rockDiffuse = getTriplanarBlend(tRockDiffuse, vWorldPosition, worldN);
                vec3 mossDiffuse = getTriplanarBlend(tMossDiffuse, vWorldPosition, worldN);
                vec3 sandDiffuse = getTriplanarBlend(tSandDiffuse, vWorldPosition, worldN);

                float slope = 1.0 - worldN.y;
                float height = vWorldPosition.y;

                // Biome masks
                float lowSand = 1.0 - smoothstep(18.0, 95.0, height);
                float rockSlope = smoothstep(0.20, 0.72, slope);
                float highRock = smoothstep(140.0, 240.0, height);
                float rockMask = clamp(rockSlope * 0.72 + highRock * 0.28, 0.0, 1.0);

                // Blend rock and moss first
                vec3 midColor = mix(mossDiffuse, rockDiffuse, rockMask);
                
                // Blend mid with sand (basin)
                vec3 baseColor = mix(midColor, sandDiffuse, lowSand);

                // Snow using rock as base (wind-scoured peaks)
                float snowLineNoise = sin(vWorldPosition.x * 0.012) * 10.0 + sin(vWorldPosition.z * 0.015) * 10.0;
                float snowStart = 305.0 + snowLineNoise;
                float snowHeight = smoothstep(snowStart, snowStart + 70.0, height);
                float snowFacing = 1.0 - smoothstep(0.14, 0.55, slope);
                float snowPatchNoise = sin(vWorldPosition.x * 0.035 + vWorldPosition.z * 0.02) * 0.5 + 0.5;
                float snowPatch = smoothstep(0.35, 0.82, snowPatchNoise);
                float snowMask = pow(clamp(snowHeight * snowFacing * snowPatch, 0.0, 1.0), 1.25) * 0.85;

                // Snow is slightly smoother and less metallic
                vec3 snowColor = vec3(0.82, 0.85, 0.88);
                snowColor = mix(rockDiffuse * 0.92, snowColor, 0.62);
                
                vec3 finalColor = mix(baseColor, snowColor, snowMask);

                diffuseColor.rgb = finalColor;
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
            const t = r / (N_RINGS - 1);
            // Peak farther from center so animated ring sits outside the water disk
            const landMask = Math.exp(-Math.pow((t - 0.66) / 0.17, 2));
            this.radialProfile[r] = landMask;
        }

        // Generate Polar Grid with Simplex noise for organic terrain
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

                // Multi-octave Simplex noise for natural terrain variation
                // Octave 1: Large scale features
                let noise1 = this.noise2D(x * 0.001, z * 0.001) * 0.5 + 0.5;
                
                // Octave 2: Medium scale features
                let noise2 = this.noise2D(x * 0.003, z * 0.003) * 0.5 + 0.5;
                
                // Octave 3: High frequency detail
                let noise3 = this.noise2D(x * 0.008, z * 0.008) * 0.5 + 0.5;
                
                // Octave 4: Ultra-fine spikes
                let noise4 = this.noise2D(x * 0.02, z * 0.02) * 0.5 + 0.5;

                // Combine octaves for natural-looking terrain (Perlin-like)
                let noise = (noise1 * 0.5 + noise2 * 0.25 + noise3 * 0.15 + noise4 * 0.1) / 1.0;
                
                // Sharpen peaks for mountainous terrain
                const spikeNoise = Math.pow(noise, 2.5) * 1.8;
                
                // Add subtle angle-based jitter to break regularity
                const jitter = (Math.sin(a * 7.3 + r * 3.1) * 0.2 + 0.8);
                
                // Ridge function for more dramatic peaks
                const ridgeNoise = Math.abs(noise * 2.0 - 1.0);
                const ridgeFactor = Math.pow(1.0 - ridgeNoise, 2.2);

                // Combine spike and ridge for more natural variation
                const finalHeight = spikeNoise * 0.6 + ridgeFactor * 0.4;
                
                this.staticOffsets[idx] = finalHeight * jitter;

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

