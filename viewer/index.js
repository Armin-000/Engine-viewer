import * as THREE from 'three';
import { createViewer } from './core.js';
import { initPreloader, showPreloader, hidePreloader } from './preloader.js';

const gsap = window.gsap || null;

/* =========================================================
   DOM
========================================================= */

const viewerWrap = document.getElementById('viewer');
const container  = document.getElementById('three');
const loadingEl  = document.getElementById('loadingOverlay');

const select     = document.getElementById('modelPicker');
const seg        = document.getElementById('modelSeg');

const zoomInBtn  = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const btnPrev    = document.getElementById('modelPrev');
const btnNext    = document.getElementById('modelNext');

const explodeBtn = document.getElementById('explodeBtn');

const themeToggle   = document.getElementById('themeToggle');
const themeMenu     = document.getElementById('themeMenu');
const themeDropdown = document.getElementById('themeDropdown');

const rotateMenu     = document.getElementById('rotateMenu');
const rotateToggle   = document.getElementById('rotateToggle');
const rotateDropdown = document.getElementById('rotateDropdown');

const rotButtons = document.querySelectorAll('.rot-btn');

/* =========================================================
   PRELOADER
========================================================= */

if (loadingEl) {
  await initPreloader({
    overlayId: 'loadingOverlay',
    fragmentUrl: new URL('./preloader.html', import.meta.url),
  });
}

let loadToken = 0;
let loadingNow = false;

function setLoading(isLoading) {
  if (isLoading) showPreloader();
  else hidePreloader();
  viewerWrap?.setAttribute('data-loading', isLoading ? '1' : '0');
}

/* =========================================================
   VIEWER
========================================================= */

const viewer = createViewer(container, {
  disableWheelZoom: false,
  disablePinchZoom: false,
  zoomToCursor: true,
});

const canvasEl = viewer.renderer.domElement;
Object.assign(canvasEl.style, {
  visibility: 'hidden',
  opacity: '0',
  transition: 'opacity .35s ease',
});

/* =========================================================
   ROTATION SNAP CAMERA
========================================================= */

function rotateCamera(direction) {
  if (!viewer?.controls || !viewer?.camera) return;

  const controls = viewer.controls;
  const camera = viewer.camera;
  const target = controls.target.clone();

  const offset = camera.position.clone().sub(target);
  const spherical = new THREE.Spherical().setFromVector3(offset);

  const eps = 0.05;
  const dist = spherical.radius;

  const snap90 = (theta) => {
    const step = Math.PI / 2;
    return Math.round(theta / step) * step;
  };

  let theta = spherical.theta;
  let phi = spherical.phi;

  if (direction === 'left' || direction === 'right') {
    const base = snap90(theta);
    theta = base + (direction === 'left' ? (Math.PI / 2) : -(Math.PI / 2));
    phi = Math.PI / 2;
  }

  if (direction === 'down') {
    phi = eps;
    theta = snap90(theta);
  }

  if (direction === 'up') {
    phi = Math.PI - eps;
    theta = snap90(theta);
  }

  const nextOffset = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(dist, phi, theta)
  );

  const nextPos = target.clone().add(nextOffset);

  if (gsap) {
    gsap.to(camera.position, {
      duration: 0.6,
      x: nextPos.x,
      y: nextPos.y,
      z: nextPos.z,
      ease: 'power2.inOut',
      onUpdate: () => controls.update(),
    });
  } else {
    camera.position.copy(nextPos);
    controls.update();
  }
}

rotButtons?.forEach(btn => {
  btn.addEventListener('click', () => {
    if (loadingNow) return;
    rotateCamera(btn.dataset.rot);
  });
});

/* =========================================================
   THEME (LIGHT / DARK ONLY)
========================================================= */

function getTheme() {
  return localStorage.getItem('theme') || 'dark';
}

function applyTheme(mode) {
  const isLight = mode === 'light';
  document.body.classList.toggle('theme-light', isLight);
  viewer?.setMode?.(mode);
}

function markActiveTheme(mode) {
  if (!themeDropdown) return;
  themeDropdown.querySelectorAll('.theme-item').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.theme === mode);
  });
}

