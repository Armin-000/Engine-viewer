/* ======================================================================
   ENGINE SPECS
====================================================================== */

export const BOAT_SPECS = {
  title: 'Boat Specifications',
  items: [
    { key: 'loa', label: 'LOA (Length overall)', value: '8.20 m' },
    { key: 'draft', label: 'Draft', value: '1.15 m' },
    { key: 'disp', label: 'Displacement', value: '3,250 kg' },
    { key: 'ga', label: 'General Arrangement (GA)', value: 'A / 5' },
  ],
  pdfs: [
    { key: 'user-guide', label: '3D Model User Guide', href: '/docs/help/3D_Model_User_Guide.pdf' },
  ],
};

function makePathSafe(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-+|\-+$/g, '');
}

function makeUiNode(displayName) {
  return { userData: { displayName: displayName || '' } };
}

export function createSpecsTreeNode({
  basePath = 'root__specs',
  title = 'Specifications',
  items = [],
  pdfs = [],
} = {}) {
  const rootPath = `${basePath}/${makePathSafe(title)}`;

  const children = [];

  for (const it of items || []) {
    children.push({
      name: it?.label || it?.key || 'Item',
      path: `${rootPath}/${makePathSafe(it?.key || it?.label || 'item')}`,
      node: makeUiNode(it?.label || it?.key || 'Item'),
      _custom: {
        type: 'spec:item',
        key: it?.key ?? '',
        label: it?.label ?? '',
        value: it?.value ?? '',
      },
      children: [],
    });
  }

  for (const doc of pdfs || []) {
    if (!doc?.href) continue;
    const label = doc?.label || 'Open PDF';
    children.push({
      name: label,
      path: `${rootPath}/pdf-${makePathSafe(doc?.key || label)}`,
      node: makeUiNode(label),
      _custom: { type: 'spec:pdf', href: doc.href, label },
      children: [],
    });
  }

  return {
    name: title,
    path: rootPath,
    node: makeUiNode(title),
    _custom: { type: 'spec:root', title },
    children,
  };
}

export function createBoatSpecsTreeNode({ basePath = 'root__specs', data = BOAT_SPECS } = {}) {
  return createSpecsTreeNode({
    basePath,
    title: data?.title || 'Boat Specifications',
    items: data?.items || [],
    pdfs: data?.pdfs || (data?.pdf?.href ? [{ key: 'pdf', label: data.pdf.label, href: data.pdf.href }] : []),
  });
}

export function setBoatSpecValue(data, key, value) {
  const it = data?.items?.find((x) => x.key === key);
  if (it) it.value = value;
}
