/* ======================================================================
   ENGINE FOCUS (Engine 2.0)
   - Focus / isolate a selected engine part (mesh or group)
   - Smooth camera framing with GSAP (optional)
   - Info panel with part descriptions + optional PDF docs
====================================================================== */

import * as THREE from 'three';
const gsap = window.gsap || null;

/* ======================================================================
   GLOBAL REFERENCES
====================================================================== */

let cameraRef = null;
let controlsRef = null;
let rootRef = null;
let labelItemsRef = null;

let externalVisibilityRefresh = null;

let visibilityRef = null;

/* ======================================================================
   HELPERS: RENDERABLE SETS
====================================================================== */

function isRenderablePart(o) {
  return !!o && (o.isMesh || o.isSkinnedMesh || o.isInstancedMesh);
}

function getRenderableRoot(obj) {
  if (!obj) return obj;
  if (isRenderablePart(obj)) return obj;

  let p = obj.parent;
  while (p && p !== rootRef && !isRenderablePart(p)) p = p.parent;
  return isRenderablePart(p) ? p : obj;
}

function collectRenderableSubtree(rootObj) {
  const set = new Set();
  if (!rootObj) return set;

  rootObj.traverse((o) => {
    if (isRenderablePart(o)) set.add(o);
  });

  if (set.size === 0 && isRenderablePart(rootObj)) set.add(rootObj);
  return set;
}

/* ======================================================================
   FOCUS MODE STATE
====================================================================== */

let focusMode = false;
let focusedRoot = null;

const savedVisibility = new Map();
const savedLabelDisplay = new WeakMap();

const savedCamPos = new THREE.Vector3();
const savedCamTarget = new THREE.Vector3();

/* ======================================================================
   INFO PANEL ELEMENTS
====================================================================== */

let infoPanel = null;
let infoTitleEl = null;
let infoTextEl = null;
let infoCloseBtn = null;
let infoDocBtn = null;

/* ======================================================================
   PART DATA (Engine 2.0)
====================================================================== */

const PART_INFO = {
  'Main Block':
    'Primary engine block structure providing mounting surfaces and internal channels for lubrication and cooling.',
  'Engine Block':
    'Core engine block assembly. Typically houses cylinder bores and supports main rotating components.',
  'Engine Sub-block':
    'Secondary block structure supporting the main engine block assembly.',
  'Front & Rear Block':
    'Structural block elements at the front and rear, typically supporting pulleys, seals, and interface points.',
  'Surface Block':
    'Machined surface block area providing accurate mating faces and alignment.',
  'Main Interface':
    'Primary interface area for mating parts and mounting to adjacent assemblies.',

  'Engine Mounts':
    'Mounting system that supports the engine and helps reduce vibration transfer to the chassis or frame.',
  'Carrying Carrier':
    'Carrier structure used for supporting or transporting the engine assembly.',
  'Engine Screws':
    'Fasteners used throughout the engine assembly.',

  Exhaust:
    'Exhaust system routing combustion gases away from the engine. Designed for flow, noise control, and emissions.',
  'Exhaust Continuation':
    'Continuation section of the exhaust path, connecting major exhaust elements.',
  'Exhaust Filter':
    'Exhaust filtration component (e.g., DPF/catalyst section) designed to reduce emissions.',

  'Turbo System':
    'Turbocharger-related assemblies improving engine efficiency by compressing intake air.',
  'Turbo (Opposite Side)':
    'Turbo-related components located on the opposite side of the main turbo assembly.',
  'Turbo Additives':
    'Auxiliary turbo components or attachments used for routing, mounting, or support.',
  'Turbo Carriers':
    'Carrier/bracket elements supporting turbo assemblies.',
  'Turbo Filter':
    'Filtering component in the turbo / intake path.',
  'Turbo Hose':
    'Hose section for turbo / intake routing.',
  'Turbo Injection':
    'Injection-related components in the turbo / intake system.',
  'Turbo Intake Manifold':
    'Manifold routing intake air to engine cylinders, designed for flow distribution.',

  'Oil Lubricator':
    'Lubrication-related component supporting oil distribution and protection of moving parts.',
  'Oil System Parts':
    'Oil system components (routing, seals, supports) involved in lubrication.',
  'Fuel Drain':
    'Drain element used in the fuel system for controlled emptying or servicing.',
  'Fuel Supply':
    'Fuel supply routing and components that deliver fuel to the engine system.',

  Gear: 'Gear element involved in mechanical transmission of motion.',
  Reduction: 'Reduction assembly that modifies rotational speed and torque.',
  Lamella: 'Lamella / plate-like structural element used for spacing, filtering, or reinforcement.',
  'Load-bearing Columns':
    'Structural columns designed to carry loads and provide stability.',
  'Metal Covers':
    'Metal protective covers for shielding, safety, and cleanliness.',
  'Plastic Covers':
    'Plastic protective covers for shielding, safety, and cleanliness.',
  'Stainless Steel Parts':
    'Corrosion-resistant stainless steel components within the engine assembly.',
  'Metal Hoses':
    'Metal hose sections used for routing fluids or gases where higher durability is needed.',
  'Input Parts':
    'Input-side components and interfaces used for routing or assembly connections.',
  'Cylinder Intake / Import':
    'Cylinder intake-related group. Components associated with intake routing to cylinders.',

  'Engine Component': 'General engine component.',
};

