/* ------------------------------------------------------------------
   settings.js — the single source of truth for a design
   ------------------------------------------------------------------
   DEFAULTS holds every knob. SCHEMA describes those knobs so the control
   panel can build itself: add a field in both places and the UI, the
   persistence layer and the JSON export all pick it up for free.
------------------------------------------------------------------- */

import { FONT_CATALOG } from './fonts.js';

/* ---------- path helpers ---------- */

export const get = (obj, path) =>
  path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export function set(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
  return obj;
}

export const clone = v => JSON.parse(JSON.stringify(v));

/** Deep-merge `patch` into a copy of `base`; unknown keys in patch win. */
export function merge(base, patch) {
  const out = clone(base);
  (function walk(t, p) {
    for (const [k, v] of Object.entries(p || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) walk(t[k], v);
      else t[k] = clone(v);
    }
  })(out, patch);
  return out;
}

/* ---------- canvas presets ---------- */

export const CANVAS_PRESETS = {
  '1200x800':  { label: 'Landscape 3:2 — 1200 × 800 (blog / web)', w: 1200, h: 800 },
  '1200x630':  { label: 'Link card 1.91:1 — 1200 × 630 (OG / X)',  w: 1200, h: 630 },
  '1080x1080': { label: 'Square 1:1 — 1080 × 1080 (feed)',          w: 1080, h: 1080 },
  '1080x1350': { label: 'Portrait 4:5 — 1080 × 1350 (feed)',        w: 1080, h: 1350 },
  '1080x1920': { label: 'Story 9:16 — 1080 × 1920 (reels)',         w: 1080, h: 1920 },
  'custom':    { label: 'Custom size…',                             w: 1200, h: 800 }
};

/* ---------- templates ---------- */
/* `uses` drives which content fields the panel shows for each layout. */

export const TEMPLATES = {
  'bold-left':      { label: 'Bold Left — oversized JUST SOLD over a faded photo', uses: ['kicker', 'model', 'tagline'] },
  'diagonal-split': { label: 'Chevron Split — script headline beside the photo',   uses: ['script', 'model', 'tagline'] },
  'full-bleed':     { label: 'Full Bleed — corner tag with a footer bar',          uses: ['script', 'model', 'tagline'] },
  'editorial':      { label: 'Editorial — serif headline with a spec strip',       uses: ['kicker', 'model', 'tagline', 'specs'] }
};

/* ---------- defaults ---------- */

