import * as THREE from 'three';

import {
  state,
  prepareExplode,
  stopAnim,
  explodeMotor,
  implodeMotor,
  toggleExplode,
} from './engine-explode.js';

import { labelItems, setupLabels } from './engine-labels.js';
import { initFocus, focusOnPart, exitFocusMode, isFocusMode } from './engine-focus.js';
import { initComponentSidebar, resetSidebar } from './engine-sidebar.js';

import { getNiceName, prettyFromNodeName } from './engine-names.js';
import { buildEngineTree, collectMeshesInSubtree } from './engine-tree.js';
import { createPicking } from './engine-picking.js';
import { createVisibilityController } from './engine-visibility.js';
import { createResetController } from './engine-reset.js';

const gsap = window.gsap || null;

/* ======================================================================
   META
====================================================================== */

export const id = 'engine';
export const name = '3D Engine';
export const url = new URL('../../glb/engine2.glb', import.meta.url).href;

export const viewPreset = {
  dir: new THREE.Vector3(-9.6, 3.25, 7.8).normalize(),
  distanceMul: 1.45,
  offset: new THREE.Vector3(0.0, 0.05, 0.0),
  targetOffset: new THREE.Vector3(0.0, 0.10, 0.0),
};

/* ======================================================================
   FOCUS EVENT
====================================================================== */

function emitFocusEvent(mesh, label) {
  if (!mesh) return;

  window.dispatchEvent(
    new CustomEvent('engine:focus', {
      detail: {
        uuid: mesh.uuid || null,
        name: mesh.name || '',
        label: label || '',
      },
    })
  );
}

/* ======================================================================
   SCENE REFS
====================================================================== */

let cameraRef = null;
let controlsRef = null;
let containerRef = null;
let rendererRef = null;
let rootRef = null;

/* ======================================================================
   HOVER HIGHLIGHT (FIXED)
====================================================================== */

let hoveredMesh = null;
let hoveredOriginalMat = null;
let hoveredClones = null;

function isMaterialArray(m) {
  return Array.isArray(m);
}

function tintMaterialInPlace(m, colorHex, emissiveIntensity = 1.4) {
  if (!m) return;

  const color = new THREE.Color(colorHex);

  if (m.emissive && m.emissive.isColor) {
    m.emissive.set(color);
    m.emissiveIntensity = emissiveIntensity;
  } else if (m.color && m.color.isColor) {
    m.color.set(color);
  }
}

function cloneAndTintMaterial(mat, colorHex, emissiveIntensity = 1.4) {
  if (!mat) return mat;

  const m = mat.clone ? mat.clone() : mat;
  if (!m) return m;

  try {
    tintMaterialInPlace(m, colorHex, emissiveIntensity);
  } catch (_) {}

  return m;
}

function clearHover() {
  if (!hoveredMesh) return;

  try {
    if (hoveredClones) {
      if (Array.isArray(hoveredClones)) {
        hoveredClones.forEach((m) => m?.dispose?.());
      } else {
        hoveredClones?.dispose?.();
      }
    }
  } catch (_) {}

  if (hoveredOriginalMat) {
    hoveredMesh.material = hoveredOriginalMat;
  }

  hoveredMesh = null;
  hoveredOriginalMat = null;
  hoveredClones = null;
}

function setHoverMesh(mesh, color = 0x0a8dda) {
  if (!mesh || !mesh.isMesh || hoveredMesh === mesh) return;

  clearHover();

  hoveredMesh = mesh;
  hoveredOriginalMat = mesh.material;

  if (isMaterialArray(hoveredOriginalMat)) {
    const clones = hoveredOriginalMat.map((m) => cloneAndTintMaterial(m, color));
    hoveredClones = clones;
    mesh.material = clones;
  } else {
    const clone = cloneAndTintMaterial(hoveredOriginalMat, color);
    hoveredClones = clone;
    mesh.material = clone;
  }
}

