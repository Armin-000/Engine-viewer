import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

const CAMERA_DIR = new THREE.Vector3(5, 0.1, 7).normalize();

function disposeObject3D(obj) {
  obj?.traverse((child) => {
    if (!child.isMesh) return;

    child.geometry?.dispose?.();

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((m) => {
      if (!m) return;

      ['map', 'normalMap', 'metalnessMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'alphaMap'].forEach(
        (key) => m[key]?.dispose?.()
      );

      m.dispose?.();
    });
  });
}

export function createViewer(containerEl, opts = {}) {
  const {
    disableWheelZoom = true,
    disablePinchZoom = false,
    zoomToCursor = false,
    initialMode = 'dark',
  } = opts;

  const scene = new THREE.Scene();

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });

  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.physicallyCorrectLights = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  containerEl.appendChild(renderer.domElement);

  Object.assign(renderer.domElement.style, {
    visibility: 'hidden',
    opacity: '0',
    transition: 'opacity .35s ease',
  });

  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 1e9);
  camera.position.set(2.8, 2.2, 3.8);

  scene.userData.camera = camera;
  scene.userData.renderer = renderer;

  const hemi = new THREE.HemisphereLight(0xffffff, 0x202030, 0.5);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 8, 5);
  dir.castShadow = true;
  scene.add(dir);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1, 0);
  controls.zoomToCursor = zoomToCursor;

  if (disableWheelZoom) {
    controls.enableZoom = false;
    controls.zoomSpeed = 0;
    controls.zoomToCursor = false;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: null,
      RIGHT: THREE.MOUSE.PAN,
    };
  }

  if (disablePinchZoom) {
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.PAN };
    renderer.domElement.style.touchAction = 'pan-x pan-y';
  }

  const loadingManager = new THREE.LoadingManager();
  let resolveReady;
  const readyOnce = new Promise((res) => (resolveReady = res));
  loadingManager.onLoad = () => resolveReady?.();
  loadingManager.onError = () => resolveReady?.();

  const root = new THREE.Group();
  scene.add(root);

  let current = null;
  let currentDispose = null;

  function refreshMaterials() {
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m) m.needsUpdate = true;
      });
    });
  }

  // --- MODE (only light/dark) ---
  let currentMode = initialMode;

  function setMode(mode) {
    currentMode = mode;

    // background stays transparent (alpha renderer)
    scene.background = null;

    if (mode === 'light') {
      hemi.intensity = 0.65;
      dir.intensity = 1.3;
    } else {
      // default: dark
      hemi.intensity = 0.25;
      dir.intensity = 0.65;
    }

    refreshMaterials();
  }

  // --- ENV (HDRI for reflections only) ---
  const pmremGen = new THREE.PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader();

  const rgbe = new RGBELoader(loadingManager).setDataType(THREE.HalfFloatType);

  const hdriList = [
    `${import.meta.env.BASE_URL}hdr/sunflowers_puresky_4k.hdr`,
  ];

  let envApplied = false;
  let envMap = null;

  (function loadEnv(i = 0) {
    if (envApplied) return;

    if (i >= hdriList.length) {
      try { pmremGen.dispose(); } catch (_) {}
      setMode(currentMode);
      return;
    }

    const url = hdriList[i];

    rgbe.load(
      url,
      (hdrTex) => {
        if (!hdrTex || !hdrTex.image) {
          try { hdrTex?.dispose?.(); } catch (_) {}
          loadEnv(i + 1);
          return;
        }

        try {
          envMap = pmremGen.fromEquirectangular(hdrTex).texture;
          try { hdrTex.dispose(); } catch (_) {}

          scene.environment = envMap; // apply once, always
          envApplied = true;

          try { pmremGen.dispose(); } catch (_) {}

          setMode(currentMode);
        } catch (_) {
          try { hdrTex?.dispose?.(); } catch (__) {}
          loadEnv(i + 1);
        }
      },
      undefined,
      () => loadEnv(i + 1)
    );
  })();

  const loader = new GLTFLoader(loadingManager);
  const draco = new DRACOLoader(loadingManager);
  draco.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  loader.setDRACOLoader(draco);

  const tickHandlers = new Set();

  function onTick(fn) {
    if (typeof fn !== 'function') return () => {};
    tickHandlers.add(fn);
    return () => tickHandlers.delete(fn);
  }

  function resize() {
    const w = containerEl.clientWidth || 1;
    const h = containerEl.clientHeight || 1;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);

    let dpr = window.devicePixelRatio || 1;
    if (w < 600) dpr = Math.min(dpr, 1.4);
    else if (w < 900) dpr = Math.min(dpr, 1.8);
    else dpr = Math.min(dpr, 2);

    renderer.setPixelRatio(dpr);
  }

  function getFitPose(obj, preset = {}) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = (camera.fov * Math.PI) / 180;

    let distance = (maxDim / 2) / Math.tan(fov / 2);

    const baseMul = preset.distanceMul ?? 1.35;

    const w = window.innerWidth || 0;
    let screenMul = 1.0;

    if (w < 600) screenMul = 1.40;
    else if (w >= 2560) screenMul = 1.55;
    else if (w >= 1920) screenMul = 1.35;
    else if (w >= 1366) screenMul = 1.15;

    distance *= baseMul * screenMul;

    const dirVec = (preset.dir || CAMERA_DIR).clone();
    const camPos = center.clone().add(dirVec.multiplyScalar(distance));
    if (preset.offset) camPos.add(preset.offset);

    const target = center.clone();
    if (preset.targetOffset) target.add(preset.targetOffset);

    return { camPos, target };
  }

  async function loadModelModule(mod) {
    if (typeof currentDispose === 'function') {
      try { await currentDispose(); } catch (_) {}
      currentDispose = null;
    }

    if (current) {
      root.remove(current);
      disposeObject3D(current);
      current = null;
    }

    if (!mod?.url) return;

    const gltf = await loader.loadAsync(mod.url);
    current = gltf.scene || gltf.scenes?.[0];
    root.add(current);

    const box = new THREE.Box3().setFromObject(current);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    const minY = box.min.y;
    const scale = 1.0 / Math.max(size.x, size.y, size.z);

    current.scale.setScalar(scale);
    current.position.set(-center.x, -minY, -center.z);
    root.updateMatrixWorld(true);

    const homePose = getFitPose(current, mod.viewPreset || {});
    camera.position.copy(homePose.camPos);
    controls.target.copy(homePose.target);
    controls.update();

    if (typeof mod.afterLoad === 'function') {
      const extra = {
        camera,
        controls,
        renderer,
        container: containerEl,
        homePose,
        setMode,
        getMode: () => currentMode,
      };

      const maybeDispose = await mod.afterLoad(current, THREE, extra);
      if (typeof maybeDispose === 'function') currentDispose = maybeDispose;
    }
  }

  let lastT = performance.now();

  function animate(t) {
    requestAnimationFrame(animate);
    controls.update();

    const dt = (t - lastT) / 1000;
    lastT = t;

    tickHandlers.forEach((fn) => {
      try { fn(dt); } catch (_) {}
    });

    renderer.render(scene, camera);
  }

  animate(performance.now());
  resize();
  window.addEventListener('resize', resize);

  setMode(currentMode);

  return {
    scene,
    camera,
    renderer,
    controls,
    loadModelModule,
    readyOnce,
    onTick,
    getCurrentRoot: () => current,
    setMode,
    getMode: () => currentMode,
  };
}
