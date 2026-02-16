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
