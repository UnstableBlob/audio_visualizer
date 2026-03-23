import sys
import numpy as np
import sounddevice as sd
from vispy import app, scene
from vispy.scene.visuals import Line

# --- CONFIGURATION ---
SAMPLE_RATE = 48000     
CHUNK_SIZE = 1024       
FFT_WINDOW = 2048       
CHANNELS = 2            

# --- NEW GEOMETRY SETTINGS ---
N_RINGS = 50            # Increased to 50 for a dense, solid-looking disk
N_ANGLES = 120          
RADIUS_START = 150      
RADIUS_END = 800        
Z_SCALE = 200.0         # Slightly lowered so the high density doesn't overwhelm the screen

# --- TIME DECAY FACTORS ---
ATTACK_RATE = 0.7       
DECAY_RATE = 0.85       
MIN_VOLUME = 0.001      

# --- GLOBAL BUFFERS ---
audio_buffer = np.zeros((FFT_WINDOW, CHANNELS))
hanning_window = np.hanning(FFT_WINDOW) 
Z_current = np.zeros((N_RINGS, N_ANGLES + 1)) 

# --- CALCULATE 3D POLAR GRID & DIRECTIONAL WEIGHTS ---
theta = np.linspace(0, 2 * np.pi, N_ANGLES + 1)
radii = np.linspace(RADIUS_START, RADIUS_END, N_RINGS)

rings_x = [r * np.cos(theta) for r in radii]
rings_y = [r * np.sin(theta) for r in radii]

weight_R = (1 + np.cos(theta)) / 2.0  
weight_L = (1 - np.cos(theta)) / 2.0  

# --- AUDIO CALLBACK ---
def audio_callback(indata, frames, time, status):
    global audio_buffer
    if status:
        print(status, file=sys.stderr)
        
    if indata.shape[1] == 1:
        stereo_data = np.column_stack((indata[:, 0], indata[:, 0]))
    else:
        stereo_data = indata[:, :2]
        
    audio_buffer = np.roll(audio_buffer, -frames, axis=0)
    audio_buffer[-frames:, :] = stereo_data

# --- VISPY 3D SCENE SETUP ---
canvas = scene.SceneCanvas(keys='interactive', show=True, bgcolor='black')
view = canvas.central_widget.add_view()
view.camera = 'turntable'
view.camera.distance = 1600 
view.camera.elevation = 25  

lines = []
for i in range(N_RINGS):
    # Color gradient remains, but spread smoothly across 50 rings
    color_ratio = i / (N_RINGS - 1)
    # Using slightly lower alpha (0.6) so the dense lines glow together nicely
    color = (0.2 + (color_ratio * 0.4), 0.8 - (color_ratio * 0.4), 1.0, 0.6)
    line = Line(color=color, method='gl', width=2, antialias=True, parent=view.scene)
    lines.append(line)

# --- NEW: SMOOTH FREQUENCY EXTRACTION ---
def get_smooth_bands(channel_data):
    """Processes raw audio and smoothly interpolates it across 50 rings."""
    windowed = channel_data * hanning_window
    fft_mags = np.abs(np.fft.rfft(windowed))
    
    # Take the usable frequency range (roughly ignoring the highest, empty treble)
    # Bins 2 to 300 covers the core of most music (up to ~7000Hz)
    usable_fft = fft_mags[2:300]
    
    # 1. Smooth the raw FFT data so sharp peaks turn into soft hills
    kernel_size = 15
    smoothing_kernel = np.hanning(kernel_size) / np.sum(np.hanning(kernel_size))
    smoothed_fft = np.convolve(usable_fft, smoothing_kernel, mode='same')
    
    # 2. Resample the curve to perfectly fit our 50 rings using linear interpolation
    old_indices = np.arange(len(smoothed_fft))
    new_indices = np.linspace(0, len(smoothed_fft) - 1, N_RINGS)
    band_energies = np.interp(new_indices, old_indices, smoothed_fft)
    
    # 3. Smooth one final time ACROSS the 50 rings to guarantee radial flow
    radial_kernel = np.hanning(7) / np.sum(np.hanning(7))
    band_energies = np.convolve(band_energies, radial_kernel, mode='same')
    
    return np.log1p(band_energies) * Z_SCALE

# --- UPDATE LOOP ---
def update(ev):
    global Z_current
    
    y_raw = audio_buffer.copy()
    rms = np.sqrt(np.mean(y_raw**2))
    
    target_Z = np.zeros((N_RINGS, N_ANGLES + 1))
    
    if rms >= MIN_VOLUME:
        # Use the new smooth extraction function
        bands_L = get_smooth_bands(y_raw[:, 0])
        bands_R = get_smooth_bands(y_raw[:, 1])
        
        for i in range(N_RINGS):
            target_Z[i, :] = (bands_L[i] * weight_L) + (bands_R[i] * weight_R)
            
    Z_current = np.where(target_Z > Z_current,
                         Z_current * (1 - ATTACK_RATE) + target_Z * ATTACK_RATE,
                         Z_current * DECAY_RATE)
    
    for i in range(N_RINGS):
        pos = np.column_stack((rings_x[i], rings_y[i], Z_current[i, :]))
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
        channels=CHANNELS, 
        samplerate=SAMPLE_RATE, 
        blocksize=CHUNK_SIZE, 
        callback=audio_callback
    )
    with stream:
        print("Visualizing High-Density Smooth Disk... Play some music!")
        app.run()