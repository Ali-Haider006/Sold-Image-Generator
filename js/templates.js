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

import {
  unit, drawBlock, photo, scrim, rgba, line, chevronPath, dividerPath
} from './draw.js';
import { drawLogo, logoGeometry, pickLogo } from './logo.js';

/** Portrait and square canvases stack their regions instead of splitting. */
const isTall = (W, H) => H / W > 1.05;

/* ---------- draggable text ----------
   The editor needs to know where each text block landed so a pointer can
   grab it. Boxes are only collected when the caller asks, so gallery
   thumbnails and exports do not disturb the editor's hit map.            */

let HITS = [];
let TRACK = false;
export const textHitBoxes = () => HITS;

/**
 * Draw one text block with its per-text nudge applied.
 *
 * The returned geometry is deliberately the UN-nudged layout position: a
 * nudge moves only that block, it never pushes the blocks stacked after it.
 */
function block(ctx, S, role, text, spec, opts, W, H) {
  const o = (S.offsets && S.offsets[role]) || { x: 0, y: 0 };
  const dx = o.x * W, dy = o.y * H;
  const box = drawBlock(ctx, text, spec, {
    ...opts, x: opts.x + dx, y: (opts.y || 0) + dy
  });
  if (TRACK && !opts.measureOnly && box.width > 0) {
    HITS.push({ role, x: box.x, y: box.y, w: box.width, h: box.height });
  }
  return { ...box, x: box.x - dx, y: box.y - dy, bottom: box.bottom - dy };
}

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
      const b = it.role && !measureOnly
        ? block(ctx, S, it.role, it.text, it.spec, { x, y: cy, maxWidth, scale, align }, opts.W, opts.H)
        : drawBlock(ctx, it.text, it.spec, { x, y: cy, maxWidth, scale, align, measureOnly });
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
    scrim(ctx, 0, 0, W, H, S.brand.dark, S.photo.fadeOpacity, 'bottom', 0.68);
    scrim(ctx, 0, 0, W, H, S.brand.dark, S.photo.fadeOpacity * 0.35, 'left', 0.55);
    const x = W * 0.075;
    const { height } = textStack(ctx, S, items, { x, maxWidth: W * 0.85, scale: k, measureOnly: true });
    textStack(ctx, S, items, { x, y: H - H * 0.085 - height, maxWidth: W * 0.85, scale: k, W, H });
  } else {
    scrim(ctx, 0, 0, W, H, S.brand.dark, S.photo.fadeOpacity, 'left', 0.70);
    textStack(ctx, S, items, { x: W * 0.062, y: H * 0.10, maxWidth: W * 0.44, scale: k, W, H });
  }

  drawLogo(ctx, S, W, H, A);
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

  drawLogo(ctx, S, W, H, A);
}
diagonalSplit.defaults = { position: 'top-right', wrapper: { shape: 'shield', bleed: 'none' } };
diagonalSplit.surfaces = { display: 'light', script: 'light', model: 'light', tagline: 'light', spec: 'light' };
diagonalSplit.displayFont = 'Montserrat';

/* ================================================================
   3. FULL BLEED — corner tag over the photo, footer bar for the details
   ================================================================ */
/* ================================================================
   FULL BLEED — photo edge to edge, a solid tag panel, a solid footer bar
   ================================================================
   Both panels are plain rectangles with their own geometry, taken from the
   reference at 1200x800: the tag is 31% x 36.3% flush into the top-left
   corner, the bar is 18.1% of the height across the full width. Neither is
   sized to its text and neither is faded — `panels.fade` is 0 by default, so
   the bar meets the photo on a hard edge.
   ================================================================ */
