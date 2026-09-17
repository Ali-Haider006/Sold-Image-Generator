/* ------------------------------------------------------------------
   app.js — flow, assets, gallery, editor, export
   ------------------------------------------------------------------
   Three screens: intake (photo + logo + boat name) -> gallery (every
   design rendered from those inputs) -> editor (one design, full controls,
   download).

   Settings are held PER DESIGN. Anything shared — the artwork, the boat
   name, the extracted palette — is pushed into every design when it
   changes; anything edited in the editor touches only that design.
------------------------------------------------------------------- */

import { DEFAULTS, CANVAS_PRESETS, clone, merge } from './settings.js';
import { DESIGNS, DESIGN_SLOTS, byId, pendingSlots } from './designs.js';
import { Panel, buildSpecEditor, buildTabs } from './ui.js';
import { renderDesign, RENDERERS, textHitBoxes } from './templates.js';
import { logoGeometry } from './logo.js';
import { extractPalette, readableOn } from './palette.js';
import {
  preloadFonts, ensureFont, ALL_FAMILIES, LICENSED_FONTS,
  registerUploadedFont, hasUploadedFont, resolvedFace
} from './fonts.js';

const $ = sel => document.querySelector(sel);
const LS = {
  logo: 'sig.logo.v2', model: 'sig.model.v2',
  settings: 'sig.designs.v3', fonts: 'sig.fonts.v2'
};

const loadJSON = key => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};
const saveJSON = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };

/* ---------- state ---------- */

const state = {
  screen: 'intake',
  assets: { boat: null, logo: null },
  palette: null,
  model: '',
  settings: {},          // design id -> settings
  active: null,          // design id open in the editor
  logoCustomized: {},    // design id -> bool
  frame: 0
};

/** A design's settings: the shared defaults with its own preset laid over. */
function freshSettings(design) {
  return merge(DEFAULTS, design.preset);
}

function initSettings() {
  const saved = loadJSON(LS.settings) || {};
  for (const d of DESIGNS) {
    state.settings[d.id] = saved[d.id]
      ? merge(freshSettings(d), saved[d.id])
      : freshSettings(d);
  }
}

const persist = () => saveJSON(LS.settings, state.settings);

/* ---------- shared values pushed into every design ---------- */

function applyModelToAll() {
  const text = state.model.trim();
  if (!text) return;
  for (const d of DESIGNS) state.settings[d.id].text.model = text;
}

/**
 * Push the extracted palette into every design.
 * Each design decides for itself how the roles land — a dark fade uses the
 * major colour as its ground, a light panel uses it as ink.
 */
function applyPaletteToAll() {
  if (!state.palette) return;
  const r = state.palette.roles;
  for (const d of DESIGNS) {
    const S = state.settings[d.id];
    S.brand = { ...S.brand, ...r };
    if (d.paletteMap) d.paletteMap(S, r);
    else genericPalette(S, d, r);
  }
}

/** Fallback mapping for designs that have no specification of their own yet. */
function genericPalette(S, d, r) {
  const surf = RENDERERS[S.template]?.surfaces;
  if (!surf) return;
  const ink = role => (surf[role] === 'light' ? r.primary : r.light);
  S.type.display.color = ink('display');
  S.type.script.color = ink('script');
  S.type.model.color = ink('model');
  S.type.tagline.color = surf.tagline === 'light' ? r.accent : r.accent;
  S.type.spec.color = r.primary;
  S.rule.color = r.secondary;
  S.logo.wrapper.fill = r.light;
  S.photo.overlay = r.dark;
}

/* ---------- screens ---------- */

const STEP_LABEL = {
  intake: 'Step 1 — add your artwork',
  gallery: 'Step 2 — choose a design',
  editor: 'Step 3 — edit and download'
};

function show(screen) {
  state.screen = screen;
  $('#screen-intake').hidden = screen !== 'intake';
  $('#screen-gallery').hidden = screen !== 'gallery';
  $('#screen-editor').hidden = screen !== 'editor';
  $('#step-label').textContent = STEP_LABEL[screen];

  $('#back-to-gallery').hidden = screen !== 'editor';
  $('#download').hidden = screen !== 'editor';
  $('#copy').hidden = screen !== 'editor';
  $('#dims-readout').textContent = '';

  document.body.classList.toggle('is-editor', screen === 'editor');
  if (screen === 'gallery') renderGallery();
  if (screen === 'editor') scheduleRender();
  window.scrollTo(0, 0);
}

