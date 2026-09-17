/* ------------------------------------------------------------------
   app.js — wiring: assets, preview, palette, presets, export
------------------------------------------------------------------- */

import { DEFAULTS, CANVAS_PRESETS, TEMPLATES, clone, merge, get, set } from './settings.js';
import { Panel, buildTemplatePicker, buildSpecEditor } from './ui.js';
import { renderDesign, RENDERERS } from './templates.js';
import { logoGeometry } from './logo.js';
import { extractPalette, readableOn, tint } from './palette.js';
import { preloadFonts, ensureFont, ALL_FAMILIES } from './fonts.js';

const $ = sel => document.querySelector(sel);
const LS = { settings: 'sig.settings.v1', logo: 'sig.logo.v1', presets: 'sig.presets.v1' };

const state = {
  S: merge(DEFAULTS, loadJSON(LS.settings) || {}),
  assets: { boat: null, logo: null },
  palette: null,
  logoCustomized: false,
  typeCustomized: false,
  paletteApplied: false,
  frame: 0
};

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
const saveJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };

/* ---------- derived settings ---------- */

/** Resolve presets and typography locks into concrete values before drawing. */
function normalize(S) {
  const preset = CANVAS_PRESETS[S.canvas.preset];
  if (preset && S.canvas.preset !== 'custom') {
    S.canvas.width = preset.w;
    S.canvas.height = preset.h;
  }
  if (S.siteType.lockHeading) S.type.display.family = S.siteType.heading;
  if (S.siteType.lockSecondary) {
    S.type.model.family = S.siteType.body;
    S.type.tagline.family = S.siteType.body;
    S.type.spec.family = S.siteType.body;
  }
  return S;
}

const dims = () => [state.S.canvas.width, state.S.canvas.height];

/* ---------- preview ---------- */

const canvas = $('#preview');
const ctx = canvas.getContext('2d');

function render() {
  normalize(state.S);
  const [W, H] = dims();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  canvas.style.aspectRatio = `${W} / ${H}`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderDesign(ctx, state.S, state.assets, W, H);

  $('#dims-readout').textContent = `${W} × ${H} px  ·  export ${W * state.S.canvas.exportScale} × ${H * state.S.canvas.exportScale}`;
  saveJSON(LS.settings, state.S);
}

function scheduleRender() {
  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(render);
}

