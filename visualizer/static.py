import os
os.environ["QT_AUTO_SCREEN_SCALE_FACTOR"] = "1"
import sys
import numpy as np
import sounddevice as sd
from vispy import app, scene

# ==========================================
# --- VISUAL TWEAKS & CONFIGURATION ---
# ==========================================

SENSITIVITY = 1.0           # Overall amplitude multiplier. Increase if the visualizer is too small/quiet.
CHROMA_SPEED = 0.8          # How fast the rainbow spins in 'chroma' mode (lower is slower)

# Color for the default mode (Red, Green, Blue). Values from 0.0 to 1.0.
# Cyan: (0.0, 0.8, 1.0) | Purple: (0.8, 0.0, 1.0) | Fire Orange: (1.0, 0.4, 0.0) | Lime: (0.2, 1.0, 0.0)
CUSTOM_COLOR = (0.8, 0.0, 1.0) 

# ==========================================
# --- SYSTEM CONFIGURATION ---
# ==========================================
SAMPLE_RATE = 48000     
CHUNK_SIZE = 1024       
FFT_WINDOW = 2048       

NUM_MACRO_BANDS = 3     
RINGS_PER_BAND = 20     
N_RINGS = NUM_MACRO_BANDS * RINGS_PER_BAND 

N_ANGLES = 120          
NUM_BANDS = 24          

RADIUS_START = 150      
RADIUS_END = 950        
Z_SCALE = 350.0         

ATTACK_RATE = 0.6       
DECAY_RATE = 0.88       
MIN_VOLUME = 0.001      
NOISE_STRENGTH = 15.0   

# --- GLOBAL BUFFERS & STATE ---
audio_buffer = np.zeros(FFT_WINDOW)
hanning_window = np.hanning(FFT_WINDOW) 
Z_current = np.zeros((N_RINGS, N_ANGLES)) 
noise_time = 0.0        

# Toggle State for the colors
color_mode = 'custom'     

# --- CALCULATE 3D POLAR GRID ---
theta = np.linspace(0, 2 * np.pi, N_ANGLES, endpoint=False)
radii = np.linspace(RADIUS_START, RADIUS_END, N_RINGS)

Theta_2D, R_2D = np.meshgrid(theta, radii)
X_flat = (R_2D * np.cos(Theta_2D)).flatten()
Y_flat = (R_2D * np.sin(Theta_2D)).flatten()

# --- PRE-CALCULATE RADIAL DOME PROFILE ---
ripples = np.sin(np.linspace(0, np.pi * NUM_MACRO_BANDS, N_RINGS)) ** 2
macro_dome = np.sin(np.linspace(0, np.pi, N_RINGS))
radial_profile = (ripples * 0.85 + 0.15) * macro_dome
radial_multiplier = np.tile(radial_profile, (N_ANGLES, 1)).T 

# --- CINEMATIC BASE COLOR & FAUX DOF SETUP ---
base_colors = np.zeros((len(X_flat), 4))
base_sizes = np.zeros(len(X_flat))

for i in range(len(X_flat)):
    radius_ratio = np.sqrt(X_flat[i]**2 + Y_flat[i]**2) / RADIUS_END
    base_colors[i] = (0.01, 0.05, 0.2, 0.15)
    base_sizes[i] = 2.0 + np.sin(radius_ratio * np.pi) * 2.0

# --- VISPY 3D SCENE SETUP ---
canvas = scene.SceneCanvas(keys='interactive', show=True, bgcolor='black')
view = canvas.central_widget.add_view()
view.camera = 'turntable'
view.camera.distance = 1600 
view.camera.elevation = 20  

scatter = scene.visuals.Markers(parent=view.scene)
scatter.set_gl_state('additive', blend=True, depth_test=False)
scatter.set_data(pos=None, edge_width=0)

# --- KEY PRESS TOGGLE ---
@canvas.events.key_press.connect
def on_key_press(event):
    global color_mode
    if event.text.lower() == 'c':
        color_mode = 'chroma' if color_mode == 'custom' else 'custom'
        print(f"Color mode switched to: {color_mode.upper()}")

# --- AUDIO CALLBACK ---
def audio_callback(indata, frames, time, status):
    global audio_buffer
    if status:
        print(status, file=sys.stderr)
    audio_data = indata[:, 0]
    audio_buffer = np.roll(audio_buffer, -frames)
    audio_buffer[-frames:] = audio_data

