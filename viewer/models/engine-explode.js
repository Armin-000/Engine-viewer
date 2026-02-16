import * as THREE from 'three';

/* =========================
   STATE
   ========================= */
export const state = {
  parts: [],
  isExploded: false,
  targetExploded: false,
  playing: false,
  dir: 1,
  t: 0,
  duration: 1.8,
  raf: null,
};

/* =========================
   TUNING (SENIOR DEFAULTS)
   ========================= */
const SETTINGS = {
  // koliko ukupno "otvori" explode (kao % dijagonale modela)
  maxExplodeFrac: 0.28,      // 0.18..0.35 tipično
  minExplodeFrac: 0.06,      // da se i mali dijelovi pomaknu

  // kako snažno "unutarnji" dijelovi idu van
  interiorBoost: 0.65,       // 0..1

  // koliko ovisi o veličini dijela
  sizeBoost: 0.45,           // 0..1

  // dodatni mali "lift" (da izgleda urednije)
  liftFrac: 0.04,            // 0..0.08

  // 2-step animacija
  midRatio: 0.55,

  // ignoriraj premale mesh-eve (šarafići koji trepere)
  minRadiusFrac: 0.002,      // radius < diag*minRadiusFrac => skip

  // anti-touch separation (ako želiš “ne sudaraju se”)
  separation: {
    enabled: true,
    iters: 10,
    sepFactor: 1.10,
    strength: 0.9,
    extraMaxFrac: 0.18,      // max dodatni push (kao % dijagonale)
    gapFrac: 0.006,          // minimalan gap (kao % dijagonale)
  },
};

/* =========================
   EASING
   ========================= */
function smoothstep(x) {
  return x * x * (3 - 2 * x);
}

/* =========================
   STOP
   ========================= */
export function stopAnim() {
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
  state.playing = false;
}

/* =========================
   HELPERS
   ========================= */
function isRenderable(o) {
  return !!(o && (o.isMesh || o.isSkinnedMesh || o.isInstancedMesh));
}

function safeNorm(v, fallback = new THREE.Vector3(1, 0, 0)) {
  const lsq = v.lengthSq();
  if (lsq < 1e-12) return fallback.clone();
  return v.multiplyScalar(1 / Math.sqrt(lsq));
}

/**
 * “Senior-ish” smjer:
 * - uzmi radial smjer (partCenter - modelCenter)
 * - stabiliziraj ga na glavne osi modela (bbox osi): x,y,z
 * - biraj onu os gdje je projekcija najveća (ali zadrži predznak)
 */
function stabilizedDir(radial, axes) {
  // axes: { x:Vector3, y:Vector3, z:Vector3 } (world normalized)
  const r = radial;
  const dx = r.dot(axes.x);
  const dy = r.dot(axes.y);
  const dz = r.dot(axes.z);

  const adx = Math.abs(dx), ady = Math.abs(dy), adz = Math.abs(dz);

  if (adx >= ady && adx >= adz) return axes.x.clone().multiplyScalar(Math.sign(dx) || 1);
  if (ady >= adx && ady >= adz) return axes.y.clone().multiplyScalar(Math.sign(dy) || 1);
  return axes.z.clone().multiplyScalar(Math.sign(dz) || 1);
}