export const DEFAULTS = {
  template: 'bold-left',

  canvas: {
    preset: '1200x800',
    width: 1200,
    height: 800,
    exportScale: 2,
    format: 'png'
  },

  photo: {
    zoom: 1,
    offsetX: 0,         // free pan, as a fraction of the frame
    offsetY: 0,
    brightness: 1,
    contrast: 1,
    saturate: 1,
    overlay: '#0a1730',
    overlayOpacity: 0,
    fadeOpacity: 0.92,  // how dark the fade gets at full strength
    fadeLength: 0.66,   // how far across the frame it reaches
    fadeHold: 0.30      // how much of that reach stays solid before falling off
  },

  // How wide the text column is allowed to be, as a fraction of the canvas.
  // This is what caps a headline's size when "shrink to fit" is on.
  layout: { textWidth: 0.50 },

  // Per-text nudges, as fractions of the canvas. Set by dragging on the
  // preview or by the sliders; they never shift the blocks around them.
  offsets: {
    display: { x: 0, y: 0 },
    script:  { x: 0, y: 0 },
    model:   { x: 0, y: 0 },
    tagline: { x: 0, y: 0 }
  },

  brand: {
    primary:   '#0f2044',
    secondary: '#2bb8b3',
    dark:      '#0a1730',
    light:     '#ffffff',
    accent:    '#9fb0c9'
  },

  logo: {
    position: 'bottom-right',   // 9 anchors, or 'custom' once dragged
    size: 190,                  // rendered width in design px
    offsetX: 48,                // inset from the anchored edge
    offsetY: 40,
    customX: 0.86,              // used when position === 'custom'
    customY: 0.82,
    opacity: 1,
    padding: 26,                // gap between artwork and wrapper edge
    wrapper: {
      shape: 'circle',          // none | circle | square | rounded | pill | shield | banner
      fill: '#ffffff',
      opacity: 1,
      radius: 28,
      borderWidth: 0,
      borderColor: '#0f2044',
      shadow: 0.18,
      diameter: 0,              // 0 = size the badge from the art + padding
      bleed: 'none',            // none | bottom | corner
      bleedAmount: 0.3          // fraction of the badge hanging off the edge
    }
  },

  // Brand typography lifted from the dealership website. When the locks are
  // on, secondary roles follow the site's body face automatically, so a
  // tagline can never drift away from the site's own voice.
  siteType: {
    heading: 'Anton',
    body: 'Montserrat',
    lockHeading: false,
    lockSecondary: false
  },

  type: {
    // Oversized "JUST SOLD" headline
    display: {
      family: 'Anton', weight: 400, size: 128, tracking: -2,
      lineHeight: 0.92, transform: 'uppercase', color: '#ffffff', fit: true
    },
    // Handwritten "Just Sold!" headline
    script: {
      family: 'Great Vibes', weight: 400, size: 118, tracking: 0,
      lineHeight: 1, transform: 'none', color: '#0f2044', fit: true
    },
    // The boat itself — year, make, model
    model: {
      family: 'Montserrat', weight: 800, size: 42, tracking: 1,
      lineHeight: 1.2, transform: 'uppercase', color: '#ffffff', fit: true
    },
    // Secondary line; defaults are the site's body face
    tagline: {
      family: 'Montserrat', weight: 500, size: 26, tracking: 3.5,
      lineHeight: 1.45, transform: 'uppercase', color: '#c9d4e4', fit: true
    },
    // Spec strip labels/values on the editorial layout
    spec: {
      family: 'Montserrat', weight: 700, size: 16, tracking: 1.6,
      lineHeight: 1.5, transform: 'uppercase', color: '#0f2044', fit: true
    }
  },

  rule: {
    show: true,
    color: '#2bb8b3',
    width: 120,
    thickness: 5
  },

  // Design 3 brackets the boat name between two rules of different lengths.
  ruleB: {
    show: false,
    color: '#2bb8b3',
    width: 270,
    thickness: 3
  },

  // Design 4's geometric divider. x values are fractions of canvas width.
  divider: {
    style: 'diagonal',
    topX: 0.405,
    midX: 0.39,
    bottomX: 0.468,
    band: 0.022,
    band2: 0.016,
    ghost: 0.10,
    color: '#12244d',
    color2: '#c8d4e2'
  },

  text: {
    kicker: 'JUST\nSOLD',
    script: 'Just Sold!',
    model: '2026 SEA FOX\n268 COMMANDER',
    tagline: 'Congratulations to the new owner!',
    specs: [
      { label: 'Model',      value: '268 Commander' },
      { label: 'Year',       value: '2026' },
      { label: 'Length',     value: '26.0 ft' },
      { label: 'Horsepower', value: '400hp' }
    ]
  }
};

/* ---------- control schema ---------- */
/* type: range | number | color | select | font | text | textarea | checkbox
   `show` optionally limits a control to certain templates.              */

