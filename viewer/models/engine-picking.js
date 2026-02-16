/* ======================================================================
   ENGINE PICKING
====================================================================== */

import * as THREE from 'three';

/* ======================================================================
   HELPERS: MESH RESOLUTION
====================================================================== */

function isRenderablePart(o) {
  return !!o && (o.isMesh || o.isSkinnedMesh || o.isInstancedMesh);
}

function hasGoodName(n) {
  return (
    !!n &&
    n.trim() &&
    n !== 'Scene' &&
    n !== 'Scene_Collection' &&
    n !== 'RootNode' &&
    n !== 'NamedViews' &&
    n !== 'Layers'
  );
}

function findMeshUp(obj, stopRoot) {
  let o = obj;
  while (o && o !== stopRoot) {
    if (isRenderablePart(o)) return o;
    o = o.parent;
  }
  return null;
}

function findStableOwnerMesh(mesh, stopRoot) {
  if (!mesh) return null;

  let best = mesh;
  let p = mesh.parent;
  let depth = 0;

  while (p && p !== stopRoot && depth < 10) {
    if (isRenderablePart(p) && hasGoodName(p.name)) {
      best = p;
    }
    p = p.parent;
    depth++;
  }

  return best || mesh;
}

/* ======================================================================
   CONTROLLER: CREATE
====================================================================== */

export function createPicking({
  renderer,
  camera,
  root,
  getMeshes,
  canPick,
  onHoverMesh,
  onPickMesh,
}) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let bound = false;
  let onMove = null;
  let onDblClick = null;
  let onLeave = null;
  let lastHover = null;

  function emitHover(meshOrNull) {
    if (meshOrNull === lastHover) return;
    lastHover = meshOrNull;

    try {
      if (meshOrNull) {
        window.dispatchEvent(
          new CustomEvent('engine:hover', { detail: { mesh: meshOrNull } })
        );
      } else {
        window.dispatchEvent(new CustomEvent('engine:hoverclear'));
      }
    } catch (_) {}

    try {
      onHoverMesh?.(meshOrNull);
    } catch (_) {}
  }

  function getHitMeshFromEvent(event, dom) {
    const rect = dom.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(getMeshes?.() || [], true);
    if (!hits.length) return null;

    const hit = hits[0]?.object;
    const rawMesh = findMeshUp(hit, root);
    const stable = findStableOwnerMesh(rawMesh, root);

    if (!stable?.isMesh) return null;
    return stable;
  }

  /* ======================================================================
     LIFECYCLE: TEARDOWN
  ====================================================================== */

  function teardown() {
    if (!renderer || !bound) return;
    const dom = renderer.domElement;

    if (onMove) dom.removeEventListener('mousemove', onMove);
    if (onDblClick) dom.removeEventListener('dblclick', onDblClick);
    if (onLeave) dom.removeEventListener('mouseleave', onLeave);

    onMove = null;
    onDblClick = null;
    onLeave = null;
    bound = false;

    lastHover = null;
    emitHover(null);
  }

  /* ======================================================================
     LIFECYCLE: SETUP
  ====================================================================== */

  function setup() {
    if (!renderer || !camera) return;

    teardown();

    const dom = renderer.domElement;

    // Prevent browser double-tap zoom / selection quirks on some devices
    try {
      dom.style.touchAction = 'none';
    } catch (_) {}
    dom.addEventListener('dblclick', (e) => e.preventDefault());

    onMove = (event) => {
      if (!canPick?.()) return emitHover(null);

      const hitMesh = getHitMeshFromEvent(event, dom);
      if (!hitMesh) return emitHover(null);

      emitHover(hitMesh);
    };

    onLeave = () => {
      emitHover(null);
    };

    onDblClick = (event) => {
      if (!canPick?.()) return;

      const hitMesh = getHitMeshFromEvent(event, dom);
      if (!hitMesh) return;

      emitHover(null);
      onPickMesh?.(hitMesh);
    };

    dom.addEventListener('mousemove', onMove, { passive: true });
    dom.addEventListener('mouseleave', onLeave, { passive: true });
    dom.addEventListener('dblclick', onDblClick);

    bound = true;
  }

  /* ======================================================================
     PUBLIC API
  ====================================================================== */

  return { setup, teardown };
}
