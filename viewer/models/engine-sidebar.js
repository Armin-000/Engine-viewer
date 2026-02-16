import { createBoatSpecsTreeNode, BOAT_SPECS } from './engine-specs.js';

let sidebarToggleBtn = null;
let sidebarEl = null;
let sidebarListEl = null;
let sidebarInitialized = false;
let outsideClickBound = false;
let escBound = false;

let closeBtn = null;

let btnByUuid = null;
let btnByLabel = null;
let btnByName = null;

let focusHandler = null;
let resetHandler = null;
let toggleHandler = null;

export function resetSidebar() {
  sidebarInitialized = false;

  if (focusHandler) {
    window.removeEventListener('engine:focus', focusHandler);
    focusHandler = null;
  }
  if (resetHandler) {
    window.removeEventListener('engine:reset', resetHandler);
    resetHandler = null;
  }

  if (toggleHandler && sidebarToggleBtn) {
    sidebarToggleBtn.removeEventListener('click', toggleHandler);
    toggleHandler = null;
  }

  sidebarToggleBtn = null;
  sidebarEl = null;
  sidebarListEl = null;
  closeBtn = null;

  btnByUuid = null;
  btnByLabel = null;
  btnByName = null;
}

export function initComponentSidebar(deps = {}) {
  const {
    modelTree,
    prettyFromNodeName,
    getNiceName,
    collectMeshesInSubtree,
    showOnlyMeshes,
    showAllParts,
    focusOnPart,
    isFocusMode,
    exitFocusMode,
    setHoverMesh,
    clearHover,
    getActiveFilterOwnerPath,

    isMeshHidden,
    toggleMeshHidden,
    setMeshesHidden,
    refreshVisibility,

    getVisibility = null,

    helpUrl = '/docs/help/3D_Model_User_Guide.pdf',
    onReset = null,
  } = deps;

  if (!modelTree || sidebarInitialized) return;

  sidebarToggleBtn = document.getElementById('componentToggle');
  sidebarEl = document.getElementById('componentSidebar');
  sidebarListEl = document.getElementById('componentList');

  if (!sidebarToggleBtn || !sidebarEl || !sidebarListEl) return;

  sidebarInitialized = true;
  sidebarListEl.innerHTML = '';

  btnByUuid = new Map();
  btnByLabel = new Map();
  btnByName = new Map();

  const norm = (s) =>
    (s || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\-./\\]+/g, ' ')
      .replace(/[^\w\s]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  function clearActiveItem() {
    sidebarListEl
      ?.querySelectorAll('.component-list-btn.is-active')
      .forEach((b) => b.classList.remove('is-active'));
  }

  function setActiveItem(btnEl) {
    clearActiveItem();
    btnEl?.classList.add('is-active');
  }

  function expandParentsForElement(el) {
    if (!el) return;
    let p = el.parentElement;
    while (p) {
      if (p.classList?.contains('comp-group')) p.setAttribute('aria-expanded', 'true');
      p = p.parentElement;
    }
  }

  function collapseAllGroups() {
    sidebarEl
      ?.querySelectorAll('.comp-group[aria-expanded="true"]')
      .forEach((g) => g.setAttribute('aria-expanded', 'false'));
  }

  function collapseAllGroupsExceptPath(activeBtn) {
    if (!sidebarEl) return;
    collapseAllGroups();
    expandParentsForElement(activeBtn);
  }

  function scrollIntoViewIfNeeded(el) {
    if (!el) return;
    const body = sidebarEl?.querySelector('.component-sidebar-body');
    if (!body) return;

    const rect = el.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();

    const above = rect.top < bodyRect.top + 8;
    const below = rect.bottom > bodyRect.bottom - 8;

    if (above || below) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const setToggleVisible = (visible) => {
    if (!sidebarToggleBtn) return;
    sidebarToggleBtn.style.opacity = visible ? '' : '0';
    sidebarToggleBtn.style.pointerEvents = visible ? '' : 'none';
  };

  const isOpen = () => sidebarEl.classList.contains('open');

  const openSidebar = () => {
    sidebarEl.classList.add('open');
    sidebarToggleBtn.classList.add('open');
    setToggleVisible(false);
    closeBtn?.focus?.();
  };

  const closeSidebar = () => {
    sidebarEl.classList.remove('open');
    sidebarToggleBtn.classList.remove('open');
    setToggleVisible(true);
    sidebarToggleBtn?.focus?.();
  };

  const header = sidebarEl.querySelector('.component-sidebar-header');

  if (header && !header.querySelector('.component-close')) {
    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'component-close';
    closeBtn.setAttribute('aria-label', 'Close components');

    closeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor"
          d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7A1 1 0 0 0 5.7 7.1l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z"/>
      </svg>
    `;

    header.appendChild(closeBtn);
    closeBtn.addEventListener('click', closeSidebar);
  } else {
    closeBtn = header?.querySelector('.component-close') || null;
  }

  function ensureFooter() {
    const inner = sidebarEl.querySelector('.component-sidebar-inner');
    if (!inner) return;

    let footer = inner.querySelector('.component-sidebar-footer');
    if (footer) return;

    footer = document.createElement('div');
    footer.className = 'component-sidebar-footer';

    footer.innerHTML = `
      <div class="sidebar-footer-actions">
        <button type="button" class="sidebar-action sidebar-action--help" aria-label="Help">
          <span aria-hidden="true">?</span> Help
        </button>
      </div>
    `;

    inner.appendChild(footer);
    const helpBtn = footer.querySelector('.sidebar-action--help');
    helpBtn?.addEventListener('click', () => window.open(helpUrl, '_blank', 'noopener'));

    const globalHelpBtn = document.getElementById('helpBtnGlobal');
    const globalResetBtn = document.getElementById('resetBtnGlobal');

    if (globalHelpBtn) {
      globalHelpBtn.onclick = () => window.open(helpUrl, '_blank', 'noopener');
    }
    if (globalResetBtn) {
      globalResetBtn.onclick = () => {
        if (typeof onReset === 'function') onReset();
      };
    }
  }

  ensureFooter();

  const TOP_GROUPS = [
    { key: 'main', title: 'Main engine' },
    { key: 'parts', title: 'Engine parts' },
    { key: 'addons', title: 'Engine accessories' },
    { key: 'exhaust', title: 'Exhaust system' },
  ];

  const GROUP_RULES = [
    {
      key: 'exhaust',
      words: [
        'exhaust',
        'exhaust filter',
        'continuation',
        'manifold',
        'muffler',
        'silencer',
        'cat',
        'catalyst',
        'catalytic',
        'dpf',
        'downpipe',
        'tailpipe',
        'pipe',
        'flex',
        'lambda',
        'o2',
      ],
    },
    {
      key: 'addons',
      words: [
        'turbo',
        'turbo additives',
        'turbo carriers',
        'turbo filter',
        'turbo hose',
        'turbo injection',
        'turbo intake manifold',
        'the other side of the turbo',
        'intercooler',
        'radiator',
        'cooler',
        'fan',
        'pump',
        'compressor',
        'ac',
        'a c',
        'alternator',
        'starter',
        'battery',
        'wiring',
        'cable',
        'harness',
        'ecu',
        'sensor',
        'gear',
      ],
    },
    {
      key: 'parts',
      words: [
        'carrying',
        'carrier',
        'mount',
        'mounts',
        'screw',
        'bolt',
        'nut',
        'washer',
        'bracket',
        'clamp',
        'hose',
        'hoses',
        'tube',
        'gasket',
        'seal',
        'oring',
        'o ring',
        'bearing',
        'pulley',
        'belt',
        'chain',
        'spring',
        'cap',
        'cover',
        'housing',
        'metal covers',
        'plastic covers',
        'stainless steel',
        'surface block',
        'lamella',
        'load-bearing',
        'columns',
        'main interface',
        'reduction',
      ],
    },
  ];

  function titleOfNode(n) {
    return (
      n?.node?.userData?.displayName ||
      (typeof prettyFromNodeName === 'function' ? prettyFromNodeName(n?.name) : n?.name) ||
      n?.name ||
      ''
    );
  }

  function pickGroupKey(treeNode) {
    const t = norm(titleOfNode(treeNode));
    const p = norm(treeNode?.path || '');

    for (const r of GROUP_RULES) {
      if (r.words.some((w) => t.includes(w) || p.includes(w))) return r.key;
    }
    return 'main';
  }

  function makeGroupNode(basePath, g) {
    return {
      node: { userData: { displayName: g.title } },
      name: g.title,
      path: `${basePath}__sidebar/${g.key}`,
      children: [],
      _custom: { type: 'ui:group', key: g.key },
    };
  }

  function regroupTreeForSidebar(originalRoot) {
    if (!originalRoot) return originalRoot;

    const basePath = originalRoot.path || 'root';
    let sourceNodes = Array.isArray(originalRoot.children) ? originalRoot.children.slice() : [];

    const pickDenseLevel = (node, minChildren = 18, maxDepth = 4) => {
      let cur = node;
      for (let d = 0; d < maxDepth; d++) {
        const kids = Array.isArray(cur?.children) ? cur.children : [];
        if (kids.length >= minChildren) return kids.slice();
        if (kids.length === 1 && kids[0]?.children?.length) {
          cur = kids[0];
          continue;
        }
        break;
      }
      return Array.isArray(node?.children) ? node.children.slice() : [];
    };

    sourceNodes = pickDenseLevel(originalRoot, 18, 5);

    const byKey = new Map();
    TOP_GROUPS.forEach((g) => byKey.set(g.key, makeGroupNode(basePath, g)));

    for (const n of sourceNodes) {
      const key = pickGroupKey(n);
      (byKey.get(key) || byKey.get('main')).children.push(n);
    }

    for (const g of byKey.values()) {
      g.children.sort((a, b) => {
        const la = titleOfNode(a);
        const lb = titleOfNode(b);
        return la.localeCompare(lb, undefined, { sensitivity: 'base' });
      });
    }

    return {
      node: originalRoot.node,
      name: originalRoot.name,
      path: basePath,
      children: TOP_GROUPS.map((g) => byKey.get(g.key)),
      _skipRender: true,
    };
  }

  function isGroupActive(treeNode) {
    if (typeof getActiveFilterOwnerPath !== 'function') return false;
    const active = getActiveFilterOwnerPath();
    if (!active) return false;
    return active === treeNode.path;
  }

  function resetFromGroupClick() {
    if (typeof onReset === 'function') {
      onReset();
      return;
    }
    if (isFocusMode?.()) exitFocusMode?.();
    showAllParts?.();
    refreshVisibility?.();
    clearActiveItem();
    collapseAllGroups();
  }

  function renderTreeNode(treeNode, containerEl, isTopLevel = false) {
    if (!treeNode) return;

    if (treeNode._skipRender) {
      (treeNode.children || []).forEach((ch) => renderTreeNode(ch, containerEl, false));
      return;
    }

    if (isTopLevel) {
      (treeNode.children || []).forEach((ch) => renderTreeNode(ch, containerEl, false));
      return;
    }

    const section = document.createElement('section');
    section.className = 'comp-group';
    section.setAttribute('aria-expanded', 'false');
    section.setAttribute('data-path', treeNode.path);

    const headerRow = document.createElement('div');
    headerRow.className = 'comp-group-head';

    const headerBtn = document.createElement('button');
    headerBtn.type = 'button';
    headerBtn.className = 'comp-group-btn';

    const titleText = treeNode.node?.userData?.displayName || prettyFromNodeName(treeNode.name);
    headerBtn.innerHTML = `
      <span class="comp-group-title">${titleText}</span>
      <span class="comp-group-chev">▾</span>
    `;

    const groupEye = document.createElement('button');
    groupEye.type = 'button';
    groupEye.className = 'component-eye component-eye--group';
    groupEye.innerHTML = '👁';

    const updateGroupEyeState = () => {
      const meshes = collectMeshesInSubtree(treeNode);
      const anyVisible = meshes.some((m) => !isMeshHidden?.(m));
      groupEye.classList.toggle('is-off', !anyVisible);
      groupEye.innerHTML = anyVisible ? '👁' : '🗙';
    };

    updateGroupEyeState();

    groupEye.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isFocusMode?.()) exitFocusMode?.();

      const meshes = collectMeshesInSubtree(treeNode);
      const anyVisible = meshes.some((m) => !isMeshHidden?.(m));

      setMeshesHidden?.(meshes, anyVisible);
      refreshVisibility?.();
      updateGroupEyeState();
      clearActiveItem();
    });

    headerRow.appendChild(headerBtn);
    headerRow.appendChild(groupEye);

    const panel = document.createElement('div');
    panel.className = 'comp-group-panel';

    const ul = document.createElement('ul');
    ul.className = 'comp-sublist';

    const meshChildren = (treeNode.children || []).filter((ch) => {
      if (ch?._custom?.type?.startsWith('spec:')) return true;
      if (ch.node?.isMesh) return true;
      const meshes = collectMeshesInSubtree(ch);
      return meshes.length === 1;
    });

    for (const ch of meshChildren) {
      if (ch?._custom?.type?.startsWith('spec:')) {
        const li = document.createElement('li');
        li.className = 'component-list-item';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'component-list-btn spec-btn';

        const t = ch._custom.type;

        const left = document.createElement('span');
        left.className = 'spec-left';
        left.innerHTML = `
          <span class="component-list-bullet"></span>
          <span class="spec-label">${ch._custom.label || ch.name || 'Item'}</span>
        `;

        const right = document.createElement('span');
        right.className = 'spec-right';

        if (t === 'spec:item') {
          const v = (ch._custom.value ?? '').toString().trim();
          right.innerHTML = `<span class="spec-value">${v || '—'}</span>`;
          btn.classList.add('spec-row');
        } else if (t === 'spec:pdf') {
          right.innerHTML = `<span class="spec-cta">Open</span>`;
          btn.classList.add('spec-pdf');
        }

        btn.appendChild(left);
        btn.appendChild(right);

        btn.addEventListener('click', () => {
          clearHover?.();
          setActiveItem(btn);
          collapseAllGroupsExceptPath(btn);
          if (t === 'spec:pdf' && ch._custom.href) window.open(ch._custom.href, '_blank', 'noopener');
        });

        li.appendChild(btn);
        ul.appendChild(li);
        continue;
      }

      const meshes = collectMeshesInSubtree(ch);
      const mesh = meshes[0];
      const label = mesh?.userData?.displayName || getNiceName(mesh);

      const li = document.createElement('li');
      li.className = 'component-list-item';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'component-list-btn';
      btn.innerHTML = `<span class="component-list-bullet"></span><span class="component-list-label">${label}</span>`;

      if (mesh?.uuid) btnByUuid.set(mesh.uuid, btn);
      const nl = norm(label);
      if (nl && !btnByLabel.has(nl)) btnByLabel.set(nl, btn);

      btn.addEventListener('mouseenter', () => {
        if (isFocusMode?.()) return;

        getVisibility?.()?.clearHoverDim?.();
        getVisibility?.()?.dimOthersForHover?.(mesh);

        setHoverMesh?.(mesh);

        document.documentElement.classList.add('viewer--hover-dim');
        btn.classList.add('is-hovered');
      });

      btn.addEventListener('mouseleave', () => {
        if (isFocusMode?.()) return;

        getVisibility?.()?.clearHoverDim?.();
        clearHover?.();

        document.documentElement.classList.remove('viewer--hover-dim');
        btn.classList.remove('is-hovered');
      });

      btn.addEventListener('click', () => {
        clearHover?.();
        setActiveItem(btn);
        collapseAllGroupsExceptPath(btn);
        focusOnPart?.(mesh, label);
      });

      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'component-eye';
      eyeBtn.innerHTML = isMeshHidden?.(mesh) ? '🗙' : '👁';
      eyeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isFocusMode?.()) exitFocusMode?.();
        const nextVisible = toggleMeshHidden?.(mesh);
        refreshVisibility?.();
        eyeBtn.innerHTML = nextVisible ? '👁' : '🗙';
        updateGroupEyeState();
        clearActiveItem();
      });

      li.appendChild(btn);
      li.appendChild(eyeBtn);
      ul.appendChild(li);
    }

    const groupChildren = (treeNode.children || []).filter(
      (ch) => !ch?._custom?.type?.startsWith('spec:') && !ch.node?.isMesh
    );
    for (const ch of groupChildren) renderTreeNode(ch, ul, false);

    panel.appendChild(ul);
    section.appendChild(headerRow);
    section.appendChild(panel);

    if (containerEl.tagName === 'UL') {
      const wrapLi = document.createElement('li');
      wrapLi.className = 'component-list-item';
      wrapLi.appendChild(section);
      containerEl.appendChild(wrapLi);
    } else {
      containerEl.appendChild(section);
    }

    headerBtn.addEventListener('click', () => {
      const opened = section.getAttribute('aria-expanded') === 'true';
      section.setAttribute('aria-expanded', String(!opened));

      clearHover?.();

      if (isGroupActive(treeNode)) {
        resetFromGroupClick();
        updateGroupEyeState();
        return;
      }

      if (isFocusMode?.()) exitFocusMode?.();
      if (treeNode?._custom?.type === 'spec:root') return;

      const meshes = collectMeshesInSubtree(treeNode);
      showOnlyMeshes?.(new Set(meshes), treeNode.path);
      updateGroupEyeState();
    });
  }

  const sidebarTree = regroupTreeForSidebar(modelTree);
  renderTreeNode(sidebarTree, sidebarListEl, true);

  focusHandler = (e) => {
    let btn = btnByUuid.get(e?.detail?.uuid) || btnByLabel.get(norm(e?.detail?.label));
    if (!btn) return;
    setActiveItem(btn);
    collapseAllGroupsExceptPath(btn);
    scrollIntoViewIfNeeded(btn);
  };
  window.addEventListener('engine:focus', focusHandler);

  resetHandler = () => {
    clearHover?.();
    clearActiveItem();
    collapseAllGroups();
    closeSidebar();
    showAllParts?.();
    refreshVisibility?.();
  };
  window.addEventListener('engine:reset', resetHandler);

  setToggleVisible(true);
  toggleHandler = () => (isOpen() ? closeSidebar() : openSidebar());
  sidebarToggleBtn.addEventListener('click', toggleHandler);

  if (!outsideClickBound) {
    outsideClickBound = true;
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (!isOpen() || e.target.closest('#componentSidebar') || e.target.closest('#componentToggle')) return;
        closeSidebar();
      },
      { capture: true }
    );
  }

  if (!escBound) {
    escBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) closeSidebar();
    });
  }
}
