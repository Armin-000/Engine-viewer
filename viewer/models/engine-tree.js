/* ======================================================================
   ENGINE TREE
====================================================================== */

function cleanName(s) {
  const t = (s || '').trim();
  return t || '(unnamed)';
}

function shouldHideNodeName(baseName) {
  return baseName === 'Scene_Collection' || baseName === 'NamedViews' || baseName === 'Layers';
}

/* ===================== AUTO NAME (GENERIC) ===================== */

const BAD_NAME_RE = [
  /^object\s*\d+$/i,
  /^mesh\s*\d+$/i,
  /^node\s*\d+$/i,
  /^group\s*\d+$/i,
  /^cube(\.\d+)?$/i,
  /^sphere(\.\d+)?$/i,
  /^cylinder(\.\d+)?$/i,
  /^plane(\.\d+)?$/i,
  /^\d+$/i,
];

function uiClean(s) {
  return (s || '')
    .toString()
    .trim()
    .replace(/\s#\d+$/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isBadUiName(name) {
  const n = uiClean(name);
  if (!n) return true;
  return BAD_NAME_RE.some((re) => re.test(n));
}

function bestNameFromPath(path) {
  const parts = (path || '').split('/').map(uiClean).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (!isBadUiName(p)) return p;
  }
  return parts[parts.length - 1] || 'Component';
}

function breadcrumbFromPath(path, maxParts = 3) {
  const parts = (path || '').split('/').map(uiClean).filter((p) => p && !isBadUiName(p));
  if (!parts.length) return '';
  return parts.slice(Math.max(0, parts.length - maxParts)).join(' / ');
}

/* =============================================================== */

function makeUniqueSiblingName(uniqueNameCount, parentPath, baseName) {
  const key = `${parentPath}||${baseName}`;
  const c = (uniqueNameCount.get(key) || 0) + 1;
  uniqueNameCount.set(key, c);
  return c === 1 ? baseName : `${baseName} #${c}`;
}

function nodePath(parentPath, nodeNameUnique) {
  return parentPath ? `${parentPath}/${nodeNameUnique}` : nodeNameUnique;
}

function buildTreeInternal({ node, parentPath = '', indexByPath, meshToPath, uniqueNameCount }) {
  const base = cleanName(node.name);

  if (shouldHideNodeName(base)) {
    return {
      node,
      name: base,
      path: parentPath || base,
      children: (node.children || [])
        .map((ch) => buildTreeInternal({ node: ch, parentPath, indexByPath, meshToPath, uniqueNameCount }))
        .filter(Boolean),
      _skipRender: true,
    };
  }

  const unique = makeUniqueSiblingName(uniqueNameCount, parentPath, base);
  const path = nodePath(parentPath, unique);

  if (!indexByPath.has(path)) indexByPath.set(path, node);
  if (node.isMesh) meshToPath.set(node, path);

  const displayName = bestNameFromPath(path);
  node.userData = node.userData || {};
  if (!node.userData.displayName) node.userData.displayName = displayName;
  if (!node.userData.breadcrumb) node.userData.breadcrumb = breadcrumbFromPath(path);

  return {
    node,
    name: unique,
    path,
    children: (node.children || [])
      .map((ch) => buildTreeInternal({ node: ch, parentPath: path, indexByPath, meshToPath, uniqueNameCount }))
      .filter(Boolean),
  };
}

export function collectMeshesInSubtree(treeNode, out = []) {
  if (!treeNode) return out;
  if (treeNode.node?.isMesh) out.push(treeNode.node);
  for (const ch of treeNode.children || []) collectMeshesInSubtree(ch, out);
  return out;
}

export function buildEngineTree(root) {
  const indexByPath = new Map();
  const meshToPath = new WeakMap();
  const uniqueNameCount = new Map();

  const modelTree = buildTreeInternal({
    node: root,
    parentPath: '',
    indexByPath,
    meshToPath,
    uniqueNameCount,
  });

  return { modelTree, indexByPath, meshToPath };
}

/* ======================================================================
   SIDEBAR GROUPING (TREE TRANSFORM)
====================================================================== */

const SIDEBAR_TOP_GROUPS = [
  { key: 'main', title: 'Main engine' },
  { key: 'parts', title: 'Engine parts' },
  { key: 'addons', title: 'Engine accessories' },
  { key: 'exhaust', title: 'Exhaust system' },
];

const SIDEBAR_GROUP_RULES = [
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

function foldNorm(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/[^\w\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sidebarTitleOfNode(n) {
  return (
    n?.node?.userData?.displayName ||
    uiClean(n?.name) ||
    uiClean(n?.path?.split('/').pop()) ||
    ''
  );
}

function sidebarPickGroupKey(treeNode) {
  const title = foldNorm(sidebarTitleOfNode(treeNode));
  const path = foldNorm(treeNode?.path || '');
  const crumb = foldNorm(treeNode?.node?.userData?.breadcrumb || '');

  for (const r of SIDEBAR_GROUP_RULES) {
    if (r.words.some((w) => title.includes(w) || path.includes(w) || crumb.includes(w))) return r.key;
  }
  return 'main';
}

function sidebarMakeGroupNode(basePath, g) {
  return {
    node: { userData: { displayName: g.title } },
    name: g.title,
    path: `${basePath}__sidebar/${g.key}`,
    children: [],
    _custom: { type: 'ui:group', key: g.key },
  };
}

function pickDenseLevel(node, minChildren = 18, maxDepth = 5) {
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
}

/**
 *
 * @param {Object} originalRoot
 * @param {Object} opts
 * @param {number} opts.minChildren
 * @param {number} opts.maxDepth
 * @param {Array}  opts.topGroups
 */
export function regroupTreeForSidebar(originalRoot, opts = {}) {
  if (!originalRoot) return originalRoot;

  const { minChildren = 18, maxDepth = 5, topGroups = SIDEBAR_TOP_GROUPS } = opts;

  const basePath = originalRoot.path || 'root';
  let sourceNodes = pickDenseLevel(originalRoot, minChildren, maxDepth);

  const byKey = new Map();
  topGroups.forEach((g) => byKey.set(g.key, sidebarMakeGroupNode(basePath, g)));

  for (const n of sourceNodes) {
    const key = sidebarPickGroupKey(n);
    (byKey.get(key) || byKey.get('main')).children.push(n);
  }

  for (const g of byKey.values()) {
    g.children.sort((a, b) =>
      sidebarTitleOfNode(a).localeCompare(sidebarTitleOfNode(b), undefined, { sensitivity: 'base' })
    );
  }

  return {
    node: originalRoot.node,
    name: originalRoot.name,
    path: basePath,
    children: topGroups.map((g) => byKey.get(g.key)),
    _skipRender: true,
  };
}
