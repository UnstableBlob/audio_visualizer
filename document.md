# Project Documentation: Audio Visualizer Web

## Overview
This project is a high-performance, web-based audio visualizer built using **Three.js**. It features a 3D polar grid of particles that react dynamically to frequency data from an audio file. The application supports custom color modes, real-time noise layers, and interactive controls for an immersive experience.

---

## Architecture & Data Flow
1.  **Audio Processing**: The `AudioManager` uses the Web Audio API to extract frequency data.
2.  **Scene Management**: The `createScene` utility initializes the Three.js environment (Scene, Camera, Renderer, Controls).
3.  **Visualization**: The `Visualizer` class maps the processed audio data onto a 3D point cloud, applying mathematical functions for ripples, waves, and color shifts.
4.  **Orchestration**: `main.js` serves as the glue, handling user interactions and the main animation loop.

---

## Detailed Component Breakdown

### 1. Configuration (`src/config.js`)
Stores all the adjustable parameters for the visualizer.

| Variable | Description |
| :--- | :--- |
| `N_RINGS` | Number of concentric rings in the visualizer (Default: 60). |
| `N_ANGLES` | Number of points per ring (Default: 120). |
| `RADIUS_START` | Inner radius of the visualization. |
| `RADIUS_END` | Outer radius of the visualization. |
| `Z_SCALE` | Maximum height (Z-axis) of the audio-reactive waves. |
| `SENSITIVITY` | Multiplier for audio frequency data. |
| `ATTACK_RATE` | Speed at which waves rise (0.0 to 1.0). |
| `DECAY_RATE` | Speed at which waves fall/settle. |
| `NOISE_STRENGTH` | Amplitude of the background noise layers. |
| `CHROMA_SPEED` | Speed of color cycling in 'chroma' mode. |
| `CUSTOM_COLOR` | The base color used in 'custom' mode. |

---

### 2. Audio Management (`src/audio.js`)
Handled by the **`AudioManager`** class.

#### Variables:
- `ctx`: The `AudioContext` instance.
- `analyser`: A `WebAudio AnalyserNode` for frequency analysis.
- `data`: A `Uint8Array` to store raw frequency bytes.
- `audio`: An HTML Audio element.
- `isPlaying`: Boolean reflecting the current state.

#### Functions:
- **`init()`**: Requests audio permissions and sets up the node graph (`Source -> Analyser -> Destination`).
- **`loadAudio(file)`**: Converts a local file into a blob URL and loads it into the audio element.
- **`getInterpolatedBands(numBands)`**: 
    - Maps the logarithmic frequency spectrum into a specific number of bands.
    - Applies `CONFIG.SENSITIVITY` to the output.
- **`togglePlay()`**: Starts/stops the audio playback.
- **`setVolume(value)`**: Adjusts the volume property of the audio element.

---

### 3. Scene Setup (`src/scene.js`)
Configures the 3D environment via **`createScene()`**.

#### Functions:
- **`createScene()`**:
    - Creates a `THREE.Scene` with a black background.
    - Sets up a `PerspectiveCamera` positioned at (0, 800, 1400).
    - Initializes the `WebGLRenderer` with antialiasing.
    - Adds `OrbitControls` for user-driven rotation and zoom.
    - Handles window resize events to keep the aspect ratio correct.

---

### 4. Visualizer Core (`src/visualizer.js`)
Managed by the **`Visualizer`** class.

#### Variables:
- `zCurrent`: A `Float32Array` storing the current height of every point (for smooth transitions).
- `radialProfile`: Pre-calculated curve to shape the visualizer (ripples and dome effect).
- `geometry`: `THREE.BufferGeometry` holding the positions, colors, and sizes of all points.
- `material`: `THREE.PointsMaterial` for rendering the cloud.
- `points`: The final `THREE.Points` object added to the scene.

#### Functions:
- **`initGeometry()`**:
    - Generates a polar grid $$(r, \theta)$$ and converts it to $$(x, y)$$ Cartesian coordinates.
    - Pre-calculates the `radialProfile` using Sine wave patterns.
    - Initializes `color` and `size` attributes for the particles.
- **`update(audioBands)`**:
    - **Wave Mirroring**: Mirrors the audio bands across the circle to create symmetry.
    - **Movement Logic**: 
        - Calculates target Z-height based on audio data.
        - Applies `ATTACK_RATE` (rising) and `DECAY_RATE` (falling) for smooth movement.
    - **Noise Layers**: Layers two sine-based noise functions over the audio heights for a "fluid" look.
    - **Color Mapping**: 
        - **Custom Mode**: Blends `CUSTOM_COLOR` with heat-based intensity (white-hot centers).
        - **Chroma Mode**: Cycles through colors based on the angle ($$\theta$$) and time.
- **`toggleColorMode()`**: Switches between 'custom' and 'chroma' schemes.

---

### 5. Orchestration (`main.js`)
The main script that drives the application.

#### Key Functions:
- **`animate()`**: The core loop using `requestAnimationFrame`. It updates the controls, fetches new audio bands, and triggers the `visualizer.update()` logic.
- **`formatTime(seconds)`**: Utility to format track duration into `MM:SS`.

#### UI Interactions:
- **`initBtn`**: Triggers `audio.init()` (required by browsers for audio playback).
- **`fileInput`**: Allows users to upload `.mp3`, `.wav`, etc.
- **`playPauseBtn`**: Toggles music and updates UI labels.
- **`seeker`**: 
    - `input`: Updates time display while dragging.
    - `change`: Seeks the audio to the selected position.
- **`colorPicker`**: Updates `CONFIG.CUSTOM_COLOR` in real-time.
- **Keyboard Shortcuts**:
    - `Space`: Play/Pause.
    - `C`: Toggle Color Mode.

---

## How they work together
1.  **Startup**: `main.js` initializes the Scene and Visualizer. The UI shows an overlay.
2.  **Interaction**: User clicks "Start Engine", enabling the `AudioContext`.
3.  **Loading**: User selects a file; `AudioManager` loads it and calculates the total duration.
4.  **Playback**: User clicks "Play". The `animate()` loop begins fetching frequency bands from `AudioManager`.
5.  **Synchronization**: These bands are passed to `Visualizer.update()`, which modifies the Z-positions and colors of the `BufferGeometry` attributes.
6.  **Rendering**: `renderer.render()` draws the updated 14,400+ points to the screen at every frame (usually 60fps).
