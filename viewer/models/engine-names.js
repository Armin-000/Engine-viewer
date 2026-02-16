/* ======================================================================
   ENGINE NAME MAP (Engine 2.0)
   - Prefer mesh.userData.displayName if present (best practice)
   - Manual map for exact / normalized overrides
   - Smart heuristics for common engine terms
   - Clean fallback formatting

   Used by:
   - getNiceName(mesh)
   - prettyFromNodeName(nodeName)
====================================================================== */

export const NAME_MAP = {
  /* -------- Root / wrappers (if they ever appear as nodes) -------- */
  'Engine 2.0': 'Engine 2.0',
  'Engine parts': 'Engine Parts',

  /* -------- Common groups from your hierarchy -------- */
  'Carrying carrier': 'Carrying Carrier',
  Drain: 'Drain',
  'Engine block': 'Engine Block',
  'Engine sub-block': 'Engine Sub-block',
  'Front and rear block': 'Front & Rear Block',
  'The main block': 'Main Block',

  'Engine mounts': 'Engine Mounts',
  'Engine screws': 'Engine Screws',
  Reduction: 'Reduction',
  Lamella: 'Lamella',
  'Load-bearing columns': 'Load-bearing Columns',
  'Main interface': 'Main Interface',

  Exhaust: 'Exhaust',
  'Exhaust continuation': 'Exhaust Continuation',
  'Exhaust filter': 'Exhaust Filter',

  'Fuel drain': 'Fuel Drain',
  'Fuel supply': 'Fuel Supply',
  Gear: 'Gear',

  'Group turbo parts': 'Turbo System',
  'The other side of the turbo': 'Turbo (Opposite Side)',
  'Turbo additives': 'Turbo Additives',
  'Turbo carriers': 'Turbo Carriers',
  'Turbo filter': 'Turbo Filter',
  'Turbo hose': 'Turbo Hose',
  'Turbo injection': 'Turbo Injection',
  'Turbo intake manifold': 'Turbo Intake Manifold',

  'Metal covers': 'Metal Covers',
  'Plastic covers': 'Plastic Covers',
  'Stainless steel parts': 'Stainless Steel Parts',
  'Surface block': 'Surface Block',
  'Metal hoses': 'Metal Hoses',
  'Oil lubricator': 'Oil Lubricator',
  'Oil parts': 'Oil System Parts',

  'Input parts': 'Input Parts',
  'Import of cylinders': 'Cylinder Intake / Import',

  default: 'Engine Component',
};

/* ======================================================================
   HELPERS: NORMALIZE
====================================================================== */

function normalizeKey(s) {
  return (s || '')
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // remove trailing instance counters like " #12"
    .replace(/\s#\d+$/, '')
    // remove suffixes like _12 or .001 at end
    .replace(/(_\d+|\.\d+)?$/g, '')
    // unify separators
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/[^\w\s]+/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const NAME_MAP_NORM = (() => {
  const out = Object.create(null);
  for (const k in NAME_MAP) {
    if (k === 'default') continue;
    out[normalizeKey(k)] = NAME_MAP[k];
  }
  return out;
})();

/* ======================================================================
   HEURISTICS (fallback smart naming)
====================================================================== */

function humanizeFallback(raw) {
  return (raw || '')
    .toString()
    .trim()
    .replace(/\s#\d+$/, '')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aiGuessName(meshOrName) {
  const rawName = typeof meshOrName === 'string' ? meshOrName : meshOrName?.name;
  const n = normalizeKey(rawName);

  // Exhaust
  if (n.includes('exhaust') || n.includes('muffler') || n.includes('silencer')) return 'Exhaust';
  if (n.includes('manifold')) return 'Manifold';
  if (n.includes('dpf') || n.includes('catalyst') || n.includes('cat')) return 'Exhaust Filter';

  // Turbo / air intake
  if (n.includes('turbo')) return 'Turbo Component';
  if (n.includes('intercooler')) return 'Intercooler';
  if (n.includes('intake') && n.includes('manifold')) return 'Intake Manifold';
  if (n.includes('hose') || n.includes('pipe') || n.includes('tube')) return 'Hose / Pipe';

  // Engine structure
  if (n.includes('block')) return 'Engine Block';
  if (n.includes('mount')) return 'Engine Mount';
  if (n.includes('bracket')) return 'Bracket';
  if (n.includes('cover')) return 'Cover';
  if (n.includes('housing')) return 'Housing';

  // Fasteners
  if (n.includes('screw') || n.includes('bolt') || n.includes('nut') || n.includes('washer'))
    return 'Fastener';

  // Fluids
  if (n.includes('oil')) return 'Oil System';
  if (n.includes('fuel')) return 'Fuel System';
  if (n.includes('drain')) return 'Drain';
  if (n.includes('pump')) return 'Pump';

  // Mechanical
  if (n.includes('gear')) return 'Gear';
  if (n.includes('bearing')) return 'Bearing';
  if (n.includes('belt')) return 'Belt';
  if (n.includes('pulley')) return 'Pulley';

  return NAME_MAP.default;
}

/* ======================================================================
   PUBLIC API
====================================================================== */

export function getNiceName(mesh) {
  // 1) Best source: userData.displayName (set in Blender or injected in code)
  const udName = mesh?.userData?.displayName;
  if (udName && udName.toString().trim()) return udName.toString().trim();

  const raw = (mesh?.name || '').trim();
  if (!raw) return NAME_MAP.default;

  // 2) Exact mapping
  if (NAME_MAP[raw]) return NAME_MAP[raw];

  // 3) Normalized mapping
  const norm = normalizeKey(raw);
  if (NAME_MAP_NORM[norm]) return NAME_MAP_NORM[norm];

  // 4) Base name mapping (strip suffix)
  const base = raw.replace(/(_\d+|\.\d+)?$/g, '');
  const baseNorm = normalizeKey(base);
  if (NAME_MAP_NORM[baseNorm]) return NAME_MAP_NORM[baseNorm];

  // 5) Prefix match (useful if Blender exports "Turbo_hose_01" etc.)
  for (const key in NAME_MAP) {
    if (key === 'default') continue;
    const nk = normalizeKey(key);
    if (nk && norm.startsWith(nk)) return NAME_MAP[key];
  }

  // 6) Heuristic guess
  const guessed = aiGuessName(mesh);
  if (guessed && guessed !== NAME_MAP.default) return guessed;

  // 7) Humanized raw fallback
  return humanizeFallback(raw) || NAME_MAP.default;
}

export function prettyFromNodeName(nodeName) {
  const raw = (nodeName || '').trim();
  if (!raw) return '(unnamed)';

  // exact
  const exact = NAME_MAP[raw];
  if (exact) return exact;

  // normalized
  const norm = normalizeKey(raw);
  const mapped = NAME_MAP_NORM[norm];
  if (mapped) return mapped;

  // heuristic (node names can be group names too)
  const guessed = aiGuessName(raw);
  if (guessed && guessed !== NAME_MAP.default) return guessed;

  // fallback formatting
  return humanizeFallback(raw);
}
