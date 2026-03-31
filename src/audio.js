import { CONFIG } from './config.js';

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.data = null;
        this.isStarted = false;
        
        this.audio = new Audio();
        this.audio.loop = true;
        this.source = null;
        this.isPlaying = false;
    }

    async init() {
        if (this.ctx) return true;
        
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 2048;
            
            this.source = this.ctx.createMediaElementSource(this.audio);
            this.source.connect(this.analyser);
            this.analyser.connect(this.ctx.destination);
            
            this.data = new Uint8Array(this.analyser.frequencyBinCount);
            this.isStarted = true;
            return true;
        } catch (err) {
            console.error("Audio init failed:", err);
            return false;
        }
    }

    loadAudio(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            this.audio.src = url;
            this.audio.oncanplaythrough = () => resolve(url);
            this.audio.onerror = (err) => reject(err);
        });
    }

    togglePlay() {
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
        } else {
            this.audio.play();
            this.isPlaying = true;
        }
        return this.isPlaying;
    }

    getFrequencyData() {
        if (!this.isStarted) return null;
        this.analyser.getByteFrequencyData(this.data);
        return this.data;
    }

    getDuration() {
        return this.audio.duration || 0;
    }

    getCurrentTime() {
        return this.audio.currentTime || 0;
    }

    setCurrentTime(time) {
        if (this.audio) {
            this.audio.currentTime = time;
        }
    }

    setVolume(value) {
        if (this.audio) {
            this.audio.volume = Math.max(0, Math.min(1, value));
        }
    }

    getInterpolatedBands(numBands) {
        if (!this.isStarted) return new Float32Array(numBands);
        
        const data = this.getFrequencyData();
        const bands = new Float32Array(numBands);
        const minBin = 2; // ~43Hz
        const maxBin = Math.floor(data.length * 0.85); // Up to ~18.7kHz (most energy here)
        
        const logMin = Math.log10(minBin);
        const logMax = Math.log10(maxBin);
        const logRange = logMax - logMin;

        for (let i = 0; i < numBands; i++) {
            const startIdx = Math.floor(Math.pow(10, logMin + (i / numBands) * logRange));
            const endIdx = Math.max(startIdx + 1, Math.floor(Math.pow(10, logMin + ((i + 1) / numBands) * logRange)));
            
            let maxVal = 0;
            for (let j = startIdx; j < endIdx && j < data.length; j++) {
                maxVal = Math.max(maxVal, data[j]);
            }
            bands[i] = (maxVal / 255) * CONFIG.SENSITIVITY;
        }
        return bands;
    }
}
