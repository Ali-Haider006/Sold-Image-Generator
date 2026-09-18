/* ------------------------------------------------------------------
   logo.js — logo geometry, background wrapper, and painting
   ------------------------------------------------------------------
   Geometry is deliberately separated from painting: the canvas drag
   handler needs to know where the logo *is* without drawing anything.
------------------------------------------------------------------- */

import { unit, contain, knockout, roundRectPath, shieldPath, circlePath, rgba } from './draw.js';

const ANCHORS = {
  'top-left': [0, 0], 'top-center': [0.5, 0], 'top-right': [1, 0],
  'mid-left': [0, 0.5], 'mid-center': [0.5, 0.5], 'mid-right': [1, 0.5],
  'bottom-left': [0, 1], 'bottom-center': [0.5, 1], 'bottom-right': [1, 1]
};

/**
 * Work out the wrapper rectangle and the art rectangle inside it.
 * `defaults` lets a template suggest its own anchor/inset, which the user's
 * explicit settings always override.
 */
export function logoGeometry(S, W, H, img) {
  const k = unit(W, H);
  const L = S.logo, Wr = L.wrapper;
  const pad = L.padding * k;

  const artW = L.size * k;
  const ar = img ? img.naturalWidth / img.naturalHeight : 1;
  const artH = artW / (ar || 1);

  // Wrapper box sized to fully contain the artwork plus padding.
  let ww, wh, radius = Wr.radius * k, shape = Wr.shape;
  // An explicit diameter wins, so a badge can be sized to a reference
  // directly instead of being inferred backwards from padding.
  const square = Wr.diameter > 0
    ? Wr.diameter * k
    : Math.max(artW, artH) + pad * 2;

  switch (shape) {
    case 'none':    ww = artW; wh = artH; break;
    case 'circle':  ww = wh = square; radius = square / 2; break;
    case 'square':  ww = wh = square; radius = 0; break;
    case 'rounded': ww = wh = square; break;
    case 'pill':    ww = artW + pad * 2.6; wh = artH + pad * 1.6; radius = wh / 2; break;
    case 'shield':  ww = Math.max(artW, artH * 0.8) + pad * 2; wh = ww * 1.22; break;
    case 'banner':  ww = W; wh = artH + pad * 2; radius = 0; break;
    default:        ww = artW; wh = artH;
  }

  // Centre point from the anchor (or the dragged custom position).
  let cx, cy;
  if (L.position === 'custom') {
    cx = L.customX * W;
    cy = L.customY * H;
  } else {
    const [ax, ay] = ANCHORS[L.position] || ANCHORS['bottom-right'];
    const ox = L.offsetX * k, oy = L.offsetY * k;
    cx = ax === 0 ? ox + ww / 2 : ax === 1 ? W - ox - ww / 2 : W / 2 + ox;
    cy = ay === 0 ? oy + wh / 2 : ay === 1 ? H - oy - wh / 2 : H / 2 + oy;
  }
  if (shape === 'banner') cx = W / 2;

  // Let the badge run off the edge, the way dealer templates usually sit it.
  // Skipped for a dragged logo: an explicit placement always wins, otherwise
  // the badge would refuse to follow the pointer vertically.
  if (L.position !== 'custom' && Wr.bleed !== 'none') {
    const over = Math.max(0, Math.min(0.6, Wr.bleedAmount ?? 0.3));
    cy = H - wh / 2 + wh * over;
    if (Wr.bleed === 'corner') {
      cx = cx > W / 2 ? W - ww / 2 + ww * over : ww / 2 - ww * over;
    }
  }

  // The shield tapers, so nudge the artwork up into its fat half.
  const artCy = shape === 'shield' ? cy - wh * 0.08 : cy;

  return {
    shape, radius,
    wrapper: { x: cx - ww / 2, y: cy - wh / 2, w: ww, h: wh, cx, cy },
    art: { x: cx - artW / 2, y: artCy - artH / 2, w: artW, h: artH }
  };
}

/**
 * Which uploaded file this design's logo should draw from.
 * A design can ask for the reversed mark; it only gets one if it exists.
 */
export function pickLogo(S, A) {
  if (!A) return null;
  return (S.logo.variant === 'reversed' && A.logoAlt) ? A.logoAlt : A.logo;
}

export function drawLogo(ctx, S, W, H, A) {
  const img = pickLogo(S, A);
  if (!img) return null;
  // Knockout is the fallback for a dark ground with no reversed asset. A real
  // reversed file is already the right colour and keeps its inner detail, so
  // flattening it would throw that away.
  const usingReversed = S.logo.variant === 'reversed' && A?.logoAlt;
  const flatten = S.logo.knockout && !usingReversed;
  const geo = logoGeometry(S, W, H, img);
  const { wrapper: box, shape, radius } = geo;
  const Wr = S.logo.wrapper;
  const k = unit(W, H);

  ctx.save();
  ctx.globalAlpha = S.logo.opacity;

  if (shape !== 'none') {
    const path = () => {
      if (shape === 'circle') circlePath(ctx, box.cx, box.cy, box.w / 2);
      else if (shape === 'shield') shieldPath(ctx, box.x, box.y, box.w, box.h, radius);
      else roundRectPath(ctx, box.x, box.y, box.w, box.h, radius);
    };

    if (Wr.opacity > 0) {
      ctx.save();
      if (Wr.shadow > 0) {
        ctx.shadowColor = rgba('#000000', Wr.shadow * 0.55);
        ctx.shadowBlur = 34 * k;
        ctx.shadowOffsetY = 10 * k;
      }
      path();
      ctx.fillStyle = rgba(Wr.fill, Wr.opacity);
      ctx.fill();
      ctx.restore();
    }

    // Stroked independently of the fill: an outline-only badge is a real
    // thing to want, and it used to vanish whenever the fill was transparent.
    if (Wr.borderWidth > 0) {
      path();
      ctx.strokeStyle = Wr.borderColor;
      ctx.lineWidth = Wr.borderWidth * k;
      ctx.stroke();
    }
  }

  if (flatten) {
    knockout(ctx, img, geo.art.x, geo.art.y, geo.art.w, geo.art.h, S.logo.knockoutColor);
  } else {
    contain(ctx, img, geo.art.x, geo.art.y, geo.art.w, geo.art.h);
  }
  ctx.restore();
  return geo;
}
