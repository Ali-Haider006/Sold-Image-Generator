/* ------------------------------------------------------------------
   draw.js — canvas primitives shared by every template
   ------------------------------------------------------------------
   Templates never touch the raw 2D context for anything fiddly: text
   tracking, cover-fit images, badge shapes and scrims all live here so the
   four layouts stay readable and behave identically.
------------------------------------------------------------------- */

import { stack } from './fonts.js';
import { parseHex } from './palette.js';

/** Design reference the user's px values are authored against. */
export const REF_W = 1200, REF_H = 800;

/**
 * Scale factor so a 128px headline keeps its proportions on any canvas.
 *
 * The geometric mean of the two axes rather than `min()`: a 1080x1350 feed
 * post is narrower but much taller than the 1200x800 reference, and scaling
 * by width alone leaves the type looking lost in the frame. Blocks are
 * auto-fitted to their max width anyway, so scaling up cannot overflow.
 */
export const unit = (w, h) => Math.sqrt((w / REF_W) * (h / REF_H));

export const rgba = (hexStr, alpha) => {
  const { r, g, b } = parseHex(hexStr);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;
};

/* ---------- text ---------- */

export function applyTransform(text, transform) {
  switch (transform) {
    case 'uppercase': return text.toUpperCase();
    case 'lowercase': return text.toLowerCase();
    case 'capitalize': return text.replace(/\b\p{L}/gu, c => c.toUpperCase());
    default: return text;
  }
}

export function setFont(ctx, spec, size) {
  ctx.font = `${spec.weight || 400} ${size}px ${stack(spec.family)}`;
}

/** Width of `text` once per-character tracking is added. */
export function measureTracked(ctx, text, tracking) {
  const chars = [...text];
  if (!chars.length) return 0;
  let w = 0;
  for (const ch of chars) w += ctx.measureText(ch).width;
  return w + tracking * (chars.length - 1);
}