const fontOpts = kind => FONT_CATALOG[kind];
const WEIGHTS = [
  { value: 300, label: 'Light 300' }, { value: 400, label: 'Regular 400' },
  { value: 500, label: 'Medium 500' }, { value: 600, label: 'Semibold 600' },
  { value: 700, label: 'Bold 700' }, { value: 800, label: 'Extrabold 800' },
  { value: 900, label: 'Black 900' }
];
const TRANSFORMS = [
  { value: 'none', label: 'As typed' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
  { value: 'capitalize', label: 'Title Case' }
];

/** `role` keys the nudge offsets and the drag hit-testing. */
function typeGroup(id, title, path, kind, opts = {}) {
  const role = opts.role || path.split('.')[1];
  const f = [
    { key: `${path}.family`, label: 'Font family', type: 'font', options: fontOpts(kind), when: opts.familyWhen },
    { key: `${path}.size`, label: 'Size', type: 'range', box: true, min: 8, max: opts.maxSize || 400, step: 0.1, unit: 'px' },
    { key: `${path}.tracking`, label: 'Letter spacing', type: 'range', box: true, min: -8, max: 24, step: 0.1, unit: 'px' },
    { key: `${path}.lineHeight`, label: 'Line height', type: 'range', box: true, min: 0.7, max: 2.2, step: 0.01, unit: '×' },
    { key: `${path}.color`, label: 'Colour', type: 'color' },
    { key: `${path}.fit`, label: 'Shrink to fit column', type: 'checkbox' }
  ];
  if (role !== 'spec') {
    f.push(
      { key: `offsets.${role}.x`, label: 'Nudge ↔', type: 'range', min: -0.6, max: 0.6, step: 0.002 },
      { key: `offsets.${role}.y`, label: 'Nudge ↕', type: 'range', min: -0.6, max: 0.6, step: 0.002 }
    );
  }
  if (kind !== 'script') {
    f.splice(1, 0, { key: `${path}.weight`, label: 'Weight', type: 'select', options: WEIGHTS, numeric: true });
    f.push({ key: `${path}.transform`, label: 'Case', type: 'select', options: TRANSFORMS });
  }
  return { id, title, tab: 'text', collapsed: true, show: opts.show, fields: f };
}

export const SCHEMA = [
  {
    id: 'canvas', tab: 'export', title: 'Canvas & export',
    fields: [
      { key: 'canvas.preset', label: 'Size preset', type: 'select',
        options: Object.entries(CANVAS_PRESETS).map(([value, p]) => ({ value, label: p.label })) },
      { key: 'canvas.width', label: 'Width', type: 'number', min: 320, max: 4096, step: 1, unit: 'px', when: s => s.canvas.preset === 'custom' },
      { key: 'canvas.height', label: 'Height', type: 'number', min: 320, max: 4096, step: 1, unit: 'px', when: s => s.canvas.preset === 'custom' },
      { key: 'canvas.exportScale', label: 'Export scale', type: 'select', numeric: true,
        options: [{ value: 1, label: '1× (design size)' }, { value: 2, label: '2× (retina)' }, { value: 3, label: '3× (print-ish)' }] },
      { key: 'canvas.format', label: 'File format', type: 'select',
        options: [{ value: 'png', label: 'PNG — sharpest text' }, { value: 'jpeg', label: 'JPEG — smaller file' }] }
    ]
  },
  {
    id: 'photo', tab: 'photo', title: 'Boat photo',
    note: 'Move the photo with the sliders, or drag it directly on the preview.',
    fields: [
      { key: 'photo.offsetX', label: 'Move photo ↔', type: 'range', min: -1, max: 1, step: 0.005 },
      { key: 'photo.offsetY', label: 'Move photo ↕', type: 'range', min: -1, max: 1, step: 0.005 },
      { key: 'photo.zoom', label: 'Zoom', type: 'range', min: 0.5, max: 4, step: 0.01, unit: '×' },
      { key: 'photo.brightness', label: 'Brightness', type: 'range', min: 0.4, max: 1.6, step: 0.01, unit: '×' },
      { key: 'photo.contrast', label: 'Contrast', type: 'range', min: 0.4, max: 1.8, step: 0.01, unit: '×' },
      { key: 'photo.saturate', label: 'Saturation', type: 'range', min: 0, max: 2, step: 0.01, unit: '×' },
      { key: 'photo.overlay', label: 'Tint colour', type: 'color' },
      { key: 'photo.overlayOpacity', label: 'Tint strength', type: 'range', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    id: 'fade', tab: 'photo', title: 'Colour fade', show: ['design-3', 'bold-left', 'full-bleed'],
    note: 'The brand-coloured field the headline sits on. Hold keeps it solid before it starts dissolving into the photo.',
    fields: [
      { key: 'photo.fadeOpacity', label: 'Fade opacity', type: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'photo.fadeLength', label: 'Fade length', type: 'range', min: 0.1, max: 1, step: 0.005 },
      { key: 'photo.fadeHold', label: 'Solid hold', type: 'range', min: 0, max: 0.9, step: 0.005 }
    ]
  },
  {
    id: 'layout', tab: 'text', title: 'Text column',
    note: 'How wide text may run before "shrink to fit" kicks in. Widen this to let a headline get bigger.',
    fields: [
      { key: 'layout.textWidth', label: 'Column width', type: 'range', min: 0.2, max: 1, step: 0.005 }
    ]
  },
  {
    id: 'brand', tab: 'style', title: 'Brand colours',
    note: 'Extracted from your logo, or set by hand. Templates reference these slots.',
    fields: [
      { key: 'brand.primary', label: 'Primary', type: 'color' },
      { key: 'brand.secondary', label: 'Secondary / accent', type: 'color' },
      { key: 'brand.dark', label: 'Dark', type: 'color' },
      { key: 'brand.light', label: 'Light', type: 'color' },
      { key: 'brand.accent', label: 'Muted', type: 'color' }
    ]
  },
  {
    id: 'logo', tab: 'logo', title: 'Logo placement & size',
    fields: [
      { key: 'logo.position', label: 'Anchor', type: 'select', options: [
        { value: 'top-left', label: 'Top left' }, { value: 'top-center', label: 'Top centre' }, { value: 'top-right', label: 'Top right' },
        { value: 'mid-left', label: 'Middle left' }, { value: 'mid-center', label: 'Centre' }, { value: 'mid-right', label: 'Middle right' },
        { value: 'bottom-left', label: 'Bottom left' }, { value: 'bottom-center', label: 'Bottom centre' }, { value: 'bottom-right', label: 'Bottom right' },
        { value: 'custom', label: 'Custom (drag on canvas)' }
      ] },
      { key: 'logo.size', label: 'Logo width', type: 'range', min: 40, max: 620, step: 1, unit: 'px' },
      { key: 'logo.offsetX', label: 'Edge inset ↔', type: 'range', min: -120, max: 260, step: 1, unit: 'px', when: s => s.logo.position !== 'custom' },
      { key: 'logo.offsetY', label: 'Edge inset ↕', type: 'range', min: -120, max: 260, step: 1, unit: 'px', when: s => s.logo.position !== 'custom' },
      { key: 'logo.customX', label: 'Position ↔', type: 'range', min: -0.2, max: 1.2, step: 0.005, when: s => s.logo.position === 'custom' },
      { key: 'logo.customY', label: 'Position ↕', type: 'range', min: -0.2, max: 1.2, step: 0.005, when: s => s.logo.position === 'custom' },
      { key: 'logo.opacity', label: 'Opacity', type: 'range', min: 0.1, max: 1, step: 0.01 }
    ]
  },
  {
    id: 'wrapper', tab: 'logo', title: 'Logo background wrapper',
    fields: [
      { key: 'logo.wrapper.shape', label: 'Shape', type: 'select', options: [
        { value: 'none', label: 'None — logo only' }, { value: 'circle', label: 'Circle' },
        { value: 'rounded', label: 'Rounded square' }, { value: 'square', label: 'Square' },
        { value: 'pill', label: 'Pill' }, { value: 'shield', label: 'Shield / badge' },
        { value: 'banner', label: 'Full-width banner' }
      ] },
      { key: 'logo.wrapper.diameter', label: 'Badge size (0 = auto)', type: 'range', min: 0, max: 700, step: 1, unit: 'px' },
      { key: 'logo.padding', label: 'Inner padding', type: 'range', min: 0, max: 160, step: 1, unit: 'px',
        when: s => !s.logo.wrapper.diameter },
      { key: 'logo.wrapper.bleed', label: 'Bleed off edge', type: 'select', options: [
        { value: 'none', label: 'Keep fully on canvas' },
        { value: 'bottom', label: 'Off the bottom' },
        { value: 'corner', label: 'Into the nearest corner' }
      ] },
      { key: 'logo.wrapper.bleedAmount', label: 'Bleed amount', type: 'range', min: 0, max: 0.6, step: 0.005,
        when: s => s.logo.wrapper.bleed !== 'none' },
      { key: 'logo.wrapper.fill', label: 'Fill colour', type: 'color' },
      { key: 'logo.wrapper.opacity', label: 'Fill opacity', type: 'range', min: 0, max: 1, step: 0.01 },
      { key: 'logo.wrapper.radius', label: 'Corner radius', type: 'range', min: 0, max: 120, step: 1, unit: 'px' },
      { key: 'logo.wrapper.borderWidth', label: 'Border width', type: 'range', min: 0, max: 20, step: 0.5, unit: 'px' },
      { key: 'logo.wrapper.borderColor', label: 'Border colour', type: 'color' },
      { key: 'logo.wrapper.shadow', label: 'Drop shadow', type: 'range', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    id: 'content', tab: 'text', title: 'Text content',
    fields: [
      { key: 'text.kicker', label: 'Headline (one line per row)', type: 'textarea', rows: 2, show: ['design-3', 'bold-left', 'editorial'] },
      { key: 'text.script', label: 'Script headline', type: 'textarea', rows: 2, show: ['design-4', 'diagonal-split', 'full-bleed'] },
      { key: 'text.model', label: 'Boat / model', type: 'textarea', rows: 2 },
      { key: 'text.tagline', label: 'Tagline', type: 'textarea', rows: 2 }
    ]
  },
  {
    id: 'site-type', tab: 'text', title: 'Website typography',
    note: 'Set the two faces your site uses. With the locks on, secondary text and taglines follow the site body font automatically.',
    fields: [
      { key: 'siteType.heading', label: 'Site heading font', type: 'font', options: fontOpts('display') },
      { key: 'siteType.body', label: 'Site body font', type: 'font', options: fontOpts('text') },
      { key: 'siteType.lockHeading', label: 'Lock headline to site heading', type: 'checkbox' },
      { key: 'siteType.lockSecondary', label: 'Lock secondary text & taglines to site body', type: 'checkbox' }
    ]
  },
  typeGroup('type-display', 'Type — headline', 'type.display', 'display', { maxSize: 500, show: ['design-3', 'bold-left', 'editorial'], familyWhen: st => !st.siteType.lockHeading }),
  typeGroup('type-script', 'Type — script headline', 'type.script', 'script', { maxSize: 500, show: ['design-4', 'diagonal-split', 'full-bleed'] }),
  typeGroup('type-model', 'Type — boat / model', 'type.model', 'text', { maxSize: 260, familyWhen: st => !st.siteType.lockSecondary }),
  typeGroup('type-tagline', 'Type — tagline & secondary', 'type.tagline', 'text', { maxSize: 220, familyWhen: st => !st.siteType.lockSecondary }),
  typeGroup('type-spec', 'Type — spec strip', 'type.spec', 'text', { maxSize: 60, show: ['editorial'], familyWhen: st => !st.siteType.lockSecondary }),
  {
    id: 'rule', tab: 'style', title: 'Accent rule',
    fields: [
      { key: 'rule.show', label: 'Show accent rule', type: 'checkbox' },
      { key: 'rule.color', label: 'Colour', type: 'color' },
      { key: 'rule.width', label: 'Length', type: 'range', min: 20, max: 400, step: 1, unit: 'px' },
      { key: 'rule.thickness', label: 'Thickness', type: 'range', min: 1, max: 24, step: 0.5, unit: 'px' }
    ]
  },
  {
    id: 'ruleB', tab: 'style', title: 'Second accent rule', show: ['design-3'],
    note: 'The shorter rule sits above the boat name, this one below it.',
    fields: [
      { key: 'ruleB.show', label: 'Show second rule', type: 'checkbox' },
      { key: 'ruleB.color', label: 'Colour', type: 'color' },
      { key: 'ruleB.width', label: 'Length', type: 'range', min: 20, max: 500, step: 1, unit: 'px' },
      { key: 'ruleB.thickness', label: 'Thickness', type: 'range', min: 1, max: 24, step: 0.5, unit: 'px' }
    ]
  },
  {
    id: 'divider', tab: 'style', title: 'Geometric divider', show: ['design-4'],
    note: 'Where the photo starts, as a fraction of the width — top edge and bottom edge separately, so the angle is yours to set.',
    fields: [
      { key: 'divider.style', label: 'Shape', type: 'select', options: [
        { value: 'diagonal', label: 'Straight diagonal' },
        { value: 'chevron', label: 'Chevron (points left at centre)' }
      ] },
      { key: 'divider.topX', label: 'Top edge', type: 'range', min: 0.1, max: 0.9, step: 0.002 },
      { key: 'divider.bottomX', label: 'Bottom edge', type: 'range', min: 0.1, max: 0.9, step: 0.002 },
      { key: 'divider.midX', label: 'Chevron point', type: 'range', min: 0.1, max: 0.9, step: 0.002,
        when: s => s.divider.style === 'chevron' },
      { key: 'divider.color', label: 'Band colour', type: 'color' },
      { key: 'divider.band', label: 'Band width', type: 'range', min: 0, max: 0.12, step: 0.001 },
      { key: 'divider.color2', label: 'Outer band colour', type: 'color' },
      { key: 'divider.band2', label: 'Outer band width', type: 'range', min: 0, max: 0.12, step: 0.001 },
      { key: 'divider.ghost', label: 'Photo wash on panel', type: 'range', min: 0, max: 0.5, step: 0.01 }
    ]
  }
];