function fullBleed(ctx, S, A, W, H) {
  const k = unit(W, H);
  const tall = isTall(W, H);
  const P = S.panels;

  if (A.boat) photo(ctx, A.boat, S.photo, 0, 0, W, H);
  else placeholder(ctx, S, 0, 0, W, H);

  const barH = H * (tall ? P.barH * 1.45 : P.barH);
  const barY = H - barH;

  // Optional lift above the bar. The reference has none, so this is off by
  // default and the rectangle keeps a clean edge.
  if (P.fade > 0) {
    scrim(ctx, 0, barY - H * P.fade, W, H * P.fade,
      P.barFill, S.photo.fadeOpacity, 'bottom', 1);
  }

  ctx.fillStyle = rgba(P.barFill, P.barOpacity);
  ctx.fillRect(0, barY, W, barH);

  // Tag panel: a designed rectangle, not a box wrapped around the words.
  const tw = W * P.tagW;
  const th = H * (tall ? P.tagH * 0.8 : P.tagH);
  const tx = W * P.tagX;
  const ty = H * P.tagY;
  ctx.fillStyle = rgba(P.tagFill, P.tagOpacity);
  ctx.fillRect(tx, ty, tw, th);

  block(ctx, S, 'script', S.text.script, S.type.script, {
    x: tx + tw / 2, y: ty + th / 2, align: 'center', baseline: 'middle',
    maxWidth: tw * 0.84, scale: k
  }, W, H);

  const fx = W * 0.046;
  const mid = barY + barH / 2;
  const geo = pickLogo(S, A) ? logoGeometry(S, W, H, pickLogo(S, A)) : null;
  // The badge overlaps the bar, so the footer text stops short of it.
  const guard = geo && geo.wrapper.x > W * 0.5
    ? geo.wrapper.x - W * 0.025
    : W * 0.96;

  if (tall) {
    centredStack(ctx, S, [
      { role: 'model', text: S.text.model, spec: S.type.model, gap: barH * 0.1 },
      { role: 'tagline', text: S.text.tagline, spec: S.type.tagline }
    ], { x: fx, maxWidth: Math.max(W * 0.2, guard - fx), scale: k, W, H }, mid);
  } else {
    const dx = W * P.dividerX;

    block(ctx, S, 'model', S.text.model, S.type.model, {
      x: fx, y: mid, baseline: 'middle', scale: k, maxWidth: dx - fx - W * 0.03
    }, W, H);

    if (S.rule.show) {
      ctx.fillStyle = rgba(S.rule.color, 0.5);
      ctx.fillRect(dx, mid - barH * 0.34,
        Math.max(1, S.rule.thickness * k), barH * 0.68);
    }

    const tagX = dx + W * 0.038;
    block(ctx, S, 'tagline', S.text.tagline, S.type.tagline, {
      x: tagX, y: mid, baseline: 'middle', scale: k,
      maxWidth: Math.max(W * 0.12, guard - tagX)
    }, W, H);
  }

  drawLogo(ctx, S, W, H, A);
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

  drawLogo(ctx, S, W, H, A);
}
editorial.defaults = { position: 'top-right', wrapper: { shape: 'shield', bleed: 'none' } };
editorial.surfaces = { display: 'dark', script: 'dark', model: 'dark', tagline: 'dark', spec: 'light' };
editorial.displayFont = 'Playfair Display';


/**
 * Four label/value columns with hairline dividers.
 *
 * Shared by the editorial layout, which sets it on white, and design 5,
 * which sets it on the navy ground — hence the explicit colours.
 */
function specStrip(ctx, S, k, { x, y, w, h, labelColor, valueColor, dividerColor }) {
  const specs = (S.text.specs || []).filter(sp => sp.label || sp.value);
  if (!specs.length) return;

  const cellW = w / specs.length;
  const labelSpec = { ...S.type.spec, size: S.type.spec.size, color: labelColor };
  const valueSpec = {
    ...S.type.spec, weight: 400, transform: 'none',
    tracking: Math.min(S.type.spec.tracking, 0.4),
    size: S.type.spec.size * 1.02, color: valueColor
  };

  specs.forEach((sp, i) => {
    const cx = x + cellW * i;
    if (i > 0) {
      ctx.fillStyle = dividerColor;
      ctx.fillRect(cx, y + h * 0.26, 1, h * 0.48);
    }
    drawBlock(ctx, sp.label, labelSpec, {
      x: cx + cellW / 2, y: y + h * 0.36, baseline: 'middle',
      align: 'center', scale: k, maxWidth: cellW * 0.88
    });
    drawBlock(ctx, sp.value, valueSpec, {
      x: cx + cellW / 2, y: y + h * 0.68, baseline: 'middle',
      align: 'center', scale: k, maxWidth: cellW * 0.88
    });
  });
}

/* ================================================================
   DESIGN 5 — signature script on navy, photo cut to an angled frame
   ================================================================
   The photo is clipped to a polygon, not a rectangle: a shallow navy band
   across the top left, a diagonal riser, then a much deeper navy field on
   the right that carries the script, the boat name and the badge. A second
   diagonal cuts the spec strip in at the bottom. Every vertex is a setting,
   so the angles can be dialled onto the reference.
   ================================================================ */
function framePath(ctx, W, H, F, tall) {
  ctx.beginPath();
  if (tall) {
    // Stacked: a straight band top and bottom, no diagonals to lose.
    ctx.moveTo(0, H * F.topRight);
    ctx.lineTo(W, H * F.topRight);
    ctx.lineTo(W, H * F.strip);
    ctx.lineTo(0, H * F.strip);
  } else {
    ctx.moveTo(0, H * F.topLeft);
    ctx.lineTo(W * F.riseFrom, H * F.topLeft);
    ctx.lineTo(W * F.riseTo, H * F.topRight);
    ctx.lineTo(W, H * F.topRight);
    ctx.lineTo(W, H * F.strip);
    ctx.lineTo(W * F.stripFrom, H * F.strip);
    ctx.lineTo(W * F.stripTo, H);
    ctx.lineTo(0, H);
  }
  ctx.closePath();
}

