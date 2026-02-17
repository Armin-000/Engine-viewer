import { createBoatSpecsTreeNode, BOAT_SPECS } from './engine-specs.js';
import { regroupTreeForSidebar } from './engine-tree.js';

let sidebarToggleBtn = null;
let sidebarEl = null;
let sidebarListEl = null;
let sidebarInitialized = false;
let outsideClickBound = false;
let escBound = false;

let closeBtn = null;

let btnByUuid = null;
let btnByLabel = null;

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

  // SVG ICONS
  const ICON_EYE = `
    <svg class="icon-eye" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor"
        d="M12 5C5.63636 5 2 12 2 12C2 12 5.63636 19 12 19C18.3636 19 22 12 22 12C22 12 18.3636 5 12 5ZM15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" fill="#ffffff"/> <path d="M12 5C5.63636 5 2 12 2 12C2 12 5.63636 19 12 19C18.3636 19 22 12 22 12C22 12 18.3636 5 12 5Z" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/> <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  const ICON_EYE_OFF = `
    <svg class="icon-eye" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor"
        d="M15.6487 5.39489C14.4859 4.95254 13.2582 4.72021 12 4.72021C8.46997 4.72021 5.17997 6.54885 2.88997 9.71381C1.98997 10.9534 1.98997 13.037 2.88997 14.2766C3.34474 14.9051 3.83895 15.481 4.36664 16.0002M19.3248 7.69653C19.9692 8.28964 20.5676 8.96425 21.11 9.71381C22.01 10.9534 22.01 13.037 21.11 14.2766C18.82 17.4416 15.53 19.2702 12 19.2702C10.6143 19.2702 9.26561 18.9884 7.99988 18.4547" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/> <path id="vector_2" d="M15 12C15 13.6592 13.6592 15 12 15M14.0996 9.85541C13.5589 9.32599 12.8181 9 12 9C10.3408 9 9 10.3408 9 12C9 12.7293 9.25906 13.3971 9.69035 13.9166" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/> <path id="vector_3" d="M2 21.0002L22 2.7002" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;

  function setEyeIcon(btnEl, isVisible) {
    if (!btnEl) return;
    btnEl.innerHTML = isVisible ? ICON_EYE : ICON_EYE_OFF;
    btnEl.classList.toggle('is-off', !isVisible);
    btnEl.setAttribute('aria-pressed', String(!isVisible));
  }

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
    closeBtn.addEventListener('click', () => {
      getVisibility?.()?.clearHoverUX?.();
      clearHover?.();
      closeSidebar();
    });
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
    groupEye.setAttribute('aria-label', 'Toggle visibility for group');

    const updateGroupEyeState = () => {
      const meshes = collectMeshesInSubtree(treeNode);
      const anyVisible = meshes.some((m) => !isMeshHidden?.(m));
      setEyeIcon(groupEye, anyVisible);
    };

    updateGroupEyeState();

    groupEye.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      getVisibility?.()?.clearHoverUX?.();
      clearHover?.();

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
          getVisibility?.()?.clearHoverUX?.();
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
        getVisibility?.()?.applyHoverUX?.(mesh);
        setHoverMesh?.(mesh);
        btn.classList.add('is-hovered');
      });

      btn.addEventListener('mouseleave', () => {
        if (isFocusMode?.()) return;
        getVisibility?.()?.clearHoverUX?.();
        clearHover?.();
        btn.classList.remove('is-hovered');
      });

      btn.addEventListener('click', () => {
        getVisibility?.()?.clearHoverUX?.();
        clearHover?.();
        setActiveItem(btn);
        collapseAllGroupsExceptPath(btn);
        focusOnPart?.(mesh, label);
      });

      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'component-eye';
      eyeBtn.setAttribute('aria-label', 'Toggle visibility');

      setEyeIcon(eyeBtn, !isMeshHidden?.(mesh));

      eyeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        getVisibility?.()?.clearHoverUX?.();
        clearHover?.();

        if (isFocusMode?.()) exitFocusMode?.();

        const nextVisible = toggleMeshHidden?.(mesh);
        refreshVisibility?.();

        setEyeIcon(eyeBtn, nextVisible);
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
      animatePanel(section, !opened);


      const isTopGroup =
        section.parentElement === sidebarListEl ||
        section.parentElement?.parentElement === sidebarListEl;

      if (!opened && isTopGroup) {
        const topGroups = sidebarListEl.querySelectorAll(':scope > li > .comp-group, :scope > .comp-group');
        topGroups.forEach((g) => {
          if (g !== section) {
            animatePanel(g, false);

          }
        });
      }

      section.setAttribute('aria-expanded', String(!opened));

      getVisibility?.()?.clearHoverUX?.();
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
  
    function setPanelHeight(section) {
      const panel = section?.querySelector('.comp-group-panel');
      if (!panel) return;
      panel.style.setProperty('--panel-h', `${panel.scrollHeight}px`);
    }

    function animatePanel(section, expand) {
      if (!section) return;

      setPanelHeight(section);

      section.setAttribute('aria-expanded', expand ? 'true' : 'false');
    }

  const sidebarTree = regroupTreeForSidebar(modelTree);
  renderTreeNode(sidebarTree, sidebarListEl, true);

  focusHandler = (e) => {
    const btn = btnByUuid.get(e?.detail?.uuid) || btnByLabel.get(norm(e?.detail?.label));
    if (!btn) return;

    getVisibility?.()?.clearHoverUX?.();
    clearHover?.();

    setActiveItem(btn);
    collapseAllGroupsExceptPath(btn);
    scrollIntoViewIfNeeded(btn);
  };
  window.addEventListener('engine:focus', focusHandler);

  resetHandler = () => {
    getVisibility?.()?.clearHoverUX?.();
    clearHover?.();

    clearActiveItem();
    collapseAllGroups();
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

        getVisibility?.()?.clearHoverUX?.();
        clearHover?.();

        closeSidebar();
      },
      { capture: true }
    );
  }

  if (!escBound) {
    escBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        getVisibility?.()?.clearHoverUX?.();
        clearHover?.();
        closeSidebar();
      }
    });
  }
}
