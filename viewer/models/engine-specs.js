/* ======================================================================
   ENGINE SPECS
====================================================================== */

export const BOAT_SPECS = {
  title: "Boat Specifications",
  items: [
    { key: "loa", label: "LOA (Length overall)", value: "8.20 m" },
    { key: "draft", label: "Draft", value: "1.15 m" },
    { key: "disp", label: "Displacement", value: "3,250 kg" },
    { key: "ga", label: "General Arrangement (GA)", value: "A / 5" },
  ],
  pdf: {
    label: "Open PDF",
    href: "/docs/help/3D_Model_User_Guide.pdf",
  },
};


function makePathSafe(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

export function createBoatSpecsTreeNode({ basePath = "eco-cube", data = BOAT_SPECS } = {}) {
  const rootPath = `${basePath}/${makePathSafe(data.title)}`;

  const children = data.items.map((it) => ({
    name: it.label,
    path: `${rootPath}/${makePathSafe(it.key)}`,
    node: null,
    _custom: { type: "spec:item", ...it },
    children: [],
  }));

  if (data.pdf?.href) {
    children.push({
      name: data.pdf.label,
      path: `${rootPath}/pdf`,
      node: null,
      _custom: { type: "spec:pdf", href: data.pdf.href, label: data.pdf.label },
      children: [],
    });
  }

  return {
    name: data.title,
    path: rootPath,
    node: null,
    _custom: { type: "spec:root", title: data.title },
    children,
  };
}

export function setBoatSpecValue(data, key, value) {
  const it = data?.items?.find((x) => x.key === key);
  if (it) it.value = value;
}
