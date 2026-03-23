import sys
import numpy as np
import sounddevice as sd
from vispy import app, scene
from vispy.scene.visuals import Line
from scipy.signal import butter, lfilter
from scipy.ndimage import gaussian_filter

# --- CONFIGURATION ---
SAMPLE_RATE = 48000     
CHUNK_SIZE = 1024       
FFT_WINDOW = 2048       

# --- UNIFIED GEOMETRY SETTINGS ---
N_RINGS = 40            # Adjusted to 40 rings
N_ANGLES = 200          # High resolution around the circle
RADIUS_START = 200      
RADIUS_END = 900        
Z_SCALE = 150.0         
NOISE_STRENGTH = 30.0   # How MUCH noise affects the rings (increased for prominence)
MIN_VOLUME = 0.001      

# --- GLOBAL BUFFERS ---
audio_buffer = np.zeros(FFT_WINDOW)
hanning_window = np.hanning(FFT_WINDOW) 

# FIX 1: The history array should NOT have the overlapping point yet. 
# It strictly holds the 200 unique angles.
Z_history = np.zeros((N_RINGS, N_ANGLES)) 
noise_time = 0.0        

# --- CALCULATE 3D POLAR GRID ---
# We still need N_ANGLES + 1 for rendering so the line physically closes
theta = np.linspace(0, 2 * np.pi, N_ANGLES + 1)
radii = np.linspace(RADIUS_START, RADIUS_END, N_RINGS)

Theta_2D, R_2D = np.meshgrid(theta, radii)
rings_x = R_2D * np.cos(Theta_2D)
rings_y = R_2D * np.sin(Theta_2D)

# --- VISPY 3D SCENE SETUP ---
canvas = scene.SceneCanvas(keys='interactive', show=True, bgcolor='black')
view = canvas.central_widget.add_view()
view.camera = 'turntable'
view.camera.distance = 1800 
view.camera.elevation = 30  

lines = []
for i in range(N_RINGS):
    color = (0.0, 0.8, 1.0, 0.45) 
    line = Line(color=color, method='gl', width=2, antialias=True, parent=view.scene)
    lines.append(line)

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
    global Z_history, noise_time
    
    y_raw = audio_buffer.copy()
    rms = np.sqrt(np.mean(y_raw**2))
    
    Z_history = np.roll(Z_history, 1, axis=0)
    Z_history *= 0.98 
    
    if rms >= MIN_VOLUME:
        windowed = y_raw * hanning_window
        fft_mags = np.abs(np.fft.rfft(windowed))
        
        usable_fft = fft_mags[2:200] 
        kernel = np.hanning(20) / np.sum(np.hanning(20))
        smoothed_fft = np.convolve(usable_fft, kernel, mode='same')
        
        old_indices = np.arange(len(smoothed_fft))
        new_indices = np.linspace(0, len(smoothed_fft) - 1, N_ANGLES)
        band_energies = np.interp(new_indices, old_indices, smoothed_fft)
        
        z_data = np.log1p(band_energies) * Z_SCALE
        
        # FIX 2: Inject the data directly. Do NOT append the duplicate point yet.
        Z_history[0, :] = z_data
    else:
        Z_history[0, :] = 0.0

    # FIX 3: THE SEAM FIX
    # Pad the angular axis (axis 1) by wrapping 10 points from the other side. 
    # Do not pad the radial axis (axis 0).
    Z_padded = np.pad(Z_history, pad_width=((0, 0), (10, 10)), mode='wrap')
    
    # Blur the padded array
    Z_melted_padded = gaussian_filter(Z_padded, sigma=(1.2, 2.5))
    
    # Crop the extra padding off, returning to (N_RINGS, N_ANGLES)
    Z_melted = Z_melted_padded[:, 10:-10]
    
    # FIX 4: Finally, duplicate the very first angle to the very end to physically close the ring
    Z_closed = np.column_stack((Z_melted, Z_melted[:, 0]))

    # Add Noise
    noise_time += 0.03
    # A more complex, multi-layered noise pattern for extra texture
    layer1 = np.sin(Theta_2D * 4 + noise_time) * np.cos(R_2D / 100 - noise_time * 1.5)
    layer2 = np.sin(Theta_2D * 8 - noise_time * 0.7) * np.cos(R_2D / 50 + noise_time * 2.1) * 0.4
    noise_overlay = (layer1 + layer2) * NOISE_STRENGTH
    
    Z_render = Z_closed + noise_overlay

    # Push to GPU
    for i in range(N_RINGS):
        pos = np.column_stack((rings_x[i], rings_y[i], Z_render[i, :]))
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
        print("Visualizing Unified Fluid Wave... Play some music!")
        app.run()