function design5(ctx, S, A, W, H) {
  const k = unit(W, H);
  const tall = isTall(W, H);
  const F = S.frame;

  ctx.fillStyle = S.brand.dark;
  ctx.fillRect(0, 0, W, H);

  // Decorative diagonals, drawn across the whole canvas and then covered by
  // the photo — so they survive only in the navy, which is where they belong.
  if (F.stripes > 0 && F.stripeOpacity > 0) {
    ctx.save();
    ctx.strokeStyle = rgba(S.brand.light, F.stripeOpacity);
    ctx.lineWidth = Math.max(1, W * 0.004);
    const lean = (F.riseTo - F.riseFrom) * W;
    const gap = W * 0.055;
    for (let i = 0; i < F.stripes; i++) {
      const off = W * 0.80 + gap * i;
      ctx.beginPath();
      ctx.moveTo(off, H);
      ctx.lineTo(off + lean, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  framePath(ctx, W, H, F, tall);
  ctx.clip();
  if (A.boat) photo(ctx, A.boat, S.photo, 0, 0, W, H);
  else placeholder(ctx, S, 0, 0, W, H);
  ctx.restore();

  // Script and boat name share a right edge; the name hangs below the
  // script's descender rather than at a fixed offset, so a long boat name
  // never collides with a long-tailed signature face.
  const rx = W * F.textRight;
  const script = block(ctx, S, 'script', S.text.script, S.type.script, {
    x: rx, y: H * F.scriptY, align: 'right', baseline: 'middle',
    maxWidth: W * (tall ? 0.86 : 0.64), scale: k
  }, W, H);

  const modelY = Math.max(H * F.modelY, script.bottom + H * 0.018);
  block(ctx, S, 'model', S.text.model, S.type.model, {
    x: rx, y: modelY, align: 'right', maxWidth: W * (tall ? 0.86 : 0.52), scale: k
  }, W, H);

  drawLogo(ctx, S, W, H, A);

  const sy = H * F.strip;
  specStrip(ctx, S, k, {
    x: W * (tall ? 0.05 : F.specLeft), y: sy,
    w: W * (tall ? 0.90 : F.specRight - F.specLeft), h: H - sy,
    labelColor: S.type.spec.color,
    valueColor: rgba(S.type.spec.color, 0.72),
    dividerColor: rgba(S.brand.light, 0.26)
  });
}
design5.defaults = { position: 'custom', wrapper: { shape: 'none', bleed: 'none' } };
design5.surfaces = { display: 'dark', script: 'dark', model: 'dark', tagline: 'dark', spec: 'dark' };
design5.displayFont = 'Montserrat';

/* ================================================================
   DESIGN 3 — "JUST SOLD" over a brand-coloured fade
   ================================================================
   Built to the supplied spec at the 1200x800 reference:
     headline  Intro Rust 150
     boat name Montserrat 33.3, centred on the headline's own width
     tagline   Montserrat 31.7
   The fade colour is the logo's major extracted colour, and the badge sits
   in the bottom-right corner on a white circle.
   ================================================================ */
function design3(ctx, S, A, W, H) {
  const k = unit(W, H);
  const tall = isTall(W, H);

  ctx.fillStyle = S.brand.dark;
  ctx.fillRect(0, 0, W, H);
  if (A.boat) photo(ctx, A.boat, S.photo, 0, 0, W, H);
  else placeholder(ctx, S, 0, 0, W, H);

  // A solid colour field that holds, then dissolves into the photograph —
  // not a vignette. `hold` is what keeps the left third fully opaque.
  const P = S.photo;
  if (tall) {
    scrim(ctx, 0, 0, W, H, S.brand.dark, P.fadeOpacity, 'bottom', P.fadeLength, P.fadeHold);
    scrim(ctx, 0, 0, W, H, S.brand.dark, P.fadeOpacity * 0.4, 'left', 0.5, 0.1);
  } else {
    scrim(ctx, 0, 0, W, H, S.brand.dark, P.fadeOpacity, 'left', P.fadeLength, P.fadeHold);
  }

  const x = W * 0.075;
  const colMax = W * (tall ? Math.max(S.layout.textWidth, 0.85) : S.layout.textWidth);
  let y = H * (tall ? 0.30 : 0.085);

  const head = block(ctx, S, 'display', S.text.kicker, S.type.display,
    { x, y, maxWidth: colMax, scale: k }, W, H);

  // The rest of the stack centres on the headline's own width, which is what
  // gives this layout its off-axis look.
  const cx = head.x + head.width / 2;
  y = head.bottom + H * 0.075;

  if (S.rule.show) {
    line(ctx, x, y, S.rule.width * k, S.rule.thickness * k, S.rule.color);
    y += S.rule.thickness * k + H * 0.045;
  }

  const model = block(ctx, S, 'model', S.text.model, S.type.model,
    { x: cx, y, align: 'center', maxWidth: colMax, scale: k }, W, H);
  y = model.bottom + H * 0.045;

  if (S.ruleB.show) {
    const wB = S.ruleB.width * k;
    line(ctx, model.x + model.width - wB, y, wB, S.ruleB.thickness * k, S.ruleB.color);
    y += S.ruleB.thickness * k + H * 0.06;
  }

  block(ctx, S, 'tagline', S.text.tagline, S.type.tagline,
    { x: cx, y, align: 'center', maxWidth: colMax, scale: k }, W, H);

  drawLogo(ctx, S, W, H, A);
}
design3.defaults = { position: 'bottom-right', wrapper: { shape: 'circle', bleed: 'none' } };
design3.surfaces = { display: 'dark', script: 'dark', model: 'dark', tagline: 'dark', spec: 'light' };
design3.displayFont = 'Intro Rust';

/* ================================================================
   DESIGN 4 — brush script on a light panel, diagonal geometric divider
   ================================================================
   Spec at the 1200x800 reference:
     script    Breathing 92.2, colour from the logo
     boat name Montserrat 30.3, colour from the logo
     tagline   Montserrat 22.7, grey
   The divider angle, band widths and colours are all settings, so the
   geometry can be dialled onto the reference exactly.
   ================================================================ */
function design4(ctx, S, A, W, H) {
  const k = unit(W, H);
  const tall = isTall(W, H);
  const d = S.divider;

  ctx.fillStyle = S.brand.light;
  ctx.fillRect(0, 0, W, H);

  // The light panel carries a very faint wash of the same photo.
  if (A.boat && d.ghost > 0) {
    ctx.save();
    ctx.globalAlpha = d.ghost;
    photo(ctx, A.boat, S.photo, 0, 0, W, H);
    ctx.restore();
  }

  const geom = tall
    ? { ...d, topX: d.topX, bottomX: d.bottomX }
    : d;

  if (tall) {
    // Stacked: the divider becomes a horizontal band above the photo.
    const splitY = H * 0.46;
    const slant = H * 0.035;
    const band = (i) => {
      ctx.beginPath();
      ctx.moveTo(0, splitY + slant + i);
      ctx.lineTo(W, splitY - slant + i);
      ctx.lineTo(W, H); ctx.lineTo(0, H);
      ctx.closePath();
    };
    ctx.fillStyle = d.color2; band(0); ctx.fill();
    ctx.fillStyle = d.color; band(H * d.band2); ctx.fill();
    ctx.save(); band(H * (d.band2 + d.band)); ctx.clip();
    if (A.boat) photo(ctx, A.boat, S.photo, 0, splitY, W, H - splitY);
    else placeholder(ctx, S, 0, splitY, W, H - splitY);
    ctx.restore();
  } else {
    ctx.fillStyle = d.color2;
    dividerPath(ctx, W, H, geom, -(d.band + d.band2)); ctx.fill();
    ctx.fillStyle = d.color;
    dividerPath(ctx, W, H, geom, -d.band); ctx.fill();

    ctx.save();
    dividerPath(ctx, W, H, geom, 0);
    ctx.clip();
    if (A.boat) photo(ctx, A.boat, S.photo, 0, 0, W, H);
    else placeholder(ctx, S, W * geom.topX, 0, W * (1 - geom.topX), H);
    ctx.restore();
  }

  const x = W * 0.055;
  const maxW = tall
    ? W * 0.89
    : W * Math.min(geom.topX, geom.bottomX) - x - W * 0.03;

  const items = [
    { role: 'script', text: S.text.script, spec: S.type.script, gap: H * 0.11 },
    { role: 'model', text: S.text.model, spec: S.type.model, gap: H * 0.055 },
    { rule: true, gap: H * 0.05 },
    { role: 'tagline', text: S.text.tagline, spec: S.type.tagline }
  ];
  centredStack(ctx, S, items, { x, maxWidth: maxW, scale: k, W, H },
    tall ? H * 0.23 : H * 0.5);

  drawLogo(ctx, S, W, H, A);
}
design4.defaults = { position: 'top-right', wrapper: { shape: 'circle', bleed: 'none' } };
design4.surfaces = { display: 'light', script: 'light', model: 'light', tagline: 'light', spec: 'light' };
design4.displayFont = 'Montserrat';

export const RENDERERS = {
  'design-3': design3,
  'design-5': design5,
  'design-4': design4,
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
export function renderDesign(ctx, S, A, W, H, opts = {}) {
  TRACK = !!opts.track;
  if (TRACK) HITS = [];
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  (RENDERERS[S.template] || boldLeft)(ctx, S, A, W, H);
  ctx.restore();
  TRACK = false;
}