/* ---------- assets ---------- */

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ img, dataURL: reader.result });
      img.onerror = () => reject(new Error('decode'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

function drawThumb(canvas, img) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  const r = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * r, dh = img.naturalHeight * r;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  canvas.hidden = false;
}

async function setBoat(file) {
  if (!file?.type.startsWith('image/')) return toast('Pick an image file for the boat photo.');
  try {
    const { img } = await fileToImage(file);
    state.assets.boat = img;
    $('#boat-drop').classList.add('filled');
    $('#boat-name').textContent = file.name;
    drawThumb($('#boat-thumb'), img);
    if (!state.model) {
      const guess = guessModel(file.name);
      if (guess) { state.model = guess; $('#intake-model').value = guess; applyModelToAll(); }
    }
    gateIntake();
  } catch { toast('That file could not be read as an image.'); }
}

async function setLogo(file) {
  if (!file?.type.startsWith('image/')) return toast('Pick an image file for the logo.');
  try {
    const { img, dataURL } = await fileToImage(file);
    state.assets.logo = img;
    saveJSON(LS.logo, dataURL);
    $('#logo-drop').classList.add('filled');
    $('#logo-name').textContent = file.name;
    drawThumb($('#logo-thumb'), img);
    runExtraction();
    gateIntake();
  } catch { toast('That file could not be read as an image.'); }
}

/** "2026-sea-fox-268-commander.jpg" -> "2026 SEA FOX\n268 COMMANDER". */
function guessModel(name) {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  const m = base.match(/^(19|20)\d{2}\b/);
  if (!m) return '';
  const words = base.slice(m[0].length).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const head = [m[0], ...words.slice(0, 2)].join(' ');
  const tail = words.slice(2).join(' ');
  return (tail ? `${head}\n${tail}` : head).toUpperCase();
}

function gateIntake() {
  const ready = !!(state.assets.boat && state.assets.logo);
  $('#to-gallery').disabled = !ready;
  $('#intake-hint').textContent = ready
    ? 'Every design below is built from these two images.'
    : 'Add a boat photo and a logo to continue.';
}

/* ---------- palette ---------- */

function runExtraction() {
  if (!state.assets.logo) return;
  try { state.palette = extractPalette(state.assets.logo); }
  catch { return toast('Could not read colours from that logo.'); }

  paintSwatches($('#swatches'), true);
  paintRoles($('#roles'));
  $('#intake-palette').hidden = false;
  applyPaletteToAll();
  persist();
}

function paintSwatches(host, withRoles) {
  if (!host || !state.palette) return;
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
}

function paintRoles(host) {
  if (!host || !state.palette) return;
  host.innerHTML = '';
  for (const [name, hexv] of Object.entries(state.palette.roles)) {
    const chip = document.createElement('div');
    chip.className = 'role';
    chip.innerHTML = `<span class="role-dot" style="background:${hexv}"></span>
      <span class="role-name">${name}</span><span class="role-hex">${hexv.toUpperCase()}</span>`;
    host.appendChild(chip);
  }
}

/* ---------- gallery ---------- */

function renderGallery() {
  const grid = $('#design-grid');
  grid.innerHTML = '';

  // Only designs that have been given a number count toward the eight.
  const numbered = DESIGNS.filter(d => d.status === 'ready' && d.slot);
  const unnumbered = DESIGNS.filter(d => d.status === 'ready' && !d.slot).length;
  $('#gallery-count').textContent =
    `${numbered.length} of ${DESIGN_SLOTS} numbered designs are built` +
    (unnumbered ? `, plus ${unnumbered} built but not yet numbered` : '') +
    `. Slots ${pendingSlots().join(', ')} are waiting on their specifications.`;

  for (const d of DESIGNS) grid.appendChild(designCard(d));
  for (const slot of pendingSlots()) grid.appendChild(pendingCard(slot));
}

function designCard(d) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'design-card';
  card.dataset.id = d.id;

  const canvas = document.createElement('canvas');
  canvas.className = 'design-thumb';
  canvas.width = 720;
  canvas.height = 480;

  const label = d.slot ? `Design ${d.slot}` : 'Draft';
  card.innerHTML = `<div class="design-meta">
      <span class="design-slot ${d.status}">${label}</span>
      <strong>${d.name}</strong>
      <span class="design-blurb">${d.blurb}</span>
    </div>`;
  card.prepend(canvas);
  card.addEventListener('click', () => openEditor(d.id));

  const ctx = canvas.getContext('2d');
  const S = state.settings[d.id];
  const [W, H] = [S.canvas.width, S.canvas.height];
  canvas.width = 720;
  canvas.height = Math.round(720 * H / W);
  ctx.setTransform(720 / W, 0, 0, 720 / W, 0, 0);
  renderDesign(ctx, S, state.assets, W, H);

  return card;
}