const PART_DOCS = {
  'Engine Component': '/docs/help/3D_Model_User_Guide.pdf',
};

const RAW_TO_CANONICAL = {
  'Engine parts': 'Engine Parts',
  'Engine block': 'Engine Block',
  'Engine sub-block': 'Engine Sub-block',
  'Front and rear block': 'Front & Rear Block',
  'The main block': 'Main Block',
  Exhaust: 'Exhaust',
  'Exhaust continuation': 'Exhaust Continuation',
  'Exhaust filter': 'Exhaust Filter',
  'Group turbo parts': 'Turbo System',
  'The other side of the turbo': 'Turbo (Opposite Side)',
  'Turbo intake manifold': 'Turbo Intake Manifold',
  'Turbo injection': 'Turbo Injection',
  'Turbo hose': 'Turbo Hose',
  'Turbo filter': 'Turbo Filter',
  'Turbo carriers': 'Turbo Carriers',
  'Turbo additives': 'Turbo Additives',
  'Engine mounts': 'Engine Mounts',
  'Engine screws': 'Engine Screws',
  'Carrying carrier': 'Carrying Carrier',
  'Fuel drain': 'Fuel Drain',
  'Fuel supply': 'Fuel Supply',
  'Oil lubricator': 'Oil Lubricator',
  'Oil parts': 'Oil System Parts',
  Reduction: 'Reduction',
  Lamella: 'Lamella',
  'Load-bearing columns': 'Load-bearing Columns',
  'Main interface': 'Main Interface',
  'Surface block': 'Surface Block',
  'Metal covers': 'Metal Covers',
  'Plastic covers': 'Plastic Covers',
  'Stainless steel parts': 'Stainless Steel Parts',
  'Metal hoses': 'Metal Hoses',
  'Input parts': 'Input Parts',
  'Import of cylinders': 'Cylinder Intake / Import',
  Gear: 'Gear',
};

/* ======================================================================
   INDEXING & CANONICAL RESOLUTION
====================================================================== */