/* ---------- assets ---------- */

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ img, dataURL: reader.result });
      img.onerror = () => reject(new Error('That file could not be decoded as an image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

async function setBoat(file) {
  if (!file || !file.type.startsWith('image/')) return toast('Pick an image file for the boat photo.');
  const { img } = await fileToImage(file);
  state.assets.boat = img;
  $('#boat-drop').classList.add('filled');
  $('#boat-name').textContent = file.name;
  autoFillFromFilename(file.name);
  scheduleRender();
}

async function setLogo(file) {
  if (!file || !file.type.startsWith('image/')) return toast('Pick an image file for the logo.');
  const { img, dataURL } = await fileToImage(file);
  state.assets.logo = img;
  saveJSON(LS.logo, dataURL);
  $('#logo-drop').classList.add('filled');
  $('#logo-name').textContent = file.name;
  runExtraction();
  scheduleRender();
}

/**
 * Best-effort: pull a year/make/model out of a filename like
 * "2026-sea-fox-268-commander.jpg" so the card starts half-filled.
 * Only ever touches placeholder text the user has not edited.
 */
function autoFillFromFilename(name) {
  if (state.S.text.model !== DEFAULTS.text.model) return;
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  const m = base.match(/^(19|20)\d{2}\b/);
  if (!m) return;
  const rest = base.slice(m[0].length).trim();
  const words = rest.split(/\s+/);
  const head = [m[0], ...words.slice(0, 2)].join(' ');
  const tail = words.slice(2).join(' ');
  state.S.text.model = (tail ? `${head}\n${tail}` : head).toUpperCase();
  panel.refresh();
}

/* ---------- palette extraction ---------- */

function runExtraction() {
  if (!state.assets.logo) return;
  try {
    state.palette = extractPalette(state.assets.logo);
  } catch {
    return toast('Could not read colours from that logo.');
  }
  renderSwatches();
  $('#palette-empty').hidden = true;
  $('#palette-actions').hidden = false;
}

function renderSwatches() {
  const host = $('#swatches');
  host.innerHTML = '';
  for (const sw of state.palette.swatches) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sw';
    b.style.background = sw.hex;
    b.style.color = readableOn(sw.hex);
    b.title = `${sw.hex} — ${(sw.share * 100).toFixed(1)}% of the logo. Click to copy.`;
    b.innerHTML = `<span>${sw.hex.toUpperCase()}</span>`;
    b.addEventListener('click', () => {
      navigator.clipboard?.writeText(sw.hex);
      toast(`Copied ${sw.hex.toUpperCase()}`);
    });
    host.appendChild(b);
  }

  const roles = $('#roles');
  roles.innerHTML = '';
  for (const [name, hexv] of Object.entries(state.palette.roles)) {
    const chip = document.createElement('div');
    chip.className = 'role';
    chip.innerHTML = `<span class="role-dot" style="background:${hexv}"></span>
      <span class="role-name">${name}</span><span class="role-hex">${hexv.toUpperCase()}</span>`;
    roles.appendChild(chip);
  }
}

/**
 * Apply the extracted roles to the brand slots, then re-point every text
 * colour at those slots so one click restyles the whole card.
 *
 * Each template declares which of its text roles sit on a light surface and
 * which sit on a dark one, so the same palette stays legible on all four.
 */
function applyPalette(announce = true) {
  if (!state.palette) return;
  const r = state.palette.roles;
  const S = state.S;
  const surf = RENDERERS[S.template].surfaces;

  S.brand = { ...S.brand, ...r };
  S.rule.color = r.secondary;
  S.logo.wrapper.fill = r.light;
  S.logo.wrapper.borderColor = r.primary;
  S.photo.overlay = r.dark;

  const ink = role => (surf[role] === 'light' ? r.primary : r.light);
  S.type.display.color = ink('display');
  S.type.script.color = ink('script');
  S.type.model.color = ink('model');
  // A muted secondary: lighter than the ink on dark, greyed-back on light.
  S.type.tagline.color = surf.tagline === 'light' ? tint(r.primary, 0.45) : r.accent;
  S.type.spec.color = r.primary;

  state.paletteApplied = true;
  panel.refresh();
  scheduleRender();
  if (announce) toast('Palette applied to the design.');
}

/* ---------- canvas interaction ---------- */

function toDesign(e) {
  const rect = canvas.getBoundingClientRect();
  const [W, H] = dims();
  return {
    x: (e.clientX - rect.left) / rect.width * W,
    y: (e.clientY - rect.top) / rect.height * H
  };
}

const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

let drag = null;

canvas.addEventListener('pointerdown', e => {
  const [W, H] = dims();
  const p = toDesign(e);
  const geo = state.assets.logo ? logoGeometry(state.S, W, H, state.assets.logo) : null;

  if (geo && inRect(p, geo.wrapper)) {
    drag = { mode: 'logo', grabX: p.x - geo.wrapper.cx, grabY: p.y - geo.wrapper.cy };
    state.S.logo.position = 'custom';
    state.logoCustomized = true;
  } else {
    drag = { mode: 'focus', startX: p.x, startY: p.y, fx: state.S.photo.focusX, fy: state.S.photo.focusY };
  }
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', e => {
  const [W, H] = dims();
  if (!drag) {
    const geo = state.assets.logo ? logoGeometry(state.S, W, H, state.assets.logo) : null;
    canvas.style.cursor = geo && inRect(toDesign(e), geo.wrapper) ? 'grab' : 'move';
    return;
  }
  const p = toDesign(e);
  if (drag.mode === 'logo') {
    state.S.logo.customX = (p.x - drag.grabX) / W;
    state.S.logo.customY = (p.y - drag.grabY) / H;
  } else {
    // Dragging the photo moves the image, so the focal point moves inversely.
    state.S.photo.focusX = clamp01(drag.fx + (p.x - drag.startX) / W);
    state.S.photo.focusY = clamp01(drag.fy + (p.y - drag.startY) / H);
  }
  panel.refresh();
  scheduleRender();
});

const endDrag = e => {
  if (!drag) return;
  drag = null;
  canvas.classList.remove('dragging');
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const clamp01 = v => Math.max(0, Math.min(1, v));

/* ---------- export ---------- */

function slug(s) {
  return String(s).toLowerCase().replace(/\n/g, '-')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'just-sold';
}

async function buildExportCanvas() {
  normalize(state.S);
  const [W, H] = dims();
  const s = state.S.canvas.exportScale;
  const out = document.createElement('canvas');
  out.width = Math.round(W * s);
  out.height = Math.round(H * s);
  const octx = out.getContext('2d');
  octx.setTransform(s, 0, 0, s, 0, 0);

  if (state.S.canvas.format === 'jpeg') {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.fillStyle = state.S.brand.light;
    octx.fillRect(0, 0, out.width, out.height);
    octx.setTransform(s, 0, 0, s, 0, 0);
  }
  renderDesign(octx, state.S, state.assets, W, H);
  return out;
}

async function download() {
  const out = await buildExportCanvas();
  const fmt = state.S.canvas.format;
  const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
  out.toBlob(blob => {
    if (!blob) return toast('Export failed — try a smaller export scale.');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(state.S.text.model)}-${state.S.template}.${fmt === 'jpeg' ? 'jpg' : 'png'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Image downloaded.');
  }, mime, 0.92);
}

async function copyToClipboard() {
  if (!window.ClipboardItem || !navigator.clipboard?.write) {
    return toast('This browser cannot copy images — use Download instead.');
  }
  const out = await buildExportCanvas();
  out.toBlob(async blob => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Copied to clipboard.');
    } catch {
      toast('Clipboard blocked — use Download instead.');
    }
  }, 'image/png');
}

