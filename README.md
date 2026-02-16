

## Project Structure

```text
ENGINE2.0/
├─ .vscode/                       # Editor / workspace configuration
│
├─ css/
│  ├─ viewer-base.css                # Global layout (canvas, background, loading overlay)
│  ├─ viewer-ui.css                  # Viewer controls (zoom, explode, labels, panels)
│  ├─ viewer-preloader.css           # Loading screen & transitions
│  │
│  ├─ viewer-sidebar.css             # Aggregator file – imports all sidebar modules
│  │
│  └─ sidebar/                       # Sidebar split into logical modules
│     ├─ sidebar.tokens.css          # CSS variables (colors, spacing, radii, shadows, easing)
│     ├─ sidebar.layout.css          # Main sidebar container, overlay, header, body, footer
│     ├─ sidebar.tree.css            # Component tree, groups, items, expand/collapse logic
│     ├─ sidebar.toggle.css          # Floating hamburger toggle button + animations
│     ├─ sidebar.contact.css         # Contact / info card inside sidebar
│     ├─ sidebar.themes.css          # Theme overrides (light/dark adjustments)
│     └─ sidebar.responsive.css      # Media queries & mobile adaptations
│
│
│
├─ public/                                # Static assets (served as web root)
│  ├─ glb/
│  │  └─ eco_cube.glb                     # Main 3D model (GLB)
│  │
│  ├─ hdr/
│  │  └─ venice_sunset_1k.hdr             # HDR environment lighting
│  │
│  ├─ images/
│  │  ├─ bitmap.jpg
│  │  ├─ bitmap2.jpg
│  │  └─ bitmap3.jpg
│  │
│  ├─ viewer/
│  │  └─ data/
│  │     └─ water.json                    # Water effect configuration
│  │
│  ├─ docs/
│  │  └─ help/
│  │     ├─ 3D_Model_User_Guide.pdf       # User instructions
│  │     └─ 19001-ETN-T-XD-0003_00_...pdf # Technical documentation
│  │
│  └─ favicon/
│     ├─ favicon.ico
│     └─ apple-touch-icon.png
│
├─ viewer/                                # Application source code (ES modules)
│  ├─ index.js                            # Viewer entry point (UI wiring, bootstrapping)
│  ├─ core.js                             # Scene, renderer, camera, controls, render loop
│  │
│  ├─ effects/
│  │  └─ water.js                         # Water surface / wave deformation logic
│  │
│  └─ models/                             # Engine modules
│     ├─ engine.js                        # Engine orchestrator / lifecycle
│     ├─ engine-explode.js                # Exploded view logic
│     ├─ engine-focus.js                  # Camera framing & focus mode
│     ├─ engine-labels.js                 # DOM labels bound to meshes
│     ├─ engine-sidebar.js                # Sidebar tree UI integration
│     ├─ engine-names.js                  # Mesh name mapping & display labels
│     ├─ engine-tree.js                   # Scene hierarchy builder & indexing
│     ├─ engine-picking.js                # Raycasting (hover / click selection)
│     ├─ engine-visibility.js             # Visibility & isolation controller
│     ├─ engine-reset.js                  # Global reset / home view logic
│     └─ engine-specs.js                  # Custom specifications sidebar (Boat / ECO Cube specs)
│
├─ node_modules/                          # Installed dependencies (generated)
│
├─ dist/                                  # Production build output (generated)
│
├─ index.html                             # Main HTML shell (Vite entry)
├─ vite.config.js                         # Vite configuration (base, build, publicDir)
├─ package.json                           # Project metadata & scripts
├─ package-lock.json                      # Dependency lockfile
├─ .gitignore
└─ README.md




Quick Start

Install dependencies
npm install

Start development server
npm run dev


Open the URL shown in the terminal (usually http://localhost:5173).

Build production version
npm run build

Preview production build
npm run preview