function fillTracked(ctx, text, x, y, tracking) {
  if (!tracking) { ctx.fillText(text, x, y); return; }
  let cx = x;
  for (const ch of [...text]) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

/**
 * Draw a (possibly multi-line) text block.
 *
 * Sizes arrive in design px and are multiplied by `scale`. When `maxWidth`
 * is given the whole block is shrunk to fit in a single exact pass —
 * tracking scales with the type, so the relationship stays linear.
 *
 * @returns {{x,y,width,height,bottom,size}} the laid-out box, for stacking.
 */
export function drawBlock(ctx, text, spec, opts = {}) {
  const {
    x = 0, y = 0, align = 'left', maxWidth = Infinity,
    scale = 1, color, measureOnly = false, baseline = 'top'
  } = opts;

  const rows = String(text ?? '').split('\n')
    .map(l => applyTransform(l, spec.transform))
    .filter((l, i, a) => l.trim() !== '' || (i > 0 && i < a.length - 1));

  if (!rows.length) return { x, y, width: 0, height: 0, bottom: y, size: 0 };

  let size = spec.size * scale;
  let tracking = (spec.tracking || 0) * scale;

  setFont(ctx, spec, size);
  let widest = Math.max(...rows.map(r => measureTracked(ctx, r, tracking)));

  if (widest > maxWidth && widest > 0) {
    const f = maxWidth / widest;
    size *= f; tracking *= f; widest = maxWidth;
    setFont(ctx, spec, size);
  }

  const lh = size * (spec.lineHeight || 1.2);
  const m = ctx.measureText(rows[0]);
  const ascent = m.actualBoundingBoxAscent || size * 0.78;
  const descent = ctx.measureText(rows[rows.length - 1]).actualBoundingBoxDescent || size * 0.2;
  const height = ascent + lh * (rows.length - 1) + descent;

  let top = y;
  if (baseline === 'middle') top = y - height / 2;
  else if (baseline === 'bottom') top = y - height;

  if (!measureOnly) {
    ctx.save();
    ctx.fillStyle = color || spec.color;
    ctx.textBaseline = 'alphabetic';
    rows.forEach((row, i) => {
      const w = measureTracked(ctx, row, tracking);
      const rx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
      fillTracked(ctx, row, rx, top + ascent + lh * i, tracking);
    });
    ctx.restore();
  }

  const bx = align === 'center' ? x - widest / 2 : align === 'right' ? x - widest : x;
  return { x: bx, y: top, width: widest, height, bottom: top + height, size };
}

/* ---------- images ---------- */

/** object-fit: cover, with a focal point and extra zoom. */
export function cover(ctx, img, x, y, w, h, focusX = 0.5, focusY = 0.5, zoom = 1) {
  if (!img) return;
  const ir = img.naturalWidth / img.naturalHeight;
  let dw = w, dh = h;
  if (ir > w / h) { dh = h; dw = dh * ir; } else { dw = w; dh = dw / ir; }
  dw *= zoom; dh *= zoom;
  ctx.drawImage(img, x + (w - dw) * focusX, y + (h - dh) * focusY, dw, dh);
}

/** object-fit: contain — used for the logo, which must never be cropped. */
export function contain(ctx, img, x, y, w, h) {
  if (!img) return;
  const ir = img.naturalWidth / img.naturalHeight;
  let dw = w, dh = w / ir;
  if (dh > h) { dh = h; dw = h * ir; }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export const filterString = p =>
  `brightness(${p.brightness}) contrast(${p.contrast}) saturate(${p.saturate})`;

/** Photo + optional flat tint, clipped to whatever path is already set. */
export function photo(ctx, img, p, x, y, w, h) {
  ctx.save();
  ctx.filter = filterString(p);
  cover(ctx, img, x, y, w, h, p.focusX, p.focusY, p.zoom);
  ctx.filter = 'none';
  if (p.overlayOpacity > 0) {
    ctx.fillStyle = rgba(p.overlay, p.overlayOpacity);
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/**
 * Directional gradient scrim so light type stays legible over a photo.
 * Eased with extra stops — a two-stop linear gradient reads as a visible band.
 *
 * `hold` (0..1 of the reach) keeps the scrim fully opaque before it starts to
 * fall off, which is what separates a soft vignette from a solid colour panel
 * that dissolves into the photo.
 */
export function scrim(ctx, x, y, w, h, color, strength, dir = 'left', reach = 0.62, hold = 0) {
  if (strength <= 0) return;
  const [x0, y0, x1, y1] = {
    left: [x, y, x + w * reach, y],
    right: [x + w, y, x + w * (1 - reach), y],
    top: [x, y, x, y + h * reach],
    bottom: [x, y + h, x, y + h * (1 - reach)]
  }[dir];
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const k = Math.max(0, Math.min(0.9, hold));
  const at = t => k + (1 - k) * t;
  [[0, 1], [k, 1], [at(0.35), 0.82], [at(0.6), 0.45], [at(0.82), 0.14], [1, 0]]
    .forEach(([stop, a]) => g.addColorStop(Math.min(1, stop), rgba(color, a * strength)));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/**
 * Photo region bounded on its left by a straight diagonal or a left-pointing
 * chevron. `topX`/`midX`/`bottomX` are fractions of the canvas width.
 */
export function dividerPath(ctx, W, H, d, shift = 0) {
  const top = (d.topX + shift) * W;
  const bottom = (d.bottomX + shift) * W;
  ctx.beginPath();
  ctx.moveTo(top, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, H);
  ctx.lineTo(bottom, H);
  if (d.style === 'chevron') ctx.lineTo((d.midX + shift) * W, H / 2);
  ctx.closePath();
}

/* ---------- shapes ---------- */

export function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Rounded top, tapered point at the bottom — the classic dealer badge. */
export function shieldPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2));
  const shoulder = y + h * 0.55;
  ctx.beginPath();
  ctx.moveTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, shoulder);
  ctx.bezierCurveTo(x + w, y + h * 0.88, x + w * 0.74, y + h, x + w / 2, y + h);
  ctx.bezierCurveTo(x + w * 0.26, y + h, x, y + h * 0.88, x, shoulder);
  ctx.closePath();
}

export function circlePath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

/** Chevron-edged panel: a ">" notch bites `notch` px into the left edge. */
export function chevronPath(ctx, x, y, w, h, notch) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + notch, y + h / 2);
  ctx.closePath();
}

export function line(ctx, x, y, w, thickness, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, thickness);
}
