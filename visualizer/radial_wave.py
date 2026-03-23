import sys
import numpy as np
import sounddevice as sd
from vispy import app, scene
from vispy.scene.visuals import Line
from scipy.signal import butter, lfilter

# --- CONFIGURATION ---
SAMPLE_RATE = 48000     
CHUNK_SIZE = 1024       
FFT_WINDOW = 2048       

# Visual / Geometry Settings
HISTORY_LEN = 100       # Increased to make the wave travel further and look denser
N_BINS = 200            # Increased for ultra-smooth circular curves
RADIUS_START = 100      
RADIUS_END = 900        

# ADJUSTED Z-SCALE
Z_SCALE = 180.0        

# Noise Management 
MIN_VOLUME = 0.001      
LOWCUT = 20.0           
HIGHCUT = 12000.0       

# --- GLOBAL BUFFERS ---
audio_buffer = np.zeros(FFT_WINDOW)
hanning_window = np.hanning(FFT_WINDOW) 

# --- PRE-CALCULATE 3D POLAR GRID ---
theta = np.linspace(0, 2 * np.pi, N_BINS + 1)
radii = np.linspace(RADIUS_START, RADIUS_END, HISTORY_LEN)

# Instead of a meshgrid for a Surface, we create a list of X/Y coordinates for each ring
rings_x = [r * np.cos(theta) for r in radii]
rings_y = [r * np.sin(theta) for r in radii]

Z_history = np.zeros((HISTORY_LEN, N_BINS + 1)) 

# --- AUDIO FILTERING ---
def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def apply_bandpass_filter(data, lowcut, highcut, fs, order=5):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    return lfilter(b, a, data)

# --- AUDIO CALLBACK ---
def audio_callback(indata, frames, time, status):
    global audio_buffer
    if status:
        print(status, file=sys.stderr)
    audio_data = indata[:, 0]
    audio_buffer = np.roll(audio_buffer, -frames)
    audio_buffer[-frames:] = audio_data

# --- VISPY 3D SCENE SETUP ---
canvas = scene.SceneCanvas(keys='interactive', show=True, bgcolor='black')
view = canvas.central_widget.add_view()
view.camera = 'turntable'
view.camera.distance = 1800 
view.camera.elevation = 40  

# CREATE THE GLOWING RINGS (Replaces the SurfacePlot)
lines = []
for i in range(HISTORY_LEN):
    # Shader effect: Calculate color fading from bright cyan/white at center to dark blue/black at the edge
    fade = 1.0 - (i / HISTORY_LEN)
    
    # R, G, B, Alpha. (Slightly white hot at the absolute center)
    r = 0.2 * (fade ** 3)
    g = 0.8 * fade
    b = 1.0 * fade
    alpha = fade * 0.9 
    
    color = (r, g, b, alpha)
    
    # We use multiple Line visuals. No radial lines will be drawn!
    line = Line(color=color, method='gl', width=2, antialias=True, parent=view.scene)
    lines.append(line)

# --- UPDATE LOOP ---
def update(ev):
    global Z_history
    
    y_raw = audio_buffer.copy()
    y_filtered = apply_bandpass_filter(y_raw, LOWCUT, HIGHCUT, SAMPLE_RATE)
    
    rms = np.sqrt(np.mean(y_filtered**2))
    
    if rms < MIN_VOLUME:
        return 
        
    windowed_audio = y_filtered * hanning_window
    fft_mags = np.abs(np.fft.rfft(windowed_audio))
    
    fft_sliced = fft_mags[:N_BINS]
    
    # Ultra-smooth curves: Using a wider Hanning window to smooth the FFT peaks
    smoothing_kernel = np.hanning(15) / np.sum(np.hanning(15))
    fft_smoothed = np.convolve(fft_sliced, smoothing_kernel, mode='same')
    
    # Logarithmic compression to keep the waves contained
    z_data = np.log1p(fft_smoothed) * Z_SCALE
    
    # Close the circle seamlessly
    z_data_closed = np.append(z_data, z_data[0])
    
    # Ripple the History Outwards
    Z_history = np.roll(Z_history, 1, axis=0)
    Z_history[0, :] = z_data_closed
    
    # Push the new 3D positions to each ring
    for i in range(HISTORY_LEN):
        # Stack the pre-calculated X and Y with the live Z height for this specific ring
        pos = np.column_stack((rings_x[i], rings_y[i], Z_history[i]))
        lines[i].set_data(pos=pos)

timer = app.Timer(interval=1.0/60.0, connect=update, start=True)

# --- START APPLICATION ---
def find_stereo_mix():
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
        print("Visualizing smooth wave... Play some music!")
        app.run()