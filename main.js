import { AudioManager } from './src/audio.js';
import { createScene } from './src/scene.js';
import { Visualizer } from './src/visualizer.js';
import { CONFIG } from './src/config.js';
import { createBowl } from './src/bowl.js';
import { createWater } from './src/water.js';
import { optimizeRendererSettings, createProceduralCanvas } from './src/visual-enhancements.js';

// Initialize Three.js Boilerplate
const { scene, camera, renderer, controls } = createScene();

// Optimize renderer for quality
optimizeRendererSettings(renderer);

// Initialize Visualizer Logic
const visualizer = new Visualizer(scene);
createBowl(scene);
const water = createWater(scene);

// Initialize Audio Manager
const audio = new AudioManager();

// UI Elements
const fileInput = document.getElementById('file-input');
const playPauseBtn = document.getElementById('play-pause-btn');
const statusText = document.getElementById('status');
const volumeSlider = document.getElementById('volume-slider');
const seeker = document.getElementById('seeker');
const seekerContainer = document.getElementById('seeker-container');
const currentTimeText = document.getElementById('current-time');
const totalTimeText = document.getElementById('total-time');

// Helper to format time
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    if (audio.isStarted) {
        const bands = audio.getInterpolatedBands(64);
        visualizer.update(bands);

        // Update UI
        if (audio.isPlaying) {
            const current = audio.getCurrentTime();
            const total = audio.getDuration();
            seeker.value = current;
            currentTimeText.textContent = formatTime(current);
        }
    }

    // Animate water flow continuously
    if (water.material.uniforms['time']) {
        water.material.uniforms['time'].value += 0.5 / 60.0;
    }

    renderer.render(scene, camera);
}

// Start animation loop immediately
animate();

// File input listener
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            statusText.textContent = `Loading: ${file.name}...`;
            
            // Initialize audio on first user interaction if not already done
            if (!audio.isStarted) {
                await audio.init();
            }

            await audio.loadAudio(file);
            statusText.textContent = `Ready: ${file.name}`;
            
            // Set slider range
            const duration = audio.getDuration();
            seeker.max = duration;
            totalTimeText.textContent = formatTime(duration);
            seekerContainer.classList.add('visible');

            playPauseBtn.disabled = false;
            playPauseBtn.textContent = 'Play';
            audio.isPlaying = false; // Reset state on new load
        } catch (err) {
            statusText.textContent = 'Error loading audio file';
            console.error(err);
        }
    }
});

// Volume Control
volumeSlider.addEventListener('input', (e) => {
    audio.setVolume(parseFloat(e.target.value));
});

// Seeking Logic
seeker.addEventListener('input', (e) => {
    // Immediate update text while dragging
    currentTimeText.textContent = formatTime(e.target.value);
});

seeker.addEventListener('change', (e) => {
    // Actually seek when let go
    audio.setCurrentTime(parseFloat(e.target.value));
});

// Play/Pause button listener
playPauseBtn.addEventListener('click', async () => {
    const isPlaying = await audio.togglePlay();
    playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
    statusText.textContent = isPlaying ? 'Playing' : 'Paused';
});

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        if (!playPauseBtn.disabled) {
            audio.togglePlay().then((isPlaying) => {
                playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
                statusText.textContent = isPlaying ? 'Playing' : 'Paused';
            });
        }
    }
});