function normalizeKey(s) {
  return (s || '')
    .toString()
    .trim()
    .replace(/\s#\d+$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/[^\w\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const INFO_INDEX = new Map();
const DOC_INDEX = new Map();
let INDEX_READY = false;

function buildAutoIndex() {
  if (INDEX_READY) return;
  INDEX_READY = true;

  const add = (map, key, canonical) => {
    const nk = normalizeKey(key);
    if (!nk) return;
    if (!map.has(nk)) map.set(nk, canonical);
  };

  for (const k of Object.keys(PART_INFO)) add(INFO_INDEX, k, k);
  for (const k of Object.keys(PART_DOCS)) add(DOC_INDEX, k, k);

  for (const canonical of Object.keys(PART_INFO)) {
    add(INFO_INDEX, canonical.replace(/\b(the|a|an)\b/gi, '').trim(), canonical);
    add(INFO_INDEX, canonical.replace(/\s+/g, ' ').trim(), canonical);
  }

  for (const canonical of Object.keys(PART_DOCS)) {
    add(DOC_INDEX, canonical.replace(/\b(the|a|an)\b/gi, '').trim(), canonical);
  }

  for (const raw in RAW_TO_CANONICAL) add(INFO_INDEX, raw, RAW_TO_CANONICAL[raw]);
  for (const raw in RAW_TO_CANONICAL) add(DOC_INDEX, raw, RAW_TO_CANONICAL[raw]);
}

function getCandidates(labelText, meshOrObj) {
  const c = [];

  if (labelText) c.push(labelText);
  if (meshOrObj?.userData?.displayName) c.push(meshOrObj.userData.displayName);
  if (meshOrObj?.name) c.push(meshOrObj.name);

  let p = meshOrObj?.parent;
  let depth = 0;
  while (p && depth < 6) {
    if (p.userData?.displayName) c.push(p.userData.displayName);
    if (p.name) c.push(p.name);
    p = p.parent;
    depth++;
  }

  return c;
}

function resolveCanonicalKey(labelText, meshOrObj) {
  buildAutoIndex();

  const direct = (s) => (s && RAW_TO_CANONICAL[s] ? RAW_TO_CANONICAL[s] : null);

  const hitA = direct(labelText);
  if (hitA) return hitA;

  const hitB = direct(meshOrObj?.userData?.displayName);
  if (hitB) return hitB;

  const hitC = direct(meshOrObj?.name);
  if (hitC) return hitC;

  let p = meshOrObj?.parent;
  let depth = 0;
  while (p && depth < 6) {
    const hitP1 = direct(p.userData?.displayName);
    if (hitP1) return hitP1;
    const hitP2 = direct(p.name);
    if (hitP2) return hitP2;
    p = p.parent;
    depth++;
  }

  const candidates = getCandidates(labelText, meshOrObj);
  const normCandidates = candidates.map(normalizeKey).filter(Boolean);

  for (const nk of normCandidates) {
    if (INFO_INDEX.has(nk)) return INFO_INDEX.get(nk);
  }

  const canonKeys = Object.keys(PART_INFO);
  const canonNorm = canonKeys.map((k) => [k, normalizeKey(k)]);

  for (const cn of normCandidates) {
    for (const [k, kn] of canonNorm) {
      if (kn && cn.includes(kn)) return k;
    }
    for (const [k, kn] of canonNorm) {
      if (kn && kn.includes(cn)) return k;
    }
  }

  return 'Engine Component';
}

function resolveDocKey(canonicalKey) {
  buildAutoIndex();
  if (PART_DOCS[canonicalKey]) return canonicalKey;

  const nk = normalizeKey(canonicalKey);
  if (DOC_INDEX.has(nk)) return DOC_INDEX.get(nk);

  return 'Engine Component';
}

/* ======================================================================
   INFO PANEL
====================================================================== */

function ensureInfoPanel() {
  if (infoPanel) return infoPanel;

  const viewer = document.getElementById('viewer');
  if (!viewer) return null;

  const panel = document.createElement('div');
  panel.className = 'engine-info-panel';

  panel.innerHTML = `
    <div class="engine-info-inner">
      <div class="engine-info-main">
        <div class="engine-info-header">
          <div class="engine-info-title-wrap">
            <h4 class="engine-info-title"></h4>
          </div>

          <div class="engine-info-actions">
            <button class="engine-info-close" type="button" aria-label="Close">✕</button>

            <a class="engine-info-doc"
               id="engine-info-doc"
               href="#"
               target="_blank"
               rel="noopener noreferrer"
               title="Open PDF">
              <svg class="doc-icon" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </a>
          </div>
        </div>

        <p class="engine-info-text"></p>
      </div>
    </div>
  `;

  viewer.appendChild(panel);

  infoTitleEl = panel.querySelector('.engine-info-title');
  infoTextEl = panel.querySelector('.engine-info-text');
  infoCloseBtn = panel.querySelector('.engine-info-close');
  infoDocBtn = panel.querySelector('#engine-info-doc');

  infoCloseBtn?.addEventListener('click', () => exitFocusMode());

  if (infoDocBtn) infoDocBtn.style.display = 'none';
  panel.style.display = 'none';
  infoPanel = panel;

  return panel;
}

function showInfoPanel(labelText, meshOrObj) {
  const panel = ensureInfoPanel();
  if (!panel || !infoTitleEl || !infoTextEl) return;

  const title =
    (labelText && labelText.toString().trim()) ||
    meshOrObj?.userData?.displayName ||
    meshOrObj?.name ||
    'Component';

  const canonical = resolveCanonicalKey(labelText, meshOrObj);
  const description = PART_INFO[canonical] || PART_INFO['Engine Component'];

  const docKey = resolveDocKey(canonical);
  const pdfPath = PART_DOCS[docKey] || null;

  infoTitleEl.textContent = title;
  infoTextEl.textContent = description;

  if (infoDocBtn && pdfPath) {
    infoDocBtn.href = pdfPath;
    infoDocBtn.style.display = 'inline-flex';
  } else if (infoDocBtn) {
    infoDocBtn.style.display = 'none';
  }

  panel.style.display = 'block';

  if (canonical === 'Engine Component') {
    console.warn('[FOCUS MAP MISS]', {
      title,
      labelText,
      meshName: meshOrObj?.name,
      displayName: meshOrObj?.userData?.displayName,
      parentName: meshOrObj?.parent?.name,
    });
  }
}

function hideInfoPanel() {
  if (!infoPanel) return;
  infoPanel.style.display = 'none';
  if (infoDocBtn) infoDocBtn.style.display = 'none';
}

/* ======================================================================
   INIT / PUBLIC FLAGS
====================================================================== */

export function initFocus({ camera, controls, root, labelItems, refreshVisibility, visibility = null }) {
  cameraRef = camera || null;
  controlsRef = controls || null;
  rootRef = root || null;
  labelItemsRef = labelItems || null;

  externalVisibilityRefresh = typeof refreshVisibility === 'function' ? refreshVisibility : null;
  visibilityRef = visibility || null;
}

export function isFocusMode() {
  return focusMode;
}

export function getFocusedRoot() {
  return focusedRoot;
}

/* ======================================================================
   CAMERA FRAMING
====================================================================== */

function computeFramedCameraPosition(targetObj) {
  const box = new THREE.Box3().setFromObject(targetObj);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const safeDim = Math.max(maxDim, 0.25);

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const radius = Math.max(sphere.radius, safeDim * 0.5);

  const fov = (cameraRef.fov * Math.PI) / 180;
  const fit = radius / Math.tan(fov / 2);

  const distance = Math.max(fit * 1.25, 0.8);

  const dir = new THREE.Vector3()
    .subVectors(cameraRef.position, controlsRef.target)
    .normalize();

  if (!Number.isFinite(dir.x + dir.y + dir.z) || dir.lengthSq() < 1e-6) {
    dir.set(2.5, 1.5, 2.5).normalize();
  }

  const newPos = center.clone().add(dir.multiplyScalar(distance));
  return { center, newPos };
}

/* ======================================================================
   FOCUS
====================================================================== */

export function focusOnPart(meshOrObj, labelText) {
  if (!cameraRef || !controlsRef || !rootRef) return;
  if (!meshOrObj) return;

  visibilityRef?.clearHoverUX?.();

  const targetRoot = getRenderableRoot(meshOrObj);
  if (focusedRoot === targetRoot) return;

  if (focusMode && focusedRoot && focusedRoot !== targetRoot) {
    if (gsap) {
      gsap.killTweensOf(cameraRef.position);
      gsap.killTweensOf(controlsRef.target);
    }
    hideInfoPanel();
  }

  if (!focusedRoot) {
    savedVisibility.clear();
    rootRef.traverse((o) => {
      if (isRenderablePart(o)) savedVisibility.set(o, o.visible);
    });

    savedCamPos.copy(cameraRef.position);
    savedCamTarget.copy(controlsRef.target);

    if (Array.isArray(labelItemsRef)) {
      labelItemsRef.forEach((item) => {
        if (item?.el && !savedLabelDisplay.has(item.el)) {
          savedLabelDisplay.set(item.el, item.el.style.display);
        }
      });
    }
  }

  focusedRoot = targetRoot;
  focusMode = true;

  if (Array.isArray(labelItemsRef)) {
    labelItemsRef.forEach((item) => {
      if (item?.el) item.el.style.display = 'none';
    });
  }

  const allowed = collectRenderableSubtree(targetRoot);
  rootRef.traverse((o) => {
    if (!isRenderablePart(o)) return;
    o.visible = allowed.has(o);
  });

  const { center, newPos } = computeFramedCameraPosition(targetRoot);
  const duration = 0.8;

  if (gsap) {
    gsap.killTweensOf(cameraRef.position);
    gsap.killTweensOf(controlsRef.target);

    gsap.to(cameraRef.position, {
      duration,
      x: newPos.x,
      y: newPos.y,
      z: newPos.z,
      ease: 'power2.out',
      onUpdate: () => controlsRef.update(),
    });

    gsap.to(controlsRef.target, {
      duration,
      x: center.x,
      y: center.y,
      z: center.z,
      ease: 'power2.out',
      onUpdate: () => controlsRef.update(),
    });
  } else {
    cameraRef.position.copy(newPos);
    controlsRef.target.copy(center);
    controlsRef.update();
  }

  const autoLabel =
    (labelText && labelText.toString().trim()) ||
    meshOrObj?.userData?.displayName ||
    targetRoot?.userData?.displayName ||
    meshOrObj?.name ||
    '';

  if (meshOrObj?.uuid) {
    window.dispatchEvent(
      new CustomEvent('engine:focus', {
        detail: { uuid: meshOrObj.uuid, label: autoLabel },
      })
    );
  }

  showInfoPanel(autoLabel, meshOrObj);
}

/* ======================================================================
   EXIT FOCUS
====================================================================== */

export function exitFocusMode() {
  visibilityRef?.clearHoverUX?.();

  if (!cameraRef || !controlsRef || !rootRef) {
    hideInfoPanel();
    focusedRoot = null;
    focusMode = false;
    return;
  }

  if (!focusedRoot) {
    hideInfoPanel();
    focusMode = false;
    return;
  }

  rootRef.traverse((o) => {
    if (!isRenderablePart(o)) return;
    if (savedVisibility.has(o)) o.visible = savedVisibility.get(o);
  });

  focusedRoot = null;
  focusMode = false;
  hideInfoPanel();

  if (Array.isArray(labelItemsRef)) {
    labelItemsRef.forEach((item) => {
      if (!item?.el) return;
      const prev = savedLabelDisplay.get(item.el);
      item.el.style.display = prev ?? '';
    });
  }

  externalVisibilityRefresh?.();

  const duration = 0.8;

  if (gsap) {
    gsap.killTweensOf(cameraRef.position);
    gsap.killTweensOf(controlsRef.target);

    gsap.to(cameraRef.position, {
      duration,
      x: savedCamPos.x,
      y: savedCamPos.y,
      z: savedCamPos.z,
      ease: 'power2.out',
      onUpdate: () => controlsRef.update(),
    });

    gsap.to(controlsRef.target, {
      duration,
      x: savedCamTarget.x,
      y: savedCamTarget.y,
      z: savedCamTarget.z,
      ease: 'power2.out',
      onUpdate: () => controlsRef.update(),
    });
  } else {
    cameraRef.position.copy(savedCamPos);
    controlsRef.target.copy(savedCamTarget);
    controlsRef.update();
  }
}