/* ---------- brand kit presets ---------- */

function presetNames() { return Object.keys(loadJSON(LS.presets) || {}); }

function refreshPresetList() {
  const sel = $('#preset-list');
  const current = sel.value;
  sel.innerHTML = '<option value="">Saved brand kits…</option>';
  for (const n of presetNames()) {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    sel.appendChild(o);
  }
  sel.value = current;
}

function savePreset() {
  const name = prompt('Name this brand kit (colours, type, logo settings):');
  if (!name) return;
  const all = loadJSON(LS.presets) || {};
  all[name] = clone(state.S);
  saveJSON(LS.presets, all);
  refreshPresetList();
  $('#preset-list').value = name;
  toast(`Saved “${name}”.`);
}

function loadPreset(name) {
  const all = loadJSON(LS.presets) || {};
  if (!all[name]) return;
  state.S = merge(DEFAULTS, all[name]);
  state.paletteApplied = false;
  panel.S = state.S;
  panel.refresh();
  markTemplate();
  syncSpecsVisibility();
  renderSpecs();
  preloadFonts(familiesInUse()).then(scheduleRender);
  scheduleRender();
  toast(`Loaded “${name}”.`);
}

function deletePreset(name) {
  const all = loadJSON(LS.presets) || {};
  if (!all[name] || !confirm(`Delete brand kit “${name}”?`)) return;
  delete all[name];
  saveJSON(LS.presets, all);
  refreshPresetList();
  toast(`Deleted “${name}”.`);
}

function exportSettings() {
  const blob = new Blob([JSON.stringify(state.S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sold-image-brand-kit.json';
  a.click();
}

async function importSettings(file) {
  try {
    state.S = merge(DEFAULTS, JSON.parse(await file.text()));
    state.paletteApplied = false;
    panel.S = state.S;
    panel.refresh();
    markTemplate();
    syncSpecsVisibility();
    renderSpecs();
    await preloadFonts(familiesInUse());
    scheduleRender();
    toast('Brand kit imported.');
  } catch {
    toast('That file is not a valid brand kit JSON.');
  }
}

const familiesInUse = () => [
  ...Object.values(state.S.type).map(t => t.family),
  state.S.siteType.heading, state.S.siteType.body
];

/* ---------- misc UI ---------- */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/** One handler for every collapsible group, static or generated. */
document.querySelector('.sidebar').addEventListener('click', e => {
  const head = e.target.closest('.group-head');
  if (head) head.parentElement.classList.toggle('collapsed');
});

function wireDrop(zone, input, handler) {
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => input.files[0] && handler(input.files[0]));
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.classList.remove('over');
  }));
  zone.addEventListener('drop', e => {
    const f = e.dataTransfer?.files?.[0];
    if (f) handler(f);
  });
}

