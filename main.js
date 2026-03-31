import { AudioManager } from './src/audio.js';
import { createScene } from './src/scene.js';
import { Visualizer } from './src/visualizer.js';
import { CONFIG } from './src/config.js';
import { createBowl } from './src/bowl.js';
import { createWater } from './src/water.js';

// Initialize Three.js Boilerplate
const { scene, camera, renderer, controls } = createScene();

// Initialize Visualizer Logic
const visualizer = new Visualizer(scene);
createBowl(scene);
const water = createWater(scene);

// Initialize Audio Manager
const audio = new AudioManager();

// UI Elements
const initOverlay = document.getElementById('init-overlay');
const initBtn = document.getElementById('init-btn');
const fileInput = document.getElementById('file-input');
const playPauseBtn = document.getElementById('play-pause-btn');
const statusText = document.getElementById('status');
const volumeSlider = document.getElementById('volume-slider');
const seeker = document.getElementById('seeker');
const seekerContainer = document.getElementById('seeker-container');
const currentTimeText = document.getElementById('current-time');
const totalTimeText = document.getElementById('total-time');

// Lightweight debug panel to verify analyser data is changing.
const debugPanel = document.createElement('div');
debugPanel.style.position = 'fixed';
debugPanel.style.top = '20px';
debugPanel.style.right = '20px';
debugPanel.style.zIndex = '50';
debugPanel.style.width = '250px';
debugPanel.style.padding = '10px 12px';
debugPanel.style.background = 'rgba(0, 0, 0, 0.55)';
debugPanel.style.border = '1px solid rgba(255, 255, 255, 0.18)';
debugPanel.style.borderRadius = '8px';
debugPanel.style.backdropFilter = 'blur(10px)';
debugPanel.style.fontFamily = 'monospace';
debugPanel.style.fontSize = '11px';
debugPanel.style.color = '#e8f4ff';
debugPanel.style.pointerEvents = 'none';

const debugTitle = document.createElement('div');
debugTitle.textContent = 'AUDIO DEBUG';
debugTitle.style.letterSpacing = '1px';
debugTitle.style.opacity = '0.9';
debugTitle.style.marginBottom = '8px';

const debugStats = document.createElement('div');
debugStats.textContent = 'ctx:none playing:no avg:0.000 peak:0.000';
debugStats.style.opacity = '0.9';
debugStats.style.marginBottom = '8px';

const meterTrack = document.createElement('div');
meterTrack.style.width = '100%';
meterTrack.style.height = '8px';
meterTrack.style.borderRadius = '999px';
meterTrack.style.background = 'rgba(255, 255, 255, 0.12)';
meterTrack.style.overflow = 'hidden';

const meterFill = document.createElement('div');
meterFill.style.width = '100%';
meterFill.style.height = '100%';
meterFill.style.transformOrigin = 'left center';
meterFill.style.transform = 'scaleX(0)';
meterFill.style.background = 'linear-gradient(90deg, #3b82f6, #22d3ee, #22c55e, #f59e0b)';
meterFill.style.transition = 'transform 80ms linear';

meterTrack.appendChild(meterFill);
debugPanel.appendChild(debugTitle);
debugPanel.appendChild(debugStats);
debugPanel.appendChild(meterTrack);
document.body.appendChild(debugPanel);

let smoothedEnergy = 0;

function updateDebugMeter(bands) {
    let avg = 0;
    let peak = 0;

    if (bands && bands.length > 0) {
        let sum = 0;
        for (let i = 0; i < bands.length; i++) {
            const v = bands[i];
            sum += v;
            if (v > peak) peak = v;
        }
        avg = sum / bands.length;
    }

    smoothedEnergy = smoothedEnergy * 0.85 + avg * 0.15;
    const normalized = Math.max(0, Math.min(1, smoothedEnergy / 0.35));
    const vDebug = visualizer.getDebugInfo();

    meterFill.style.transform = `scaleX(${normalized})`;
    debugStats.textContent = `ctx:${audio.ctx?.state || 'none'} playing:${audio.isPlaying ? 'yes' : 'no'} avg:${avg.toFixed(3)} peak:${peak.toFixed(3)} gain:${vDebug.gain.toFixed(2)} h:${vDebug.maxHeight.toFixed(1)}`;
}

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
        updateDebugMeter(bands);

        // Update UI
        if (audio.isPlaying) {
            const current = audio.getCurrentTime();
            const total = audio.getDuration();
            seeker.value = current;
            currentTimeText.textContent = formatTime(current);
        }
    } else {
        updateDebugMeter(null);
    }

    // Animate water flow continuously
    if (water.material.uniforms['time']) {
        water.material.uniforms['time'].value += 0.5 / 60.0;
    }

    renderer.render(scene, camera);
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
