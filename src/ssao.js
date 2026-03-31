import * as THREE from 'three';

/**
 * Screen Space Ambient Occlusion (SSAO) Effect
 * Adds subtle ambient occlusion shadows in crevices and hard-to-reach areas
 */

export class SSAOPass {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // Create render target for depth information
        this.depthRenderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth,
            window.innerHeight,
            {
                format: THREE.RGBAFormat,
                type: THREE.FloatType,
                depthBuffer: true
            }
        );

        // Create render target for SSAO computation
        this.ssaoRenderTarget = new THREE.WebGLRenderTarget(
            window.innerWidth / 2,
            window.innerHeight / 2,
            {
                format: THREE.RGBAFormat,
                type: THREE.FloatType
            }
        );

        // Create noise texture for SSAO sampling
        this.noiseTexture = this.generateNoiseTexture();

        // Create SSAO material
        this.initSSAOMaterial();

        // Create blur material for smoothing SSAO
        this.initBlurMaterial();

        // Ortho camera for full-screen pass
        this.orthoCamera = new THREE.OrthographicCamera(
            -1, 1, 1, -1, 0.1, 100
        );

        // Full-screen quad for drawing
        const geometry = new THREE.PlaneGeometry(2, 2);

        // SSAO Mesh
        this.ssaoMesh = new THREE.Mesh(geometry, this.ssaoMaterial);
        this.ssaoScene = new THREE.Scene();
        this.ssaoScene.add(this.ssaoMesh);

        // Blur Mesh
        this.blurMesh = new THREE.Mesh(geometry, this.blurMaterial);
        this.blurScene = new THREE.Scene();
        this.blurScene.add(this.blurMesh);

        // Listen for resize
        window.addEventListener('resize', () => this.onWindowResize());
    }

    generateNoiseTexture(size = 64) {
        const pixels = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size * 4; i += 4) {
            pixels[i] = Math.random() * 255;      // R
            pixels[i + 1] = Math.random() * 255;  // G
            pixels[i + 2] = Math.random() * 255;  // B
            pixels[i + 3] = 255;                  // A
        }

        const texture = new THREE.DataTexture(
            pixels,
            size,
            size,
            THREE.RGBAFormat,
            THREE.UnsignedByteType
        );
        texture.needsUpdate = true;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    initSSAOMaterial() {
        this.ssaoMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                tDepth: { value: null },
                tNoise: { value: this.noiseTexture },
                uNear: { value: this.camera.near },
                uFar: { value: this.camera.far },
                uRadius: { value: 25.0 },
                uBias: { value: 0.025 },
                uIntensity: { value: 0.35 },
                uSamples: { value: 8 },
                uScreenSize: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform sampler2D tDepth;
                uniform sampler2D tNoise;
                uniform float uNear;
                uniform float uFar;
                uniform float uRadius;
                uniform float uBias;
                uniform float uIntensity;
                uniform int uSamples;
                uniform vec2 uScreenSize;

                varying vec2 vUv;

                float linearizeDepth(float depth) {
                    float z = depth * 2.0 - 1.0;
                    return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
                }

                void main() {
                    float depth = linearizeDepth(texture2D(tDepth, vUv).r);
                    vec3 diffuse = texture2D(tDiffuse, vUv).rgb;
                    
                    float occlusion = 0.0;
                    float sampleDepth;
                    vec2 sampleCoord;

                    // Sample ambient occlusion around this pixel
                    for (int i = 0; i < 8; i++) {
                        float angle = float(i) * 6.28318530718 / float(uSamples);
                        float radius = uRadius / uScreenSize.x;
                        sampleCoord = vUv + vec2(cos(angle), sin(angle)) * radius;
                        sampleDepth = linearizeDepth(texture2D(tDepth, sampleCoord).r);
                        
                        float depthDiff = depth - sampleDepth;
                        if (depthDiff > 0.0 && depthDiff < uRadius * 0.01) {
                            occlusion += 1.0;
                        }
                    }

                    occlusion /= float(uSamples);
                    occlusion = pow(1.0 - occlusion, 2.0);
                    occlusion = mix(1.0, occlusion, uIntensity);

                    gl_FragColor = vec4(vec3(occlusion), 1.0);
                }
            `
        });
    }

    initBlurMaterial() {
        this.blurMaterial = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: null },
                uDirection: { value: new THREE.Vector2(1.0, 0.0) },
                uScreenSize: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform vec2 uDirection;
                uniform vec2 uScreenSize;
                varying vec2 vUv;

                void main() {
                    vec4 color = vec4(0.0);
                    vec2 pixelSize = 1.0 / uScreenSize;
                    float blurSize = 2.0;

                    color += texture2D(tDiffuse, vUv - 2.0 * blurSize * pixelSize * uDirection) * 0.05;
                    color += texture2D(tDiffuse, vUv - 1.0 * blurSize * pixelSize * uDirection) * 0.09;
                    color += texture2D(tDiffuse, vUv) * 0.12;
                    color += texture2D(tDiffuse, vUv + 1.0 * blurSize * pixelSize * uDirection) * 0.09;
                    color += texture2D(tDiffuse, vUv + 2.0 * blurSize * pixelSize * uDirection) * 0.05;

                    gl_FragColor = color;
                }
            `
        });
    }

    render(screenTexture) {
        // Update uniforms
        this.ssaoMaterial.uniforms.tDiffuse.value = screenTexture;
        this.ssaoMaterial.uniforms.uScreenSize.value.set(window.innerWidth, window.innerHeight);
        this.blurMaterial.uniforms.uScreenSize.value.set(window.innerWidth / 2, window.innerHeight / 2);

        // Render SSAO
        this.renderer.setRenderTarget(this.ssaoRenderTarget);
        this.renderer.render(this.ssaoScene, this.orthoCamera);

        // Horizontal blur
        this.blurMaterial.uniforms.tDiffuse.value = this.ssaoRenderTarget.texture;
        this.blurMaterial.uniforms.uDirection.value.set(1.0, 0.0);
        this.renderer.setRenderTarget(this.depthRenderTarget);
        this.renderer.render(this.blurScene, this.orthoCamera);

        // Vertical blur
        this.blurMaterial.uniforms.tDiffuse.value = this.depthRenderTarget.texture;
        this.blurMaterial.uniforms.uDirection.value.set(0.0, 1.0);
        this.renderer.setRenderTarget(this.ssaoRenderTarget);
        this.renderer.render(this.blurScene, this.orthoCamera);

        this.renderer.setRenderTarget(null);
        return this.ssaoRenderTarget.texture;
    }

    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.depthRenderTarget.setSize(width, height);
        this.ssaoRenderTarget.setSize(width / 2, height / 2);
        this.ssaoMaterial.uniforms.uScreenSize.value.set(width, height);
        this.blurMaterial.uniforms.uScreenSize.value.set(width / 2, height / 2);
    }

    dispose() {
        this.depthRenderTarget.dispose();
        this.ssaoRenderTarget.dispose();
        this.noiseTexture.dispose();
        this.ssaoMaterial.dispose();
        this.blurMaterial.dispose();
    }
}
