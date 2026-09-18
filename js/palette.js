/* ------------------------------------------------------------------
   palette.js — pull a brand palette out of an uploaded logo
   ------------------------------------------------------------------
   Logos are flat art, so a full k-means is overkill: bucket the pixels in
   a coarse RGB grid, merge buckets that sit close together, then score the
   survivors. Scoring is what separates "the ten colours present" from
   "the brand colours" — a big field of near-white is common in logos but
   is almost never the brand colour.
------------------------------------------------------------------- */

const SAMPLE_EDGE = 140;   // logo is downscaled to this before sampling
const GRID = 5;            // bits dropped per channel when bucketing (32 levels)
const MERGE_DIST = 46;     // RGB distance below which two swatches are "the same"

/* ---------- colour space helpers ---------- */

export const hex = ({ r, g, b }) =>
  '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16).padStart(2, '0')).join('');

export function parseHex(h) {
  const s = String(h).replace('#', '').trim();
  const full = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0
  };
}

/** Relative luminance, 0 (black) .. 1 (white). */
export const luminance = ({ r, g, b }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Chroma: how far a colour is from grey, 0 .. 1.
 *
 * HSL saturation is the wrong yardstick for deciding whether something is a
 * brand colour, because it rises as a colour gets darker — a near-black navy
 * scores 0.385, higher than plenty of obvious greys. Chroma does not have
 * that bias, so it can actually separate a teal from a blue-grey blend.
 */
export const chroma = ({ r, g, b }) =>
  (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

/** HSL saturation, 0 (grey) .. 1 (pure hue). */
export function saturation({ r, g, b }) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
  const l = (mx + mn) / 2;
  if (mx === mn) return 0;
  return l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
}

export function hue({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  if (!d) return 0;
  let h;
  if (mx === R) h = ((G - B) / d) % 6;
  else if (mx === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return (h * 60 + 360) % 360;
}

const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

/** Mix two colours; t=0 returns a, t=1 returns b. */
export const mix = (a, b, t) => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t
});

export const shade = (h, t) => hex(mix(parseHex(h), { r: 0, g: 0, b: 0 }, t));
export const tint  = (h, t) => hex(mix(parseHex(h), { r: 255, g: 255, b: 255 }, t));

/** Pick whichever of black/white reads better on `background`. */
export function readableOn(background, dark = '#101820', light = '#ffffff') {
  return luminance(parseHex(background)) > 0.55 ? dark : light;
}

/* ---------- extraction ---------- */

function sample(image) {
  const scale = Math.min(SAMPLE_EDGE / image.width, SAMPLE_EDGE / image.height, 1);
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/**
 * @param {HTMLImageElement} image  the loaded logo
 * @returns {{swatches:Array, roles:Object}} swatches are ordered most-brandy
 *          first; roles is a ready-to-apply {primary, secondary, dark, light, accent}.
 */
export function extractPalette(image) {
  const data = sample(image);
  const buckets = new Map();

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;                       // transparent logo backdrop
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> GRID) << 10 | (g >> GRID) << 5 | (b >> GRID);
    const e = buckets.get(key);
    if (e) { e.r += r; e.g += g; e.b += b; e.n++; }
    else buckets.set(key, { r, g, b, n: 1 });
  }

  let list = [...buckets.values()]
    .map(e => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, n: e.n }))
    .sort((a, b) => b.n - a.n);

  const total = list.reduce((s, c) => s + c.n, 0) || 1;

  // Merge visually identical buckets into their most populous neighbour.
  const merged = [];
  for (const c of list) {
    const near = merged.find(m => dist(m, c) < MERGE_DIST);
    if (near) {
      const n = near.n + c.n;
      near.r = (near.r * near.n + c.r * c.n) / n;
      near.g = (near.g * near.n + c.g * c.n) / n;
      near.b = (near.b * near.n + c.b * c.n) / n;
      near.n = n;
    } else merged.push({ ...c });
  }

  const swatches = merged.map(c => {
    const share = c.n / total;
    const sat = saturation(c);
    const lum = luminance(c);
    // Weight by how much of the logo it covers, but discount the paper-white
    // and pure-black extremes that carry no brand identity of their own.
    const extremity = lum > 0.94 ? 0.12 : lum < 0.05 ? 0.3 : 1;
    return {
      hex: hex(c), r: c.r, g: c.g, b: c.b, share, sat, lum,
      chroma: chroma(c), hue: hue(c),
      score: share * extremity * (0.45 + sat * 1.35)
    };
  }).sort((a, b) => b.score - a.score).slice(0, 10);

  return { swatches, roles: deriveRoles(swatches) };
}

/**
 * Map raw swatches onto the semantic slots the templates actually consume.
 * Everything has a fallback so a one-colour logo still yields a usable set.
 */
function deriveRoles(swatches) {
  if (!swatches.length) {
    return { primary: '#0f2044', secondary: '#12b5b0', dark: '#0a1730', light: '#ffffff', accent: '#9fb0c9' };
  }
  const mid = swatches.filter(s => s.lum > 0.05 && s.lum < 0.94);
  const pool = mid.length ? mid : swatches;

  // Primary: the highest-scoring colour that is not near-white.
  const primary = pool[0];

  // Secondary: the accent colour. Favour saturation and coverage, and
  // heavily discount anything sitting right next to the primary — otherwise
  // a navy logo hands back a second, slightly different navy.
  //
  // A candidate must also be a real colour. Plenty of dealer logos are one
  // navy on transparency, and the runner-up there is the paper white or a
  // grey edge blend: handing that back as the brand accent paints rules and
  // script in near-white, which reads as the accent having vanished.
  const usable = pool.slice(1).filter(s =>
    s.chroma > 0.18 && s.lum > 0.12 && s.lum < 0.88);
  const secondary = usable
    .map(s => ({
      s,
      w: s.sat * (0.35 + Math.sqrt(s.share)) * (dist(s, primary) > 70 ? 1 : 0.2)
    }))
    .sort((a, b) => b.w - a.w)[0]?.s;

  const dark = [...swatches].sort((a, b) => a.lum - b.lum)[0];
  const light = [...swatches].sort((a, b) => b.lum - a.lum)[0];

  return {
    primary: primary.hex,
    secondary: secondary ? secondary.hex : tint(primary.hex, 0.45),
    dark: dark.lum < 0.3 ? dark.hex : shade(primary.hex, 0.45),
    light: light.lum > 0.8 ? light.hex : '#ffffff',
    accent: tint(primary.hex, 0.6),
    // No second brand colour exists in this logo. Designs use this to keep
    // their own specified accent rather than take an invented one.
    monochrome: !secondary
  };
}
