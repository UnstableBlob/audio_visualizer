# 🌊 Echo Terrain Visualizer

**License:** MIT | **Three.js:** R170 | **Vite:** 6.0 | **Language:** JavaScript (ESM)

A high-fidelity, real-time 3D audio visualizer that transforms sound into a dynamic, shifting landscape. Built with **Three.js** and the **Web Audio API**, it features a procedurally generated terrain contained within a cinematic stone bowl and water-filled environment.

## 🚀 Overview

The **Echo Terrain Visualizer** is a web-based experiment in synesthesia. It extracts frequency data from any uploaded audio file and maps it to a high-density 3D polar grid. The result is a living, breathing landscape that reacts with fluid motion to every beat, bassline, and melody.

## ✨ Key Features

-   **Dynamic Terrain Displacement**: Maps frequency bands to 14,000+ points on a polar grid, creating symmetrical waves and ripples.
-   **Cinematic Environment**: A detailed stone bowl with animated, shader-based water surfaces for an immersive aesthetic.
-   **Fluid Animation Logic**: Uses attack/decay rates and Simplex noise layers to ensure smooth, natural-looking transitions between audio states.
-   **Interactive Controls**: Real-time seeking, volume adjustment, and full 3D camera control (Rotate/Zoom/Pan).
-   **High Performance**: Leverages `BufferGeometry` and optimized rendering settings to maintain 60fps on modern hardware.
-   **Keyboard Shortcuts**: Use the `Space` bar for quick play/pause toggling.

## 🛠️ Tech Stack

-   **Engine**: Three.js (WebGL)
-   **Audio Processing**: Web Audio API (AnalyserNode)
-   **Mathematics**: Simplex Noise for procedural fluid motion
-   **Build Tool**: Vite
-   **Styling**: Vanilla CSS with modern glassmorphism design tokens

## ⚙️ Setup & Installation

Follow these steps to get the project running locally.

### 1. Prerequisites

-   **Node.js**: version 18 or higher
-   **NPM**: version 9 or higher

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/terrain-audio-visualizer.git
cd terrain-audio-visualizer
npm install
```

### 3. Development

Start the Vite development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### 4. Build

To create a production-ready bundle:

```bash
npm run build
```

The output will be in the `dist/` directory.

## 🎨 Usage

1.  **Launch**: Open the application in your browser.
2.  **Import**: Click the **Import Track** button to select an audio file (`.mp3`, `.wav`, `.ogg`, etc.).
3.  **Play**: Hit the **Play** button or press the **Space** bar to start the visualization.
4.  **Explore**:
    -   **Left Click + Drag**: Rotate the 3D scene.
    -   **Scroll**: Zoom in/out.
    -   **Right Click + Drag**: Pan the camera.
    -   **Seeker Bar**: Jump to any part of the track.

## 📂 Project Structure

```text
├── src/
│   ├── audio.js         # Web Audio API management and analysis
│   ├── visualizer.js    # Core terrain generation and update logic
│   ├── scene.js         # Three.js context (camera, renderer, controls)
│   ├── water.js         # Shader-based water implementation
│   ├── bowl.js          # Static environment geometry (Stone Bowl)
│   ├── config.js        # Adjustable parameters (sensitivity, rings, etc.)
│   └── visual-enhancements.js # Post-processing and render optimizations
├── index.html           # Main UI and application container
├── main.js              # Orchestration and UI event handling
└── package.json         # Project dependencies and scripts
```

## 📜 License

This project is open-source and available under the **MIT License**.
