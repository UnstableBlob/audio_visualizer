import * as THREE from 'three';

export class Particles {
    constructor(scene) {
        this.scene = scene;
        this.particleCount = 4000;
        this.geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(this.particleCount * 3);
        const velocities = [];

        for (let i = 0; i < this.particleCount; i++) {
            // Distribute particles in a large sphere/cylinder
            const r = 300 + Math.random() * 2000;
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * 3000;

            positions[i * 3] = r * Math.cos(theta);
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = r * Math.sin(theta);

            // Small random velocities
            velocities.push({
                x: (Math.random() - 0.5) * 0.5,
                y: (Math.random() - 0.5) * 0.5 + 0.2, // Slight upward drift
                z: (Math.random() - 0.5) * 0.5
            });
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.velocities = velocities;

        // Soft dust material
        this.material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 3,
            transparent: true,
            opacity: 0.15,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
    }

    update() {
        const positions = this.geometry.attributes.position.array;
        
        for (let i = 0; i < this.particleCount; i++) {
            const v = this.velocities[i];
            
            positions[i * 3] += v.x;
            positions[i * 3 + 1] += v.y;
            positions[i * 3 + 2] += v.z;

            // Reset particle if it drifts too high
            if (positions[i * 3 + 1] > 1500) {
                positions[i * 3 + 1] = -1500;
            }
        }
        
        this.geometry.attributes.position.needsUpdate = true;
    }
}
