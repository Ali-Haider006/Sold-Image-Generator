/* ------------------------------------------------------------------
   templates.js — the four layouts
   ------------------------------------------------------------------
   Each renderer receives design-space dimensions (W, H) and paints in
   design px. `k` scales the user's authored sizes so a layout keeps its
   proportions from a 1200x800 link card to a 1080x1920 story.

   Every layout has a landscape and a portrait arrangement: a side-by-side
   split that works on a 3:2 card becomes an unreadable sliver at 4:5, so
   the regions stack instead. `text stacks` are built once and either
   measured or drawn, which is what makes centring them cheap.

   Renderers also declare:
     defaults    — the logo treatment that suits the layout
     surfaces    — light/dark background per text role, for palette mapping
     displayFont — the headline face the layout was drawn around
------------------------------------------------------------------- */

import { unit, drawBlock, photo, scrim, rgba, line, chevronPath } from './draw.js';
import { drawLogo, logoGeometry } from './logo.js';

/** Portrait and square canvases stack their regions instead of splitting. */
const isTall = (W, H) => H / W > 1.05;

const placeholder = (ctx, S, x, y, w, h) => {
  ctx.fillStyle = rgba(S.brand.primary, 0.3);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(S.brand.light, 0.55);
  ctx.textAlign = 'center';
  ctx.font = `600 ${Math.round(Math.min(w, h) * 0.05)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('Add a boat photo', x + w / 2, y + h / 2);
  ctx.textAlign = 'left';
};

/**
 * Lay out a sequence of text blocks and accent rules in one column.
 *
 * Items are `{ text, spec, gap }` or `{ rule: true, gap }`. Running it with
 * `measureOnly` gives the total height, so the caller can centre the stack
 * before drawing it for real.
 */
function textStack(ctx, S, items, opts) {
  const { x, y = 0, maxWidth, scale, align = 'left', measureOnly = false } = opts;
  let cy = y;

  for (const it of items) {
    if (it.rule) {
      if (!S.rule.show) continue;
      const w = S.rule.width * scale, t = S.rule.thickness * scale;
      if (!measureOnly) {
        const rx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
        line(ctx, rx, cy, w, t, S.rule.color);
      }
      cy += t + (it.gap || 0);
    } else {
      if (!String(it.text || '').trim()) continue;
      const b = drawBlock(ctx, it.text, it.spec, { x, y: cy, maxWidth, scale, align, measureOnly });
      cy += b.height + (it.gap || 0);
    }
  }
  return { height: cy - y, bottom: cy };
}

/** Measure a stack, then draw it centred on `cy`. */
function centredStack(ctx, S, items, opts, cy) {
  const { height } = textStack(ctx, S, items, { ...opts, measureOnly: true });
  return textStack(ctx, S, items, { ...opts, y: cy - height / 2 });
}

/* ================================================================
   1. BOLD LEFT — oversized headline over a photo faded into the brand
   ================================================================ */
function boldLeft(ctx, S, A, W, H) {
  const k = unit(W, H);
  const tall = isTall(W, H);

  ctx.fillStyle = S.brand.dark;
  ctx.fillRect(0, 0, W, H);
  if (A.boat) photo(ctx, A.boat, S.photo, 0, 0, W, H);
  else placeholder(ctx, S, 0, 0, W, H);

  const items = [
    { text: S.text.kicker, spec: S.type.display, gap: H * (tall ? 0.028 : 0.045) },
    { rule: true, gap: H * (tall ? 0.032 : 0.055) },
    { text: S.text.model, spec: S.type.model, gap: H * (tall ? 0.028 : 0.05) },
    { text: S.text.tagline, spec: S.type.tagline }
  ];

  if (tall) {
    // Stacked: the type sits along the bottom under a rising scrim.
    scrim(ctx, 0, 0, W, H, S.brand.dark, S.photo.scrimStrength, 'bottom', 0.68);
    scrim(ctx, 0, 0, W, H, S.brand.dark, S.photo.scrimStrength * 0.35, 'left', 0.55);
    const x = W * 0.075;
    const { height } = textStack(ctx, S, items, { x, maxWidth: W * 0.85, scale: k, measureOnly: true });
    textStack(ctx, S, items, { x, y: H - H * 0.085 - height, maxWidth: W * 0.85, scale: k });
  } else {
    scrim(ctx, 0, 0, W, H, S.brand.dark, S.photo.scrimStrength, 'left', 0.70);
    textStack(ctx, S, items, { x: W * 0.062, y: H * 0.10, maxWidth: W * 0.44, scale: k });
  }

  drawLogo(ctx, S, W, H, A.logo);
}
boldLeft.defaults = { position: 'bottom-right', wrapper: { shape: 'circle', bleed: 'corner' } };
boldLeft.surfaces = { display: 'dark', script: 'dark', model: 'dark', tagline: 'dark', spec: 'light' };
boldLeft.displayFont = 'Anton';

/* ================================================================
   2. CHEVRON SPLIT — script headline on a light panel beside the photo
   ================================================================ */
function diagonalSplit(ctx, S, A, W, H) {
  const k = unit(W, H);
  const tall = isTall(W, H);

  ctx.fillStyle = S.brand.light;
  ctx.fillRect(0, 0, W, H);

  const items = [
    { text: S.text.script, spec: S.type.script, gap: H * 0.055 },
    { text: S.text.model, spec: S.type.model, gap: H * 0.04 },
    { rule: true, gap: H * 0.04 },
    { text: S.text.tagline, spec: S.type.tagline }
  ];

  /** Paint the photo region plus the two accent wedges along its edge. */
  const wedges = (path) => {
    ctx.fillStyle = S.brand.primary;
    path(2); ctx.fill();
    ctx.fillStyle = rgba(S.brand.secondary, 0.9);
    path(1); ctx.fill();
    ctx.save();
    path(0); ctx.clip();
  };

  if (tall) {
    // Photo on top, chevron biting downwards into the panel below it.
    const splitY = H * 0.54;
    const notch = H * 0.05;
    const band = H * 0.016;
    wedges(i => {
      const yy = splitY + band * i;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, yy);
      ctx.lineTo(W / 2, yy + notch); ctx.lineTo(0, yy);
      ctx.closePath();
    });
    if (A.boat) photo(ctx, A.boat, S.photo, 0, 0, W, splitY + notch);
    else placeholder(ctx, S, 0, 0, W, splitY + notch);
    ctx.restore();

    centredStack(ctx, S, items,
      { x: W * 0.075, maxWidth: W * 0.85, scale: k },
      splitY + notch + (H - splitY - notch) / 2);
  } else {
    const split = W * 0.47;
    const notch = W * 0.075;
    const band = W * 0.022;
    wedges(i => chevronPath(ctx, split - band * i, 0, W - split + band * i, H, notch));
    if (A.boat) photo(ctx, A.boat, S.photo, split, 0, W - split, H);
    else placeholder(ctx, S, split, 0, W - split, H);
    ctx.restore();

    centredStack(ctx, S, items,
      { x: W * 0.065, maxWidth: split - notch * 0.5 - W * 0.12, scale: k }, H / 2);
  }

  drawLogo(ctx, S, W, H, A.logo);
}
diagonalSplit.defaults = { position: 'top-right', wrapper: { shape: 'shield', bleed: 'none' } };
diagonalSplit.surfaces = { display: 'light', script: 'light', model: 'light', tagline: 'light', spec: 'light' };
diagonalSplit.displayFont = 'Montserrat';

/* ================================================================
   3. FULL BLEED — corner tag over the photo, footer bar for the details
   ================================================================ */
function fullBleed(ctx, S, A, W, H) {
  const k = unit(W, H);
  const tall = isTall(W, H);

  if (A.boat) photo(ctx, A.boat, S.photo, 0, 0, W, H);
  else placeholder(ctx, S, 0, 0, W, H);

  const barH = H * (tall ? 0.20 : 0.185);
  const barY = H - barH;

  scrim(ctx, 0, barY - H * 0.16, W, H * 0.16, S.brand.dark, S.photo.scrimStrength * 0.7, 'bottom', 1);
  ctx.fillStyle = S.brand.dark;
  ctx.fillRect(0, barY, W, barH);

  // Top-left tag, sized to its own text.
  const pad = W * 0.035;
  const tag = drawBlock(ctx, S.text.script, S.type.script,
    { scale: k, maxWidth: W * (tall ? 0.72 : 0.42), measureOnly: true });
  ctx.fillStyle = rgba(S.brand.dark, 0.94);
  ctx.fillRect(0, 0, tag.width + pad * 2, tag.height + pad * 1.5);
  drawBlock(ctx, S.text.script, S.type.script, {
    x: pad, y: (tag.height + pad * 1.5) / 2, baseline: 'middle',
    scale: k, maxWidth: W * (tall ? 0.72 : 0.42)
  });

  // The badge sits on top of the bar, so the footer text stops short of it.
  const fx = W * 0.055;
  const mid = barY + barH / 2;
  const geo = A.logo ? logoGeometry(S, W, H, A.logo) : null;
  const overlapsBar = geo && geo.wrapper.y + geo.wrapper.h > barY && geo.wrapper.x + geo.wrapper.w > W * 0.4;
  const guard = overlapsBar ? geo.wrapper.x - W * 0.03 : W * 0.95;

  if (tall) {
    // Too narrow for a side-by-side footer — stack the two lines instead.
    centredStack(ctx, S, [
      { text: S.text.model, spec: S.type.model, gap: barH * 0.12 },
      { text: S.text.tagline, spec: S.type.tagline }
    ], { x: fx, maxWidth: Math.max(W * 0.2, guard - fx), scale: k }, mid);
  } else {
    const model = drawBlock(ctx, S.text.model, S.type.model, {
      x: fx, y: mid, baseline: 'middle', scale: k, maxWidth: Math.min(W * 0.4, guard - fx)
    });
    const dx = Math.max(model.x + model.width + W * 0.05, W * 0.40);
    const tagX = dx + W * 0.04;
    const tagMaxW = guard - tagX;

    if (tagMaxW > W * 0.08) {
      if (S.rule.show) {
        ctx.fillStyle = rgba(S.brand.light, 0.45);
        ctx.fillRect(dx, mid - barH * 0.22, Math.max(1, S.rule.thickness * k * 0.4), barH * 0.44);
      }
      drawBlock(ctx, S.text.tagline, S.type.tagline, {
        x: tagX, y: mid, baseline: 'middle', scale: k, maxWidth: tagMaxW
      });
    }
  }

  drawLogo(ctx, S, W, H, A.logo);
}
fullBleed.defaults = { position: 'bottom-right', wrapper: { shape: 'circle', bleed: 'none' } };
fullBleed.surfaces = { display: 'dark', script: 'dark', model: 'dark', tagline: 'dark', spec: 'light' };
fullBleed.displayFont = 'Anton';

/* ================================================================
   4. EDITORIAL — headline column, photo, and a spec strip
   ================================================================ */
function editorial(ctx, S, A, W, H) {
  const k = unit(W, H);
  const tall = isTall(W, H);
  const stripH = H * (tall ? 0.115 : 0.155);

  ctx.fillStyle = S.brand.primary;
  ctx.fillRect(0, 0, W, H);

  // Photo region: right-hand column when wide, a top band when tall.
  const pr = tall
    ? { x: 0, y: 0, w: W, h: H * 0.42 }
    : { x: W * 0.44, y: 0, w: W * 0.56, h: H - stripH };

  ctx.save();
  ctx.beginPath();
  ctx.rect(pr.x, pr.y, pr.w, pr.h);
  ctx.clip();
  if (A.boat) photo(ctx, A.boat, S.photo, pr.x, pr.y, pr.w, pr.h);
  else placeholder(ctx, S, pr.x, pr.y, pr.w, pr.h);
  ctx.restore();

  // Spec strip: under the photo when wide, across the foot when tall.
  const strip = tall
    ? { x: 0, y: H - stripH, w: W }
    : { x: W * 0.44, y: H - stripH, w: W * 0.56 };

  const specs = (S.text.specs || []).filter(s => s.label || s.value);
  if (specs.length) {
    ctx.fillStyle = S.brand.light;
    ctx.fillRect(strip.x, strip.y, strip.w, stripH);

    const cellW = strip.w / specs.length;
    const labelSpec = { ...S.type.spec, size: S.type.spec.size * 0.82, color: rgba(S.brand.primary, 0.55) };
    const valueSpec = { ...S.type.spec, weight: 500, transform: 'none', tracking: 0, size: S.type.spec.size * 1.05 };

    specs.forEach((s, i) => {
      const cx = strip.x + cellW * i;
      if (i > 0) {
        ctx.fillStyle = rgba(S.brand.primary, 0.18);
        ctx.fillRect(cx, strip.y + stripH * 0.28, 1, stripH * 0.44);
      }
      drawBlock(ctx, s.label, labelSpec,
        { x: cx + cellW / 2, y: strip.y + stripH * 0.38, baseline: 'middle', align: 'center', scale: k, maxWidth: cellW * 0.86 });
      drawBlock(ctx, s.value, valueSpec,
        { x: cx + cellW / 2, y: strip.y + stripH * 0.70, baseline: 'middle', align: 'center', scale: k, maxWidth: cellW * 0.86 });
    });
  }

  // Editorial text column.
  const x = W * 0.055;
  const maxW = (tall ? W : W * 0.44) - W * 0.11;

  const head = [
    { text: S.text.kicker, spec: S.type.display, gap: H * (tall ? 0.035 : 0.055) },
    { rule: true, gap: H * 0.035 },
    { text: S.text.tagline, spec: S.type.tagline }
  ];

  if (tall) {
    const top = pr.y + pr.h;
    const bottom = H - stripH;
    drawBlock(ctx, S.text.model, S.type.model,
      { x, y: top + H * 0.05, maxWidth: maxW, scale: k });
    centredStack(ctx, S, head, { x, maxWidth: maxW, scale: k }, (top + bottom) / 2 + H * 0.045);
  } else {
    drawBlock(ctx, S.text.model, S.type.model, { x, y: H * 0.09, maxWidth: maxW, scale: k });
    centredStack(ctx, S, head, { x, maxWidth: maxW, scale: k }, H / 2);
  }

  drawLogo(ctx, S, W, H, A.logo);
}
editorial.defaults = { position: 'top-right', wrapper: { shape: 'shield', bleed: 'none' } };
editorial.surfaces = { display: 'dark', script: 'dark', model: 'dark', tagline: 'dark', spec: 'light' };
editorial.displayFont = 'Playfair Display';

export const RENDERERS = {
  'bold-left': boldLeft,
  'diagonal-split': diagonalSplit,
  'full-bleed': fullBleed,
  'editorial': editorial
};

/**
 * Paint a full design.
 * @param ctx  2D context already scaled for the export factor
 * @param S    settings
 * @param A    {boat, logo} loaded HTMLImageElements (either may be null)
 */
export function renderDesign(ctx, S, A, W, H) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  (RENDERERS[S.template] || boldLeft)(ctx, S, A, W, H);
  ctx.restore();
}
