import * as THREE from 'three';

export const labelItems = [];

let labelLayer = null;
let labelRAF = null;

let hoverEl = null;
let hoverMesh = null;
let hoverNice = '';

const hoverAnchorCache = new WeakMap();

function createTooltip(el, text) {
}

function ensureLayer(containerRef) {
  if (labelLayer) return labelLayer;
  if (!containerRef) return null;

  const host = containerRef.parentElement || containerRef;

  if (!host.style.position || host.style.position === 'static') {
    host.style.position = 'relative';
  }

  const layer = document.createElement('div');
  layer.className = 'engine-label-layer';

  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '30',
  });

  host.appendChild(layer);
  labelLayer = layer;

  return layer;
}

/* =========================================================
   OUTWARD PUSH (isti kao kod tebe, samo za hover label)
   ========================================================= */
const OUTWARD_PUSH = {
  'Marinetek pontoons': 0.15,
  'TIK 1': 0.25,
  'TIK 2': 0.10,
};

function getPushAmount(meshName = '', niceName = '') {
  const name = (meshName || '').toLowerCase();
  const nice = (niceName || '').toLowerCase();

  const matchKey = (k) =>
    name === k.toLowerCase() ||
    name.startsWith(k.toLowerCase() + '.') ||
    nice === k.toLowerCase() ||
    nice.startsWith(k.toLowerCase() + ' ');

  if (matchKey('Marinetek pontoons')) return OUTWARD_PUSH['Marinetek pontoons'];
  if (matchKey('TIK 1')) return OUTWARD_PUSH['TIK 1'];
  if (matchKey('TIK 2')) return OUTWARD_PUSH['TIK 2'];
  return 0;
}

/* =========================================================
   HOVER LISTENERS (picking -> labels)
   ========================================================= */
function bindHoverEvents(deps) {
  const { getNiceName, isFocusMode, state } = deps;

  window.removeEventListener('engine:hover', bindHoverEvents._onHover);
  window.removeEventListener('engine:hoverclear', bindHoverEvents._onClear);
  window.removeEventListener('engine:explode', bindHoverEvents._onExplode);

  bindHoverEvents._onHover = (e) => {
    if (!state?.isExploded) return;
    if (isFocusMode?.()) return;

    const mesh = e?.detail?.mesh;
    if (!mesh || !mesh.isMesh) return;

    hoverMesh = mesh;
    hoverNice = getNiceName?.(mesh) || mesh.name || '';
    if (!hoverNice) hoverNice = 'Component';

    if (hoverEl) {
      hoverEl.textContent = hoverNice;
      hoverEl.style.opacity = '1';
    }
  };

  bindHoverEvents._onClear = () => {
    hoverMesh = null;
    hoverNice = '';
    if (hoverEl) hoverEl.style.opacity = '0';
  };

  bindHoverEvents._onExplode = (e) => {
    const active = !!e?.detail?.active;
    if (!active) {
      hoverMesh = null;
      hoverNice = '';
      if (hoverEl) hoverEl.style.opacity = '0';
    }
  };

  window.addEventListener('engine:hover', bindHoverEvents._onHover);
  window.addEventListener('engine:hoverclear', bindHoverEvents._onClear);
  window.addEventListener('engine:explode', bindHoverEvents._onExplode);
}

/* =========================================================
   MAIN
   ========================================================= */
export function setupLabels(root, deps) {
  const {
    cameraRef,
    containerRef,
    state,
    getNiceName,
    isFocusMode,
  } = deps;

  const layer = ensureLayer(containerRef);
  if (!layer || !cameraRef || !containerRef || !root) return;

  labelItems.forEach((i) => i.el?.remove?.());
  labelItems.length = 0;

  if (!hoverEl) {
    hoverEl = document.createElement('div');
    hoverEl.className = 'engine-label engine-label--hover';

    Object.assign(hoverEl.style, {
      position: 'absolute',
      transform: 'translate(-50%, -50%)',
      opacity: 0,
      pointerEvents: 'none',
      left: '0px',
      top: '0px',
      whiteSpace: 'nowrap',
    });

    layer.appendChild(hoverEl);
  }

  const rootBox = new THREE.Box3().setFromObject(root);
  const rootCenter = rootBox.getCenter(new THREE.Vector3());

  bindHoverEvents({ ...deps, state });

  if (!labelRAF) {
    const update = () => {
      labelRAF = requestAnimationFrame(update);

      const w = containerRef.clientWidth || 0;
      const h = containerRef.clientHeight || 0;

      if (w < 2 || h < 2) {
        if (hoverEl) hoverEl.style.opacity = '0';
        return;
      }

      if (isFocusMode?.() || !state?.isExploded) {
        if (hoverEl) hoverEl.style.opacity = '0';
        return;
      }

      if (!hoverMesh || !hoverMesh.visible) {
        if (hoverEl) hoverEl.style.opacity = '0';
        return;
      }

      let cached = hoverAnchorCache.get(hoverMesh);
      if (!cached) {
        const box = new THREE.Box3().setFromObject(hoverMesh);
        const centerWorld = box.getCenter(new THREE.Vector3());
        const anchorLocal = hoverMesh.worldToLocal(centerWorld.clone());
        const push = getPushAmount(hoverMesh.name, hoverNice || getNiceName?.(hoverMesh) || '');
        cached = { anchorLocal, push };
        hoverAnchorCache.set(hoverMesh, cached);
      }

      const worldCenter = hoverMesh.localToWorld(cached.anchorLocal.clone());

      if (cached.push > 0) {
        const dir = worldCenter.clone().sub(rootCenter);
        if (dir.lengthSq() > 1e-8) {
          dir.normalize();
          worldCenter.addScaledVector(dir, cached.push);
        }
      }

      const ndc = worldCenter.clone().project(cameraRef);

      const invalid =
        !Number.isFinite(ndc.x) ||
        !Number.isFinite(ndc.y) ||
        !Number.isFinite(ndc.z) ||
        ndc.z > 1 ||
        ndc.z < -1 ||
        ndc.x < -1 ||
        ndc.x > 1 ||
        ndc.y < -1 ||
        ndc.y > 1;

      if (invalid) {
        hoverEl.style.opacity = '0';
        return;
      }

      const x = (ndc.x * 0.5 + 0.5) * w;
      const y = (-ndc.y * 0.5 + 0.5) * h;

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        hoverEl.style.opacity = '0';
        return;
      }

      const pad = 10;
      const cx = Math.min(w - pad, Math.max(pad, x));
      const cy = Math.min(h - pad, Math.max(pad, y));

      hoverEl.style.left = `${cx}px`;
      hoverEl.style.top = `${cy}px`;

      if (!hoverEl.textContent) hoverEl.textContent = hoverNice || 'Component';

      hoverEl.style.opacity = '1';
    };

    requestAnimationFrame(update);
  }
}
