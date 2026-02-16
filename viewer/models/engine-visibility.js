/* ======================================================================
   ENGINE VISIBILITY
====================================================================== */

export function createVisibilityController({ root, labelItems }) {
  let allMeshesCache = null;

  let activeFilterOwnerPath = null;
  let lastAllowedSet = null;

  const hiddenMeshes = new Set();

  /* ======================================================================
     HOVER DIMMING
  ====================================================================== */

  const hoverDimmedMeshes = new Set();
  const hoverDimmedLabels = new Set();

  const DIM_OPACITY = 0.18;

  const DIM_COLOR_MUL = 0.55;

  const asArray = (m) => (Array.isArray(m) ? m : [m]);

  function invalidateMeshCache() {
    allMeshesCache = null;
  }

  function collectAllMeshes() {
    if (allMeshesCache) return allMeshesCache;
    const arr = [];
    root?.traverse((o) => o.isMesh && arr.push(o));
    allMeshesCache = arr;
    return arr;
  }

  function setLabelVisibleForMesh(mesh, visible) {
    (labelItems || []).forEach((li) => {
      if (!li?.el || li.mesh !== mesh) return;
      li.el.style.display = visible ? '' : 'none';
    });
  }

  /* ======================================================================
     LABEL DIM HELPERS
  ====================================================================== */

  function dimLabelForMesh(mesh) {
    (labelItems || []).forEach((li) => {
      if (!li?.el || li.mesh !== mesh) return;

      li.el.style.opacity = '0.25';
      li.el.style.filter = 'blur(0.6px)';
    });
  }

  function restoreLabelForMesh(mesh) {
    (labelItems || []).forEach((li) => {
      if (!li?.el || li.mesh !== mesh) return;

      li.el.style.opacity = '';
      li.el.style.filter = '';
    });
  }


  /* ======================================================================
     HIDDEN STATE APPLY
  ====================================================================== */

  function applyHiddenStateToScene() {
    hiddenMeshes.forEach((m) => {
      if (!m) return;
      m.visible = false;
      setLabelVisibleForMesh(m, false);
    });
  }

  function isMeshHidden(mesh) {
    return hiddenMeshes.has(mesh);
  }

  function setMeshHidden(mesh, hidden) {
    if (!mesh?.isMesh) return;

    if (hidden) hiddenMeshes.add(mesh);
    else hiddenMeshes.delete(mesh);

    mesh.visible = !hidden;
    setLabelVisibleForMesh(mesh, !hidden);
  }

  function toggleMeshHidden(mesh) {
    const nextHidden = !isMeshHidden(mesh);
    setMeshHidden(mesh, nextHidden);
    return !nextHidden;
  }

  function setMeshesHidden(meshes, hidden) {
    (meshes || []).forEach((m) => setMeshHidden(m, hidden));
  }

  function clearHidden() {
    hiddenMeshes.clear();
  }

  function clearIsolate() {
    activeFilterOwnerPath = null;
    lastAllowedSet = null;
  }

  /* ======================================================================
     MATERIAL DIM HELPERS
  ====================================================================== */

  function rememberMaterial(mat) {
    if (!mat) return;
    mat.userData ||= {};
    if (mat.userData._orig) return;

    mat.userData._orig = {
      opacity: mat.opacity ?? 1,
      transparent: !!mat.transparent,
      depthWrite: mat.depthWrite ?? true,
      color: mat.color ? mat.color.clone() : null,
    };
  }

  function applyDimToMesh(mesh) {
    if (!mesh?.isMesh || !mesh.material) return;

    const mats = asArray(mesh.material);
    mats.forEach((mat) => {
      if (!mat) return;

      rememberMaterial(mat);

      const orig = mat.userData._orig;

      if (orig?.color && mat.color) mat.color.copy(orig.color);

      mat.transparent = true;
      mat.opacity = Math.min(orig.opacity ?? 1, DIM_OPACITY);

      mat.depthWrite = false;

      if (mat.color) mat.color.multiplyScalar(DIM_COLOR_MUL);

      mat.needsUpdate = true;
    });
  }

  function restoreMeshMaterials(mesh) {
    if (!mesh?.isMesh || !mesh.material) return;

    const mats = asArray(mesh.material);
    mats.forEach((mat) => {
      const orig = mat?.userData?._orig;
      if (!mat || !orig) return;

      mat.opacity = orig.opacity;
      mat.transparent = orig.transparent;
      mat.depthWrite = orig.depthWrite;

      if (orig.color && mat.color) mat.color.copy(orig.color);

      mat.needsUpdate = true;
    });
  }

  function clearHoverDimming() {
    hoverDimmedMeshes.forEach((m) => restoreMeshMaterials(m));
    hoverDimmedMeshes.clear();

    hoverDimmedLabels.forEach((m) => restoreLabelForMesh(m));
    hoverDimmedLabels.clear();
  }

  /* ======================================================================
     PUBLIC: HOVER DIM API
  ====================================================================== */

  function dimOthersForHover(hoveredMesh) {
    if (!hoveredMesh?.isMesh) {
      clearHoverDimming();
      return;
    }

    clearHoverDimming();

    collectAllMeshes().forEach((m) => {
      if (!m || m === hoveredMesh) return;
      if (hiddenMeshes.has(m)) return;
      if (m.visible === false) return;

      applyDimToMesh(m);
      dimLabelForMesh(m);

      hoverDimmedMeshes.add(m);
      hoverDimmedLabels.add(m);
    });

    restoreLabelForMesh(hoveredMesh);
  }

  function clearHoverDim() {
    clearHoverDimming();
  }

  /* ======================================================================
     VISIBILITY MODES
  ====================================================================== */

  function showAllParts() {
    clearHoverDimming();
    clearIsolate();

    collectAllMeshes().forEach((m) => (m.visible = true));
    (labelItems || []).forEach((li) => li?.el && (li.el.style.display = ''));

    applyHiddenStateToScene();
  }

  function showOnlyMeshes(allowedMeshesSet, ownerPath = null) {
    clearHoverDimming();

    if (!allowedMeshesSet || !allowedMeshesSet.size) {
      showAllParts();
      return;
    }

    activeFilterOwnerPath = ownerPath;
    lastAllowedSet = allowedMeshesSet;

    collectAllMeshes().forEach((m) => {
      const shouldBeVisible = allowedMeshesSet.has(m) && !hiddenMeshes.has(m);
      m.visible = shouldBeVisible;
    });

    (labelItems || []).forEach((li) => {
      if (!li?.el || !li?.mesh) return;
      li.el.style.display = li.mesh.visible ? '' : 'none';
    });
  }

  function refreshVisibility() {
    clearHoverDimming();

    if (activeFilterOwnerPath && lastAllowedSet && lastAllowedSet.size) {
      collectAllMeshes().forEach((m) => {
        const shouldBeVisible = lastAllowedSet.has(m) && !hiddenMeshes.has(m);
        m.visible = shouldBeVisible;
      });

      (labelItems || []).forEach((li) => {
        if (!li?.el || !li?.mesh) return;
        li.el.style.display = li.mesh.visible ? '' : 'none';
      });

      return;
    }

    showAllParts();
  }

  function getActiveFilterOwnerPath() {
    return activeFilterOwnerPath;
  }

  return {
    invalidateMeshCache,
    collectAllMeshes,

    showAllParts,
    showOnlyMeshes,
    refreshVisibility,

    isMeshHidden,
    toggleMeshHidden,
    setMeshesHidden,

    clearHidden,
    clearIsolate,

    getActiveFilterOwnerPath,

    dimOthersForHover,
    clearHoverDim,
  };
}
