
# ENGINE 2.0 – 3D Interactive Viewer

ENGINE 2.0 is a modular 3D viewer built with Three.js and Vite.  
It provides a scalable architecture for interactive technical visualization with support for:

- Exploded view
- Focus / isolate mode
- Hierarchical sidebar navigation
- Hover highlighting and dimming
- Mesh visibility control
- Specifications panel integration
- Camera home view and global reset
- Fully modular CSS sidebar system

The project is structured to separate rendering logic, UI logic, state management, and model-specific behavior.

---

# Architecture Overview

The system is divided into four logical layers:

1. Core Viewer Layer
2. Model Logic Layer
3. UI Layer
4. State and Controller Layer

Each module has a strict responsibility to avoid cross-dependencies and tight coupling.

---

# Project Structure

```text
ENGINE2.0/
├─ .vscode/
├─ css/
│  ├─ viewer-base.css
│  ├─ viewer-ui.css
│  ├─ viewer-preloader.css
│  ├─ viewer-sidebar.css
│  └─ sidebar/
│     ├─ sidebar.tokens.css
│     ├─ sidebar.layout.css
│     ├─ sidebar.tree.css
│     ├─ sidebar.toggle.css
│     ├─ sidebar.contact.css
│     ├─ sidebar.themes.css
│     └─ sidebar.responsive.css
│
├─ public/
│  ├─ glb/
│  │  └─ engine2.glb
│  ├─ hdr/
│  │  └─ venice_sunset_1k.hdr
│  ├─ images/
│  ├─ docs/
│  │  └─ help/
│  └─ favicon/
│
├─ viewer/
│  ├─ index.js
│  ├─ core.js
│  └─ models/
│     ├─ engine.js
│     ├─ engine-explode.js
│     ├─ engine-focus.js
│     ├─ engine-labels.js
│     ├─ engine-sidebar.js
│     ├─ engine-names.js
│     ├─ engine-tree.js
│     ├─ engine-picking.js
│     ├─ engine-visibility.js
│     ├─ engine-reset.js
│     └─ engine-specs.js
│
├─ index.html
├─ vite.config.js
├─ package.json
└─ README.md
```

---

# CSS Architecture

## Base Viewer CSS

viewer-base.css  
Global layout including canvas sizing, background, and loading overlay.

viewer-ui.css  
Viewer controls such as zoom buttons, explode toggle, and general UI controls.

viewer-preloader.css  
Loading screen styling and transition effects.

---

## Sidebar CSS (Modular System)

The sidebar is split into logical modules.

sidebar.tokens.css  
Defines CSS variables such as colors, spacing, border radius, shadows, and easing curves.

sidebar.layout.css  
Controls sidebar container layout, header, body, overlay, and footer.

sidebar.tree.css  
Handles component tree layout, expand and collapse logic, and animations.

sidebar.toggle.css  
Floating toggle button styling and animation.

sidebar.contact.css  
Contact or information card inside the sidebar.

sidebar.themes.css  
Theme overrides for light and dark modes.

sidebar.responsive.css  
Media queries and mobile adaptations.

viewer-sidebar.css acts as an aggregator and imports all sidebar modules.

---

# Public Assets

public/glb/engine2.glb  
Main 3D model file.

public/hdr/venice_sunset_1k.hdr  
HDR environment lighting file.

public/docs/help/  
Contains PDF documentation used in the focus panel and sidebar.

public/images/  
Static image assets.

---

# Viewer Source Code

## Core Layer

index.js  
Bootstraps the viewer and initializes the application.

core.js  
Creates the scene, renderer, camera, orbit controls, and manages the render loop.

---

# Engine Modules

Located in viewer/models/

---

## engine.js

Main orchestrator and lifecycle manager.

Responsibilities:

- Loads the model
- Builds scene tree
- Initializes all controllers
- Wires sidebar, visibility, focus, picking, and reset together
- Handles afterLoad lifecycle
- Coordinates state flow between modules

This file does not implement business logic. It composes other modules.

---

## engine-explode.js

Handles exploded view logic.

Responsibilities:

- Preparing explode vectors
- Running explode animation
- Running implode animation
- Managing explode state

State variables:

- state.isExploded
- state.t

---

## engine-focus.js

Handles focus and isolate mode.

Responsibilities:

- Focus mode activation
- Subtree isolation
- Smooth camera framing
- Saving and restoring camera state
- Info panel rendering
- Canonical name resolution
- Optional PDF linking

Public API:

- initFocus()
- focusOnPart()
- exitFocusMode()
- isFocusMode()

Focus temporarily overrides visibility rules.

---

## engine-visibility.js

Single source of truth for mesh visibility.

Responsibilities:

- Tracking hidden meshes
- Handling group isolation
- Hover dimming of materials
- Label dimming
- Active filter owner path tracking
- Restoring visibility states

Core concepts:

- hiddenMeshes set
- activeFilterOwnerPath
- lastAllowedSet

Public API:

- showAllParts()
- showOnlyMeshes()
- refreshVisibility()
- toggleMeshHidden()
- setMeshesHidden()
- isMeshHidden()
- applyHoverUX()
- clearHoverUX()

This module does not manage camera logic.

---

## engine-tree.js

Builds logical scene hierarchy from Three.js scene graph.

Responsibilities:

- Converting scene into tree structure
- Generating unique paths
- Assigning displayName and breadcrumb
- Collecting meshes in subtree
- Regrouping top-level nodes for sidebar categories

Exports:

- buildEngineTree()
- collectMeshesInSubtree()
- regroupTreeForSidebar()

This module is UI-agnostic.

---

## engine-picking.js

Handles raycasting.

Responsibilities:

- Detecting hover mesh
- Detecting clicked mesh
- Delegating interaction to focus and visibility modules

Does not manipulate camera directly.

---

## engine-labels.js

Handles DOM labels attached to meshes.

Responsibilities:

- Screen-space projection
- Updating label position
- Label click integration with focus

---

## engine-specs.js

Generates specification nodes for sidebar.

Responsibilities:

- Creating pseudo tree nodes
- Injecting spec entries into sidebar
- Managing PDF links

---

## engine-reset.js

Global reset controller.

Responsibilities:

- Restoring camera home view
- Clearing explode state
- Exiting focus mode
- Resetting visibility
- Clearing hover state

---

# Data Flow

Sidebar click:

Sidebar  
→ Focus or Visibility module  
→ visibility.refreshVisibility()  
→ Scene and labels update  

Hover flow:

Picking  
→ setHoverMesh()  
→ visibility.applyHoverUX()  

Focus flow:

focusOnPart()  
→ isolate subtree  
→ animate camera  
→ show info panel  

---

# State Model

There are three independent state systems:

Explode state  
Owned by engine-explode.js

Focus state  
Owned by engine-focus.js

Visibility state  
Owned by engine-visibility.js

Focus temporarily overrides visibility.

Explode does not directly modify visibility state.

---

# Development

Install dependencies:

npm install

Start development server:

npm run dev

Open the local development URL shown in the terminal.

Build production:

npm run build

Preview production build:

npm run preview

---

# Architectural Principles

1. Tree builder must not contain DOM logic.
2. Sidebar must not control camera directly.
3. Visibility controller owns visibility logic.
4. Focus controller owns camera framing logic.
5. engine.js is only a composition layer.
6. Each module must have a single responsibility.

---

# Scalability

The current structure allows:

- Adding new models with minimal changes
- Reusing sidebar system across models
- Switching model modules without rewriting core
- Maintaining clean separation between UI and 3D logic
- Future migration to multi-model architecture

This architecture is designed for long-term maintainability and feature expansion.