function pendingCard(slot) {
  const card = document.createElement('div');
  card.className = 'design-card pending';
  card.innerHTML = `<div class="pending-thumb"><span>${slot}</span></div>
    <div class="design-meta">
      <span class="design-slot waiting">Design ${slot}</span>
      <strong>Awaiting specification</strong>
      <span class="design-blurb">Send the reference and type spec and this slot gets built.</span>
    </div>`;
  return card;
}

/* ---------- editor ---------- */

let panel = null;
let renderSpecs = null;
let setTab = null;

function S() { return state.settings[state.active]; }

function openEditor(id) {
  state.active = id;
  const design = byId(id);

  if (!panel) {
    panel = new Panel($('#controls'), S(), onControlChange);
    renderSpecs = buildSpecEditor($('#specs'), S(), scheduleRender);
    setTab = buildTabs($('#tabs'));
  } else {
    panel.S = S();
    panel.refresh();
    renderSpecs = buildSpecEditor($('#specs'), S(), scheduleRender);
  }

  paintSwatches($('#editor-swatches'));
  paintEditorAssets();
  syncSpecsVisibility();
  setTab?.('photo');
  preloadFonts(familiesInUse()).then(scheduleRender);
  show('editor');
  toast(`Editing ${design.slot ? 'Design ' + design.slot : design.name}.`);
}

function onControlChange(key) {
  if (key.startsWith('logo.')) state.logoCustomized[state.active] = true;
  syncSpecsVisibility();
  persist();
  scheduleRender();
}

function syncSpecsVisibility() {
  $('#specs-group').hidden = S().template !== 'editorial';
}

function paintEditorAssets() {
  const host = $('#editor-assets');
  host.innerHTML = '';
  for (const [kind, img] of [['Boat photo', state.assets.boat], ['Logo', state.assets.logo]]) {
    const row = document.createElement('div');
    row.className = 'asset-row';
    const c = document.createElement('canvas');
    c.width = 88; c.height = 58;
    if (img) drawThumb(c, img);
    row.append(c, Object.assign(document.createElement('span'), { textContent: kind }));
    host.appendChild(row);
  }
}

/* ---------- preview ---------- */

const canvas = $('#preview');
const ctx = canvas.getContext('2d');

function normalize(s) {
  const preset = CANVAS_PRESETS[s.canvas.preset];
  if (preset && s.canvas.preset !== 'custom') {
    s.canvas.width = preset.w;
    s.canvas.height = preset.h;
  }
  if (s.siteType.lockHeading) s.type.display.family = s.siteType.heading;
  if (s.siteType.lockSecondary) {
    s.type.model.family = s.siteType.body;
    s.type.tagline.family = s.siteType.body;
    s.type.spec.family = s.siteType.body;
  }
  return s;
}

const dims = () => [S().canvas.width, S().canvas.height];