(function initThemeDropdown() {
  const saved = getTheme();
  applyTheme(saved);
  markActiveTheme(saved);

  if (!themeToggle || !themeMenu || !themeDropdown) return;

  if (!themeMenu.hasAttribute('data-open')) themeMenu.setAttribute('data-open', '0');

  themeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const open = themeMenu.getAttribute('data-open') === '1';
    themeMenu.setAttribute('data-open', open ? '0' : '1');
    themeToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  themeDropdown.querySelectorAll('.theme-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.theme;
      localStorage.setItem('theme', mode);
      applyTheme(mode);
      markActiveTheme(mode);
      themeMenu.setAttribute('data-open', '0');
      themeToggle.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (themeMenu.getAttribute('data-open') !== '1') return;
      if (e.target.closest('#themeMenu')) return;
      themeMenu.setAttribute('data-open', '0');
      themeToggle.setAttribute('aria-expanded', 'false');
    },
    { capture: true }
  );
})();

(function initRotateDropdown() {
  if (!rotateMenu || !rotateToggle || !rotateDropdown) return;

  if (!rotateMenu.hasAttribute('data-open')) rotateMenu.setAttribute('data-open', '0');

  rotateToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const open = rotateMenu.getAttribute('data-open') === '1';
    rotateMenu.setAttribute('data-open', open ? '0' : '1');
    rotateToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
  });

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (rotateMenu.getAttribute('data-open') !== '1') return;
      if (e.target.closest('#rotateMenu')) return;
      rotateMenu.setAttribute('data-open', '0');
      rotateToggle.setAttribute('aria-expanded', 'false');
    },
    { capture: true }
  );
})();

/* =========================================================
   MODELS
========================================================= */

const MODEL_REGISTRY = {
  engine: () => import('./models/engine.js'),
};

const orderedModels = select
  ? Array.from(select.options).map(o => o.value)
  : ['engine'];

let explodeApi = null;
let exploded = false;

function setExplodeEnabled(enabled, label = 'Explode') {
  if (!explodeBtn) return;
  explodeBtn.style.display = enabled ? 'block' : 'none';
  explodeBtn.disabled = !enabled;
  if (enabled) explodeBtn.textContent = label;
}

function toggleExplode() {
  if (loadingNow || !explodeApi) return;

  try {
    if (typeof explodeApi.toggle === 'function') {
      exploded = explodeApi.toggle();
    } else if (!exploded && explodeApi.explode) {
      explodeApi.explode();
      exploded = true;
    } else if (exploded && explodeApi.implode) {
      explodeApi.implode();
      exploded = false;
    }

    explodeBtn.textContent = exploded ? 'Assemble' : 'Explode';
  } catch (e) {
    console.warn('[explode] error:', e);
  }
}

explodeBtn?.addEventListener('click', toggleExplode);

/* =========================================================
   LOAD MODEL
========================================================= */

async function loadById(id) {
  const myToken = ++loadToken;
  loadingNow = true;

  explodeApi = null;
  exploded = false;
  setExplodeEnabled(false);

  const loadFn = MODEL_REGISTRY[id];
  if (!loadFn) return;

  try {
    setLoading(true);

    canvasEl.style.visibility = 'hidden';
    canvasEl.style.opacity = '0';

    const mod = await loadFn();
    if (myToken !== loadToken) return;

    await viewer.loadModelModule(mod);
    if (myToken !== loadToken) return;

    if (explodeBtn && id === 'engine') {
      explodeApi = {
        toggle:  mod.toggleExplode || null,
        explode: mod.explodeMotor || mod.explode || null,
        implode: mod.implodeMotor || mod.implode || null,
      };

      const ok = !!(explodeApi.toggle || explodeApi.explode || explodeApi.implode);
      setExplodeEnabled(ok);
    }

    await new Promise(r => requestAnimationFrame(r));
    canvasEl.style.visibility = 'visible';
    canvasEl.style.opacity = '1';
  } catch (err) {
    console.error('[viewer] load error:', err);
  } finally {
    if (myToken === loadToken) {
      setLoading(false);
      loadingNow = false;
    }
  }
}

/* =========================================================
   INIT
========================================================= */

const initialId = (select && select.value) || orderedModels[0] || 'engine';
await loadById(initialId);

select?.addEventListener('change', async (e) => {
  await loadById(e.target.value);
});
