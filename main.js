import { AudioManager } from './src/audio.js';
import { createScene } from './src/scene.js';
import { Visualizer } from './src/visualizer.js';
import { CONFIG } from './src/config.js';
import { Particles } from './src/particles.js';

// Initialize Three.js Boilerplate
const { scene, camera, renderer, controls, composer } = createScene();

// Initialize Visualizer Logic
const visualizer = new Visualizer(scene);
const particles = new Particles(scene);

// Initialize Audio Manager
const audio = new AudioManager();

// UI Elements
const initOverlay = document.getElementById('init-overlay');
const initBtn = document.getElementById('init-btn');
const fileInput = document.getElementById('file-input');
const playPauseBtn = document.getElementById('play-pause-btn');
const statusText = document.getElementById('status');
const volumeSlider = document.getElementById('volume-slider');
const colorPicker = document.getElementById('color-picker');
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
    particles.update();
    
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

    composer.render();
}

// Start button listener (Overlay)
initBtn.addEventListener('click', async () => {
    const success = await audio.init();
    if (success) {
        initOverlay.classList.add('hide');
        animate();
    }
});

// File input listener
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            statusText.textContent = `Loading: ${file.name}...`;
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

// Color Control
colorPicker.addEventListener('input', (e) => {
    CONFIG.CUSTOM_COLOR.set(e.target.value);
    // Force color mode to 'custom' to see the change
    visualizer.colorMode = 'custom';
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
playPauseBtn.addEventListener('click', () => {
    const isPlaying = audio.togglePlay();
    playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
    statusText.textContent = isPlaying ? 'Playing' : 'Paused';
});

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'c') {
        const mode = visualizer.toggleColorMode();
        console.log(`Color mode: ${mode}`);
    }
    if (e.key === ' ') {
        if (!playPauseBtn.disabled) {
            const isPlaying = audio.togglePlay();
            playPauseBtn.textContent = isPlaying ? 'Pause' : 'Play';
            statusText.textContent = isPlaying ? 'Playing' : 'Paused';
        }
    }
});