# --- UPDATE LOOP ---
def update(ev):
    global Z_current, noise_time
    
    y_raw = audio_buffer.copy()
    rms = np.sqrt(np.mean(y_raw**2))
    
    target_Z = np.zeros((N_RINGS, N_ANGLES))
    
    if rms >= MIN_VOLUME:
        windowed = y_raw * hanning_window
        fft_mags = np.abs(np.fft.rfft(windowed))
        
        min_bin = 2    
        max_bin = 350  
        bin_edges = np.logspace(np.log10(min_bin), np.log10(max_bin), NUM_BANDS + 1)
        
        bands = []
        for i in range(NUM_BANDS):
            start = int(bin_edges[i])
            end = int(bin_edges[i+1])
            if start >= end:
                end = start + 1
            # Apply SENSITIVITY multiplier here
            bands.append(np.max(fft_mags[start:end]) * SENSITIVITY)
        
        half_angles = N_ANGLES // 2
        interp_bands = np.interp(np.linspace(0, 1, half_angles), np.linspace(0, 1, NUM_BANDS), bands)
        
        smoothing_kernel = np.hanning(9) / np.sum(np.hanning(9))
        smooth_wave = np.convolve(interp_bands, smoothing_kernel, mode='same')
        
        full_wave = np.concatenate((smooth_wave, smooth_wave[::-1]))
        full_wave = np.log1p(full_wave) * Z_SCALE
        
        target_Z = full_wave * radial_multiplier

    Z_current = np.where(target_Z > Z_current,
                         Z_current * (1 - ATTACK_RATE) + target_Z * ATTACK_RATE,
                         Z_current * DECAY_RATE)

    # ADD NOISE
    noise_time += 0.03
    layer1 = np.sin(Theta_2D * 4 + noise_time) * np.cos(R_2D / 100 - noise_time * 1.5)
    layer2 = np.sin(Theta_2D * 8 - noise_time * 0.7) * np.cos(R_2D / 50 + noise_time * 2.1) * 0.4
    noise_overlay = (layer1 + layer2) * NOISE_STRENGTH
    
    Z_render = Z_current + noise_overlay
    Z_flat = Z_render.flatten()
    dynamic_colors = base_colors.copy()
    
    raw_intensity = np.clip(Z_flat / (Z_SCALE * 0.7), 0.0, 3.0) 
    mapped_intensity = 1.0 - np.exp(-raw_intensity * 1.5)

    if color_mode == 'custom':
        # Apply the user's custom color definition from the top of the script
        dynamic_colors[:, 0] = np.clip(base_colors[:, 0] + mapped_intensity * CUSTOM_COLOR[0], 0.0, 1.0) 
        dynamic_colors[:, 1] = np.clip(base_colors[:, 1] + mapped_intensity * CUSTOM_COLOR[1], 0.0, 1.0)        
        dynamic_colors[:, 2] = np.clip(base_colors[:, 2] + mapped_intensity * CUSTOM_COLOR[2], 0.0, 1.0)  
        
        # Add a subtle white-hot core exclusively at the most extreme peaks
        white_hot = (mapped_intensity ** 3) * 0.5
        dynamic_colors[:, 0] = np.clip(dynamic_colors[:, 0] + white_hot, 0.0, 1.0)
        dynamic_colors[:, 1] = np.clip(dynamic_colors[:, 1] + white_hot, 0.0, 1.0)
        dynamic_colors[:, 2] = np.clip(dynamic_colors[:, 2] + white_hot, 0.0, 1.0)
        
    elif color_mode == 'chroma':
        # Apply the CHROMA_SPEED multiplier
        phase = Theta_2D.flatten() + (noise_time * CHROMA_SPEED)
        r_wave = (np.sin(phase) * 0.5 + 0.5)
        g_wave = (np.sin(phase + 2.094) * 0.5 + 0.5) 
        b_wave = (np.sin(phase + 4.188) * 0.5 + 0.5) 
        
        # FIX: Added a constant '0.15' idle brightness so the noise floor is visible when quiet
        dynamic_colors[:, 0] = np.clip(r_wave * (0.15 + mapped_intensity * 1.2), 0.0, 1.0)
        dynamic_colors[:, 1] = np.clip(g_wave * (0.15 + mapped_intensity * 1.2), 0.0, 1.0)
        dynamic_colors[:, 2] = np.clip(b_wave * (0.15 + mapped_intensity * 1.2), 0.0, 1.0)

    # Boost Alpha (transparency) as they get louder
    dynamic_colors[:, 3] = np.clip(base_colors[:, 3] + mapped_intensity * 0.4, 0.0, 1.0)

    # Faux Depth of Field (Dynamic Sizing)
    dynamic_sizes = base_sizes + (mapped_intensity * 3.5)

    # PUSH TO GPU
    pos = np.column_stack((X_flat, Y_flat, Z_flat))
    scatter.set_data(pos, face_color=dynamic_colors, size=dynamic_sizes, edge_width=0)

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
        print("Visualizing Cinematic Dome... Play some heavy music!")
        print(">>> PRESS 'C' TO TOGGLE COLOR MODES <<<")
        app.run()