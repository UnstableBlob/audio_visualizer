import { CONFIG } from './config.js';

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.data = null;
        this.isStarted = false;

        this.audio = new Audio();
        this.audio.preload = 'auto';
        this.audio.crossOrigin = 'anonymous';
        this.audio.loop = true;
        this.source = null;
        this.isPlaying = false;
        this.objectUrl = null;

        // Keep internal state in sync with the underlying media element.
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
        });
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
        });
    }

    async init() {
        if (this.ctx) return true;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.ctx.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.minDecibels = -90;
            this.analyser.maxDecibels = -10;
            this.analyser.smoothingTimeConstant = 0.65;

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
            if (this.objectUrl) {
                URL.revokeObjectURL(this.objectUrl);
            }

            const url = URL.createObjectURL(file);
            this.objectUrl = url;
            this.audio.src = url;
            this.audio.load();

            const onReady = () => {
                cleanup();
                resolve(url);
            };

            const onError = (err) => {
                cleanup();
                reject(err);
            };

            const cleanup = () => {
                this.audio.removeEventListener('loadedmetadata', onReady);
                this.audio.removeEventListener('canplay', onReady);
                this.audio.removeEventListener('error', onError);
            };

            this.audio.addEventListener('loadedmetadata', onReady, { once: true });
            this.audio.addEventListener('canplay', onReady, { once: true });
            this.audio.addEventListener('error', onError, { once: true });
        });
    }

    async togglePlay() {
        if (!this.ctx) {
            const ok = await this.init();
            if (!ok) return false;
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        if (this.isPlaying) {
            this.audio.pause();
            return false;
        } else {
            try {
                await this.audio.play();
                return true;
            } catch (err) {
                console.error('Audio play failed:', err);
                return false;
            }
        }
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

            // Lift low-level energy a bit so movement stays visible on quiet masters.
            const normalized = Math.max(0, (maxVal - 8) / 247);
            bands[i] = Math.pow(normalized, 0.75) * CONFIG.SENSITIVITY;
        }
        return bands;
    }
}