/* =========================
   PREPARE (NO IDS / NO NAMES)
   =========================
   Signature kompatibilan s tvojim engine.js:
   prepareExplode(rootRef, { getNiceName }) -> drugi argument ignoriramo.
*/
export function prepareExplode(model) {
  state.parts.length = 0;
  if (!model) return;

  model.updateWorldMatrix(true, true);

  const modelBox = new THREE.Box3().setFromObject(model);
  const modelSize = new THREE.Vector3();
  const modelCenterW = new THREE.Vector3();
  modelBox.getSize(modelSize);
  modelBox.getCenter(modelCenterW);

  const diag = modelSize.length();
  if (diag < 1e-9) return;

  const min = modelBox.min;
  const max = modelBox.max;

  // ====== TUNING (ravnomjerno)
  const LAYERS = 4;                 // 3-5 je sweet spot
  const BASE = 0.10 * diag;         // svi se odvoje malo
  const STEP = 0.09 * diag;         // korak po layeru (ravnomjerno)
  const Y_EXTRA = 0.06 * diag;      // dodatno za gore/dolje (service look)
  const MID_RATIO = 0.55;

  // Ako želiš da su sve osi IDENTIČNE (total symmetry), stavi Y_EXTRA = 0

  const meshes = [];
  model.traverse(o => {
    if (o && (o.isMesh || o.isSkinnedMesh || o.isInstancedMesh)) meshes.push(o);
  });
  if (!meshes.length) return;

  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centerW = new THREE.Vector3();
  const startW = new THREE.Vector3();

  for (const obj of meshes) {
    const parent = obj.parent;
    if (!parent) continue;

    obj.matrixAutoUpdate = true;

    box.setFromObject(obj);
    box.getSize(size);
    box.getCenter(centerW);
    obj.getWorldPosition(startW);

    // Normalizirano u -1..1 po svakoj osi (relativno na bbox)
    const nx = (centerW.x - min.x) / ((max.x - min.x) || 1);
    const ny = (centerW.y - min.y) / ((max.y - min.y) || 1);
    const nz = (centerW.z - min.z) / ((max.z - min.z) || 1);

    const sx = nx * 2 - 1;   // -1..1
    const sy = ny * 2 - 1;
    const sz = nz * 2 - 1;

    // 1) ODABERI DOMINANTNU OS (snap na 6 smjerova)
    const ax = Math.abs(sx), ay = Math.abs(sy), az = Math.abs(sz);

    const dir = new THREE.Vector3();
    let dom = 'x';
    let sign = Math.sign(sx) || 1;

    if (ay >= ax && ay >= az) { dom = 'y'; sign = Math.sign(sy) || 1; }
    else if (az >= ax && az >= ay) { dom = 'z'; sign = Math.sign(sz) || 1; }

    if (dom === 'x') dir.set(sign, 0, 0);
    if (dom === 'y') dir.set(0, sign, 0);
    if (dom === 'z') dir.set(0, 0, sign);

    // 2) LAYER INDEX (ravnomjerno po udaljenosti od centra na dominantnoj osi)
    const domAbs = dom === 'x' ? ax : (dom === 'y' ? ay : az); // 0..1
    // map 0..1 -> 0..LAYERS-1
    const layerIdx = Math.min(LAYERS - 1, Math.floor(domAbs * LAYERS));

    // 3) DISTANCA (ravnomjerni koraci)
    let dist = BASE + layerIdx * STEP;

    // opcionalno: gore/dolje malo više (izgleda “service”)
    if (dom === 'y') dist += Y_EXTRA;

    const deltaW = dir.multiplyScalar(dist);

    // target center
    const targetCenterW = centerW.clone().add(deltaW);

    // pretvori iz “pomak centra” u “pomak objekta”
    const deltaCenterW = targetCenterW.clone().sub(centerW);

    const finalW = startW.clone().add(deltaCenterW);
    const midW = startW.clone().add(deltaCenterW.clone().multiplyScalar(MID_RATIO));

    const finalPos = parent.worldToLocal(finalW.clone());
    const midPos = parent.worldToLocal(midW.clone());

    state.parts.push({
      obj,
      startPos: obj.position.clone(),
      midPos,
      finalPos,
    });
  }

  state.t = 0;
  state.isExploded = false;
  state.targetExploded = false;
  state.playing = false;

  try {
    window.dispatchEvent(new CustomEvent('engine:explode', { detail: { active: false } }));
  } catch (_) {}
}

/* =========================
   UPDATE
   ========================= */
function updateExplode(dt) {
  if (!state.playing || !state.parts.length) return;

  state.t = THREE.MathUtils.clamp(
    state.t + (dt / state.duration) * state.dir,
    0,
    1
  );

  const t = state.t;

  for (const p of state.parts) {
    if (t <= 0.5) {
      const k = smoothstep(t * 2);
      p.obj.position.lerpVectors(p.startPos, p.midPos, k);
    } else {
      const k = smoothstep((t - 0.5) * 2);
      p.obj.position.lerpVectors(p.midPos, p.finalPos, k);
    }
  }

  if (t === 0 || t === 1) {
    state.playing = false;
    state.isExploded = (t === 1);
    state.targetExploded = state.isExploded;

    try {
      window.dispatchEvent(new CustomEvent('engine:explode', { detail: { active: state.isExploded } }));
    } catch (_) {}
  }
}

/* =========================
   LOOP
   ========================= */
function playExplode(forward = true) {
  if (!state.parts.length) {
    state.playing = false;
    state.targetExploded = state.isExploded;
    stopAnim();
    return false;
  }

  state.dir = forward ? 1 : -1;
  state.playing = true;

  if (state.raf) {
    cancelAnimationFrame(state.raf);
    state.raf = null;
  }

  let last = performance.now();

  const loop = (now) => {
    const dt = (now - last) / 1000;
    last = now;

    updateExplode(dt);

    if (state.playing) state.raf = requestAnimationFrame(loop);
    else state.raf = null;
  };

  state.raf = requestAnimationFrame(loop);
  return true;
}

/* =========================
   PUBLIC API
   ========================= */
export function explodeMotor() {
  state.targetExploded = true;

  if (state.playing) {
    state.dir = 1;
    return state.targetExploded;
  }

  const started = playExplode(true);
  if (!started) state.targetExploded = state.isExploded;
  return state.targetExploded;
}

export function implodeMotor() {
  state.targetExploded = false;

  if (state.playing) {
    state.dir = -1;
    return state.targetExploded;
  }

  const started = playExplode(false);
  if (!started) state.targetExploded = state.isExploded;
  return state.targetExploded;
}

export function toggleExplode() {
  return state.targetExploded ? implodeMotor() : explodeMotor();
}