/* ======================================================================
   TREE / VISIBILITY / PICKING / RESET
====================================================================== */

let modelTree = null;
let indexByPath = new Map();
let meshToPath = new WeakMap();

let visibility = null;
let picking = null;
let resetCtl = null;

/* ======================================================================
   LIFECYCLE
====================================================================== */

export async function afterLoad(root, _THREE, extra = {}) {
  picking?.teardown?.();
  picking = null;

  clearHover();
  visibility?.clearHoverDim?.();

  cameraRef = extra.camera || null;
  controlsRef = extra.controls || null;
  containerRef = extra.container || null;
  rendererRef = extra.renderer || null;
  rootRef = root;

  const treePack = buildEngineTree(rootRef);
  modelTree = treePack.modelTree;
  indexByPath = treePack.indexByPath;
  meshToPath = treePack.meshToPath;

  prepareExplode(rootRef, { getNiceName });

  setupLabels(root, {
    cameraRef,
    containerRef,
    state,
    getNiceName,
    focusOnPart: (mesh, label) => {
      clearHover();
      visibility?.clearHoverDim?.();

      focusOnPart(mesh, label);
      emitFocusEvent(mesh, label);
    },
    isFocusMode,
    setHoverMesh,
    clearHover,
  });

  visibility = createVisibilityController({
    root: rootRef,
    labelItems,
  });

  resetCtl = createResetController({
    getCamera: () => cameraRef,
    getControls: () => controlsRef,
    getVisibility: () => visibility,

    clearHover,
    isFocusMode,
    exitFocusMode,

    state,
    stopAnim,
    implodeMotor,

    gsap,
  });

  initFocus({
    camera: cameraRef,
    controls: controlsRef,
    root: rootRef,
    labelItems,
    refreshVisibility: () => visibility.refreshVisibility(),
  });

  picking = createPicking({
    renderer: rendererRef,
    camera: cameraRef,
    root: rootRef,
    getMeshes: () => visibility.collectAllMeshes(),
    canPick: () => state.isExploded && !isFocusMode(),

    onHoverMesh: (m) => {
      visibility?.clearHoverDim?.();

      if (m) {
        setHoverMesh(m);
        visibility?.dimOthersForHover?.(m);
      } else {
        clearHover();
      }
    },

    onPickMesh: (m) => {
      const label = getNiceName(m);

      clearHover();
      visibility?.clearHoverDim?.();

      focusOnPart(m, label);
      emitFocusEvent(m, label);
    },
  });

  picking.setup();

  resetCtl?.scheduleSaveHomeView?.();

  resetSidebar();
  initComponentSidebar({
    modelTree,
    prettyFromNodeName,
    getNiceName,
    collectMeshesInSubtree,
    showOnlyMeshes: (set, ownerPath) => visibility.showOnlyMeshes(set, ownerPath),
    showAllParts: () => visibility.showAllParts(),
    focusOnPart,
    isFocusMode,
    exitFocusMode,
    setHoverMesh,
    clearHover,
    getActiveFilterOwnerPath: () => visibility.getActiveFilterOwnerPath(),

    isMeshHidden: (m) => visibility.isMeshHidden(m),
    toggleMeshHidden: (m) => visibility.toggleMeshHidden(m),
    setMeshesHidden: (arr, hidden) => visibility.setMeshesHidden(arr, hidden),
    refreshVisibility: () => visibility.refreshVisibility(),

    helpUrl: '/docs/help/3D_Model_User_Guide.pdf',

    onReset: async () => { await resetCtl?.resetEverything?.(); },
  });

  stopAnim();
  state.t = 0;
  state.isExploded = false;

  visibility.showAllParts();
  visibility?.clearHoverDim?.();
  clearHover();

  const nameEl = document.getElementById('model-name');
  if (nameEl) nameEl.textContent = name;
}

export { explodeMotor, implodeMotor, toggleExplode };
