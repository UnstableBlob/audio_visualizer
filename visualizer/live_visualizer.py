import sys
import numpy as np
import sounddevice as sd
import librosa
import matplotlib.cm as cm
from vispy import app, scene
from scipy.signal import butter, lfilter

# --- CONFIGURATION ---
SAMPLE_RATE = 48000     # Adjusted to match typical Windows system audio sample rate
CHUNK_SIZE = 1024       
FFT_WINDOW = 2048       
HISTORY_LEN = 300       

# Noise Management Settings (Optimized for clean system audio)
MIN_VOLUME = 0.001      # Lower threshold since system audio is cleaner than mic
LOWCUT = 20.0           # Keep low frequencies for music
HIGHCUT = 20000.0       # Keep high frequencies for music

# --- GLOBAL BUFFERS ---
audio_buffer = np.zeros(FFT_WINDOW)
pos_history = np.zeros((HISTORY_LEN, 3))
color_history = np.zeros((HISTORY_LEN, 4))
size_history = np.zeros(HISTORY_LEN)
last_centroid = 0.0

# --- AUDIO FILTERING (Scipy) ---
def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def apply_bandpass_filter(data, lowcut, highcut, fs, order=5):
    """Applies the bandpass filter to the raw audio array."""
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    y = lfilter(b, a, data)
    return y

# --- AUDIO CALLBACK (Producer Thread) ---
def audio_callback(indata, frames, time, status):
    global audio_buffer
    if status:
        print(status, file=sys.stderr)
    
    # Flatten incoming mono audio and roll the buffer
    audio_data = indata[:, 0]
    audio_buffer = np.roll(audio_buffer, -frames)
    audio_buffer[-frames:] = audio_data

# --- VISPY 3D SCENE SETUP ---
canvas = scene.SceneCanvas(keys='interactive', show=True, bgcolor='black')
view = canvas.central_widget.add_view()
view.camera = 'turntable'
view.camera.distance = 5000

scatter = scene.visuals.Markers(parent=view.scene)
lines = scene.visuals.Line(parent=view.scene, method='gl', antialias=True)
colormap = cm.get_cmap('plasma')

# --- UPDATE LOOP (Consumer / GUI Thread) ---
def update(ev):
    global pos_history, color_history, size_history, last_centroid
    
    # 1. Take a snapshot of the raw audio buffer
    y_raw = audio_buffer.copy()
    
    # 2. Apply the Bandpass Filter to remove background noise
    y_filtered = apply_bandpass_filter(y_raw, LOWCUT, HIGHCUT, SAMPLE_RATE)
    
    try:
        # 3. Calculate Volume (RMS) on the clean audio
        rms = librosa.feature.rms(y=y_filtered, frame_length=1024, hop_length=512)[0][0]
        
        # 4. THRESHOLD GATE: Stop drawing if the room is quiet
        if rms < MIN_VOLUME:
            return 
            
        # 5. Extract Features (Centroid & Spread) from the clean audio
        centroid = librosa.feature.spectral_centroid(y=y_filtered, sr=SAMPLE_RATE, n_fft=1024, hop_length=512)[0][0]
        spread = librosa.feature.spectral_bandwidth(y=y_filtered, sr=SAMPLE_RATE, n_fft=1024, hop_length=512)[0][0]
        
    except Exception:
        return # Skip frame if buffer is empty or math fails
        
    # 6. Dimensionality Mapping (Phase Space)
    x = centroid
    y_coord = last_centroid
    z = spread
    last_centroid = centroid
    
    # 7. Map Colors and Sizes
    norm_color = np.clip(centroid / 4000.0, 0.0, 1.0)
    rgba = colormap(norm_color)
    radius = np.clip(rms * 500, 2, 40) 
    
    # 8. Shift History Arrays 
    pos_history = np.roll(pos_history, -1, axis=0)
    color_history = np.roll(color_history, -1, axis=0)
    size_history = np.roll(size_history, -1)
    
    # 9. Apply new values to the head of the array
    pos_history[-1] = [x - 2000, y_coord - 2000, z - 2000] # Centering offset
    color_history[-1] = rgba
    size_history[-1] = radius

    # 10. Push data to the GPU via VisPy
    scatter.set_data(pos_history, edge_color=None, face_color=color_history, size=size_history)
    lines.set_data(pos=pos_history, color=(1, 1, 1, 0.3), width=1)

# Attach timer
timer = app.Timer('auto', connect=update, start=True)

# --- START APPLICATION ---
def find_stereo_mix():
    """Finds the index of the Stereo Mix or Loopback device."""
    devices = sd.query_devices()
    for i, d in enumerate(devices):
        name = d['name'].lower()
        if 'stereo mix' in name or 'loopback' in name:
            return i
    return None

if __name__ == '__main__':
    device_index = find_stereo_mix()
    if device_index is None:
        print("Error: Could not find 'Stereo Mix' or 'Loopback' device.")
        print("Please ensure 'Stereo Mix' is enabled in your Windows Sound Settings.")
        sys.exit(1)
        
    print(f"Using device: {sd.query_devices(device_index)['name']}")
    
    stream = sd.InputStream(
        device=device_index,
        channels=1, 
        samplerate=SAMPLE_RATE, 
        blocksize=CHUNK_SIZE, 
        callback=audio_callback
    )
    with stream:
        print("Visualizing system audio... Play some music!")
        print("Press Ctrl+C to stop.")
        app.run()