/* ---------- boot ---------- */

/** The spec strip only exists on the editorial layout. */
const syncSpecsVisibility = () => {
  $('#specs-group').hidden = !TEMPLATES[state.S.template].uses.includes('specs');
};

const panel = new Panel($('#controls'), state.S, key => {
  if (key.startsWith('logo.')) state.logoCustomized = true;
  if (/\.family$/.test(key) || key.startsWith('siteType.')) state.typeCustomized = true;
  // Once a colour is set by hand, stop re-deriving colours on template switch.
  if (/color$/i.test(key) || key.startsWith('brand.')) state.paletteApplied = false;
  scheduleRender();
});

const markTemplate = buildTemplatePicker($('#templates'), state.S, id => {
  state.S.template = id;
  // Each layout has a logo treatment that suits it — but never stomp on a
  // placement the user has already chosen.
  if (!state.logoCustomized) {
    const d = RENDERERS[id].defaults;
    state.S.logo.position = d.position;
    Object.assign(state.S.logo.wrapper, d.wrapper);
  }
  // Suggest the headline face this layout was drawn around, unless the user
  // has already made a typographic choice of their own.
  if (!state.typeCustomized && !state.S.siteType.lockHeading) {
    state.S.type.display.family = RENDERERS[id].displayFont;
    ensureFont(RENDERERS[id].displayFont).then(scheduleRender);
  }
  // Light-panel layouts need dark ink and vice versa, so re-derive.
  if (state.paletteApplied) applyPalette(false);
  markTemplate();
  syncSpecsVisibility();
  panel.refresh();
  scheduleRender();
});

const renderSpecs = buildSpecEditor($('#specs'), state.S, scheduleRender);

wireDrop($('#boat-drop'), $('#boat-file'), setBoat);
wireDrop($('#logo-drop'), $('#logo-file'), setLogo);

$('#apply-palette').addEventListener('click', applyPalette);
$('#reextract').addEventListener('click', runExtraction);
$('#download').addEventListener('click', download);
$('#copy').addEventListener('click', copyToClipboard);
$('#save-preset').addEventListener('click', savePreset);
$('#export-json').addEventListener('click', exportSettings);
$('#import-json').addEventListener('change', e => e.target.files[0] && importSettings(e.target.files[0]));
$('#preset-list').addEventListener('change', e => e.target.value && loadPreset(e.target.value));
$('#delete-preset').addEventListener('click', () => {
  const n = $('#preset-list').value;
  if (n) deletePreset(n);
});
$('#reset').addEventListener('click', () => {
  if (!confirm('Reset every setting back to the defaults?')) return;
  state.S = clone(DEFAULTS);
  state.logoCustomized = false;
  state.typeCustomized = false;
  state.paletteApplied = false;
  panel.S = state.S;
  panel.refresh();
  markTemplate();
  syncSpecsVisibility();
  renderSpecs();
  scheduleRender();
});

// Restore a previously used logo so the brand kit survives a reload.
// (Stored via saveJSON, so it has to be parsed back — not read raw.)
const savedLogo = loadJSON(LS.logo);
if (savedLogo) {
  const img = new Image();
  img.onload = () => {
    state.assets.logo = img;
    $('#logo-drop').classList.add('filled');
    $('#logo-name').textContent = 'Saved logo';
    runExtraction();
    scheduleRender();
  };
  img.src = savedLogo;
}

// Canvas silently falls back to a default face for fonts that are not ready,
// so repaint whenever the font set finishes loading.
document.fonts?.addEventListener?.('loadingdone', scheduleRender);

syncSpecsVisibility();
refreshPresetList();

// The faces this design needs come first so the opening render is correct;
// the rest are warmed afterwards purely so the font pickers preview properly.
preloadFonts(familiesInUse())
  .then(scheduleRender)
  .then(() => preloadFonts(ALL_FAMILIES));
scheduleRender();
