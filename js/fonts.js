/* ------------------------------------------------------------------
   fonts.js — curated web-font catalogue + on-demand Google Fonts loader
   ------------------------------------------------------------------
   The generator draws onto a <canvas>, and canvas will silently fall back
   to a default face if a family has not finished loading. Everything that
   touches type therefore goes through ensureFont() first.
------------------------------------------------------------------- */

export const FONT_CATALOG = {
  display: [
    'Anton', 'Archivo Black', 'Bebas Neue', 'Montserrat', 'Poppins',
    'Oswald', 'Barlow Condensed', 'Outfit', 'Manrope', 'Inter',
    'Playfair Display', 'DM Serif Display', 'Cormorant Garamond', 'Prata'
  ],
  text: [
    'Inter', 'Montserrat', 'Poppins', 'Lato', 'Open Sans', 'Raleway',
    'Manrope', 'Outfit', 'Work Sans', 'Roboto Condensed', 'Barlow',
    'Source Sans 3', 'Nunito Sans'
  ],
  script: [
    'Great Vibes', 'Dancing Script', 'Sacramento', 'Allura', 'Parisienne',
    'Yellowtail', 'Pacifico', 'Petit Formal Script'
  ]
};

/** Every family we may ever hand to the canvas, de-duplicated. */
export const ALL_FAMILIES = [...new Set(
  [...FONT_CATALOG.display, ...FONT_CATALOG.text, ...FONT_CATALOG.script]
)].sort();

const WEIGHTS = '300;400;500;600;700;800;900';
const loaded = new Map(); // family -> Promise<boolean>

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
 * callers can carry on with the stack fallback instead of hanging.
 */
export function ensureFont(family, weights = [400, 700, 800]) {
  if (!family) return Promise.resolve(false);
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

/** Warm up everything a template might need before the first paint. */
export function preloadFonts(families) {
  return Promise.all([...new Set(families)].map(f => ensureFont(f)));
}

/** Canvas/CSS font stack with sane fallbacks per family kind. */
export function stack(family) {
  if (FONT_CATALOG.script.includes(family)) return `"${family}", cursive`;
  if (/Serif|Playfair|Cormorant|Prata|Garamond/i.test(family)) return `"${family}", Georgia, serif`;
  return `"${family}", "Helvetica Neue", Arial, sans-serif`;
}
