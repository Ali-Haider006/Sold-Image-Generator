/* ------------------------------------------------------------------
   fonts.js — font catalogue, licensed-font handling, on-demand loading
   ------------------------------------------------------------------
   The generator draws onto a <canvas>, and canvas silently falls back to a
   default face if a family has not finished loading, so everything that
   touches type goes through ensureFont() first.

   Two of the specified faces — Intro Rust and Breathing — are commercial
   and cannot be fetched from any CDN. They are declared here with a free
   stand-in each. The font stack always lists the real name FIRST, so the
   moment the licensed file is uploaded the output becomes exact with no
   other change.
------------------------------------------------------------------- */

/** Commercial faces: name -> the free face we render with until it's uploaded. */
export const LICENSED_FONTS = {
  'Intro Rust': { substitute: 'Archivo Black', kind: 'display' },
  'Breathing':  { substitute: 'Kaushan Script', kind: 'script' }
};

export const FONT_CATALOG = {
  display: [
    'Intro Rust', 'Anton', 'Archivo Black', 'Bebas Neue', 'Montserrat',
    'Poppins', 'Oswald', 'Barlow Condensed', 'Outfit', 'Manrope', 'Inter',
    'Playfair Display', 'DM Serif Display', 'Cormorant Garamond', 'Prata'
  ],
  text: [
    'Montserrat', 'Inter', 'Poppins', 'Lato', 'Open Sans', 'Raleway',
    'Manrope', 'Outfit', 'Work Sans', 'Roboto Condensed', 'Barlow',
    'Source Sans 3', 'Nunito Sans'
  ],
  script: [
    'Breathing', 'Kaushan Script', 'Great Vibes', 'Dancing Script',
    'Sacramento', 'Allura', 'Parisienne', 'Yellowtail', 'Pacifico',
    'Petit Formal Script'
  ]
};

/** Every family we may hand to the canvas, minus the ones we cannot fetch. */
export const ALL_FAMILIES = [...new Set(
  [...FONT_CATALOG.display, ...FONT_CATALOG.text, ...FONT_CATALOG.script]
)].filter(f => !LICENSED_FONTS[f]).sort();

const WEIGHTS = '300;400;500;600;700;800;900';
const loaded = new Map();        // family -> Promise<boolean>
const uploaded = new Map();      // family -> dataURL of a licensed file

/* ---------- custom (uploaded) faces ---------- */

/**
 * Register a licensed font file the user supplied.
 * @param {string} family  the real family name, e.g. 'Intro Rust'
 * @param {string} dataURL the font file as a data: URL
 */
export async function registerUploadedFont(family, dataURL) {
  const face = new FontFace(family, `url("${dataURL}")`);
  await face.load();
  document.fonts.add(face);
  uploaded.set(family, dataURL);
  loaded.set(family, Promise.resolve(true));
  return true;
}

export const hasUploadedFont = family => uploaded.has(family);
export const uploadedFontData = family => uploaded.get(family) || null;

/* ---------- Google Fonts ---------- */

function injectLink(family) {
  const id = 'gf-' + family.replace(/\s+/g, '-').toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' +
    encodeURIComponent(family).replace(/%20/g, '+') +
    ':wght@' + WEIGHTS + '&display=swap';
  document.head.appendChild(link);
}

/**
 * Load a family and resolve once the browser can actually paint it.
 * Resolves `false` when the font never arrives (offline, blocked CDN) so
 * callers carry on with the fallback stack instead of hanging.
 */
export function ensureFont(family, weights = [400, 700, 800]) {
  if (!family) return Promise.resolve(false);
  if (uploaded.has(family)) return Promise.resolve(true);

  // A commercial face that has not been uploaded: load its stand-in instead.
  const lic = LICENSED_FONTS[family];
  if (lic) return ensureFont(lic.substitute, weights);

  if (loaded.has(family)) return loaded.get(family);
  injectLink(family);

  const probes = weights.map(w =>
    document.fonts.load(`${w} 64px "${family}"`).catch(() => null)
  );
  const timeout = new Promise(res => setTimeout(() => res('timeout'), 4000));
  const p = Promise.race([Promise.all(probes), timeout])
    .then(r => r !== 'timeout')
    .catch(() => false);

  loaded.set(family, p);
  return p;
}

export function preloadFonts(families) {
  return Promise.all([...new Set(families)].map(f => ensureFont(f)));
}

/**
 * CSS/canvas font stack. A licensed family is listed ahead of its stand-in,
 * so an uploaded file wins automatically and nothing else has to change.
 */
export function stack(family) {
  const lic = LICENSED_FONTS[family];
  if (lic) return `"${family}", ${stack(lic.substitute)}`;
  if (FONT_CATALOG.script.includes(family)) return `"${family}", cursive`;
  if (/Serif|Playfair|Cormorant|Prata|Garamond/i.test(family)) return `"${family}", Georgia, serif`;
  return `"${family}", "Helvetica Neue", Arial, sans-serif`;
}

/** What the user is actually seeing for a family, for UI labelling. */
export function resolvedFace(family) {
  if (uploaded.has(family)) return { family, exact: true };
  const lic = LICENSED_FONTS[family];
  if (lic) return { family: lic.substitute, exact: false };
  return { family, exact: true };
}