function render() {
  if (state.screen !== 'editor' || !state.active) return;
  const s = normalize(S());
  const [W, H] = dims();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  canvas.style.aspectRatio = `${W} / ${H}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderDesign(ctx, s, state.assets, W, H, { track: true });

  $('#dims-readout').textContent =
    `${W} × ${H} px · export ${W * s.canvas.exportScale} × ${H * s.canvas.exportScale}`;
}

function scheduleRender() {
  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(render);
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

/** Topmost text block under the pointer, if any. */
function textAt(p) {
  const boxes = textHitBoxes();
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
  }
  return null;
}

canvas.addEventListener('pointerdown', e => {
  const [W, H] = dims();
  const p = toDesign(e);
  const geo = state.assets.logo ? logoGeometry(S(), W, H, state.assets.logo) : null;
  const hit = textAt(p);

  if (hit) {
    // Text sits above the badge: it is usually the smaller target.
    drag = { mode: 'text', role: hit.role, lastX: p.x, lastY: p.y };
  } else if (geo && inRect(p, geo.wrapper)) {
    drag = { mode: 'logo', grabX: p.x - geo.wrapper.cx, grabY: p.y - geo.wrapper.cy };
    S().logo.position = 'custom';
    state.logoCustomized[state.active] = true;
  } else {
    drag = { mode: 'photo', lastX: p.x, lastY: p.y };
  }
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', e => {
  const [W, H] = dims();
  const p = toDesign(e);

  if (!drag) {
    const geo = state.assets.logo ? logoGeometry(S(), W, H, state.assets.logo) : null;
    canvas.style.cursor = textAt(p) ? 'grab'
      : geo && inRect(p, geo.wrapper) ? 'grab' : 'move';
    return;
  }

  if (drag.mode === 'logo') {
    S().logo.customX = (p.x - drag.grabX) / W;
    S().logo.customY = (p.y - drag.grabY) / H;
  } else {
    // Text nudges and the photo pan are both relative, so a drag that starts
    // on one element keeps tracking the pointer exactly.
    const dx = (p.x - drag.lastX) / W;
    const dy = (p.y - drag.lastY) / H;
    drag.lastX = p.x; drag.lastY = p.y;

    if (drag.mode === 'text') {
      const o = S().offsets[drag.role];
      o.x += dx; o.y += dy;
    } else {
      S().photo.offsetX += dx;
      S().photo.offsetY += dy;
    }
  }
  panel.refresh();
  scheduleRender();
});

const endDrag = e => {
  if (!drag) return;
  drag = null;
  canvas.classList.remove('dragging');
  persist();
  try { canvas.releasePointerCapture(e.pointerId); } catch {}
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* ---------- export ---------- */

const slug = s => String(s).toLowerCase().replace(/\n/g, '-')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'just-sold';

async function buildExportCanvas() {
  const s = normalize(S());
  const [W, H] = dims();
  const scale = s.canvas.exportScale;
  const out = document.createElement('canvas');
  out.width = Math.round(W * scale);
  out.height = Math.round(H * scale);
  const octx = out.getContext('2d');

  if (s.canvas.format === 'jpeg') {
    octx.fillStyle = s.brand.light;
    octx.fillRect(0, 0, out.width, out.height);
  }
  octx.setTransform(scale, 0, 0, scale, 0, 0);
  renderDesign(octx, s, state.assets, W, H);
  return out;
}

/**
 * Hand a finished file to the viewer.
 *
 * A normal web host takes the anchor route. Published as a Claude artifact,
 * the frame is sandboxed and a page-initiated download is silently inert, so
 * the host's own save capability is used when it is there.
 */
async function saveFile(blob, filename) {
  let host = null;
  try { host = (await window.claude?.use?.('downloads')) ?? null; } catch { host = null; }

  if (host) {
    try {
      await host.save({ filename, data: blob });
      toast('Image saved.');
    } catch (err) {
      toast(err?.code === 'declined' ? 'Save cancelled.' : 'The image could not be saved here.');
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Image downloaded.');
}

async function download() {
  const out = await buildExportCanvas();
  const s = S();
  const fmt = s.canvas.format;
  const design = byId(state.active);
  const tag = design.slot ? `design-${design.slot}` : design.id;
  const name = `${slug(s.text.model)}-${tag}.${fmt === 'jpeg' ? 'jpg' : 'png'}`;
  out.toBlob(blob => {
    if (!blob) return toast('Export failed — try a smaller export scale.');
    saveFile(blob, name);
  }, fmt === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92);
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
    } catch { toast('Clipboard blocked — use Download instead.'); }
  }, 'image/png');
}

/* ---------- licensed font slots ---------- */

function buildFontSlots() {
  const host = $('#font-slots');
  host.innerHTML = '';
  for (const [family, meta] of Object.entries(LICENSED_FONTS)) {
    const row = document.createElement('div');
    row.className = 'font-slot';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.woff2,.woff,.ttf,.otf,font/*';
    input.hidden = true;
    input.id = 'font-' + family.replace(/\s+/g, '-');

    const status = document.createElement('span');
    status.className = 'font-status';

    const paint = () => {
      const exact = hasUploadedFont(family);
      row.classList.toggle('exact', exact);
      status.textContent = exact
        ? 'Using your licensed file'
        : `Standing in with ${meta.substitute}`;
    };

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost';
    btn.textContent = 'Upload';
    btn.addEventListener('click', () => input.click());

    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        const dataURL = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        await registerUploadedFont(family, dataURL);
        const saved = loadJSON(LS.fonts) || {};
        saved[family] = dataURL;
        saveJSON(LS.fonts, saved);
        paint();
        scheduleRender();
        if (state.screen === 'gallery') renderGallery();
        toast(`${family} loaded — designs now use the real face.`);
      } catch {
        toast(`${file.name} could not be loaded as a font.`);
      }
    });

    row.append(
      Object.assign(document.createElement('strong'), { textContent: family }),
      status, btn, input
    );
    host.appendChild(row);
    paint();
  }
}

async function restoreFonts() {
  const saved = loadJSON(LS.fonts) || {};
  for (const [family, dataURL] of Object.entries(saved)) {
    try { await registerUploadedFont(family, dataURL); } catch {}
  }
  buildFontSlots();
}

/* ---------- misc ---------- */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

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

const familiesInUse = () => {
  const s = S();
  return [...Object.values(s.type).map(t => t.family), s.siteType.heading, s.siteType.body];
};

/* ---------- boot ---------- */

initSettings();

document.addEventListener('click', e => {
  const head = e.target.closest('.sidebar .group-head');
  if (head) head.parentElement.classList.toggle('collapsed');
});

wireDrop($('#boat-drop'), $('#boat-file'), setBoat);
wireDrop($('#logo-drop'), $('#logo-file'), setLogo);

$('#intake-model').addEventListener('input', e => {
  state.model = e.target.value;
  saveJSON(LS.model, state.model);
  applyModelToAll();
  persist();
});

$('#to-gallery').addEventListener('click', () => show('gallery'));
$('#back-to-intake').addEventListener('click', () => show('intake'));
$('#back-to-gallery').addEventListener('click', () => show('gallery'));
$('#replace-art').addEventListener('click', () => show('intake'));
$('#download').addEventListener('click', download);
$('#copy').addEventListener('click', copyToClipboard);

$('#apply-palette').addEventListener('click', () => {
  if (!state.palette) return toast('Upload a logo first.');
  const d = byId(state.active);
  const S_ = S();
  S_.brand = { ...S_.brand, ...state.palette.roles };
  if (d.paletteMap) d.paletteMap(S_, state.palette.roles);
  else genericPalette(S_, d, state.palette.roles);
  panel.refresh();
  persist();
  scheduleRender();
  toast('Palette re-applied.');
});

$('#reset').addEventListener('click', () => {
  if (!confirm('Reset this design to its specified defaults?')) return;
  const d = byId(state.active);
  state.settings[d.id] = freshSettings(d);
  applyModelToAll();
  applyPaletteToAll();
  state.logoCustomized[d.id] = false;
  panel.S = S();
  panel.refresh();
  renderSpecs = buildSpecEditor($('#specs'), S(), scheduleRender);
  syncSpecsVisibility();
  persist();
  scheduleRender();
  toast('Design reset.');
});

// Restore the boat name and logo so a reload does not start from nothing.
state.model = loadJSON(LS.model) || '';
if (state.model) { $('#intake-model').value = state.model; applyModelToAll(); }

const savedLogo = loadJSON(LS.logo);
if (savedLogo) {
  const img = new Image();
  img.onload = () => {
    state.assets.logo = img;
    $('#logo-drop').classList.add('filled');
    $('#logo-name').textContent = 'Saved logo';
    drawThumb($('#logo-thumb'), img);
    runExtraction();
    gateIntake();
  };
  img.src = savedLogo;
}

document.fonts?.addEventListener?.('loadingdone', () => {
  scheduleRender();
  if (state.screen === 'gallery') renderGallery();
});

restoreFonts();
gateIntake();
show('intake');

// The faces the built designs need come first; the rest are warmed after so
// the font pickers in the editor preview correctly.
preloadFonts(['Intro Rust', 'Breathing', 'Montserrat'])
  .then(() => preloadFonts(ALL_FAMILIES));
