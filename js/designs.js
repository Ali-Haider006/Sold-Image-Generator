/* ------------------------------------------------------------------
   designs.js — the design catalogue
   ------------------------------------------------------------------
   Eight numbered designs are planned; each is specified and built one at a
   time. A slot with no spec yet shows in the gallery as a placeholder so
   the set's shape stays visible.

   Every entry carries:
     renderer   which layout in templates.js paints it
     preset     its own type, colour, logo and geometry settings
     paletteMap how the colours extracted from the logo land on it —
                each design uses the palette differently, so this is per
                design rather than one global rule
------------------------------------------------------------------- */

import { tint } from './palette.js';

/** Sizes below are px at the 1200x800 reference the designs were drawn at. */

const DESIGN_3 = {
  template: 'design-3',
  type: {
    display: {
      family: 'Intro Rust', weight: 400, size: 150, tracking: 0,
      lineHeight: 0.90, transform: 'uppercase', color: '#ffffff'
    },
    model: {
      family: 'Montserrat', weight: 800, size: 33.3, tracking: 1.2,
      lineHeight: 1.3, transform: 'uppercase', color: '#ffffff'
    },
    tagline: {
      family: 'Montserrat', weight: 500, size: 31.7, tracking: 2.2,
      lineHeight: 1.4, transform: 'uppercase', color: '#c3ccd8'
    }
  },
  text: {
    kicker: 'JUST\nSOLD',
    model: '2026 SEA FOX\n268 COMMANDER',
    tagline: 'ANOTHER DREAM\nON THE WATER!'
  },
  logo: {
    position: 'bottom-right', size: 185, offsetX: 36, offsetY: -22, padding: 30,
    wrapper: { shape: 'circle', fill: '#ffffff', opacity: 1, shadow: 0, bleed: 'none' }
  },
  rule:  { show: true, color: '#2bb8b3', width: 180, thickness: 3 },
  ruleB: { show: true, color: '#2bb8b3', width: 270, thickness: 3 },
  photo: { scrimStrength: 1, focusX: 0.62 }
};

const DESIGN_4 = {
  template: 'design-4',
  type: {
    script: {
      family: 'Breathing', weight: 400, size: 92.2, tracking: 0,
      lineHeight: 1.05, transform: 'none', color: '#12244d'
    },
    model: {
      family: 'Montserrat', weight: 800, size: 30.3, tracking: 1.2,
      lineHeight: 1.32, transform: 'uppercase', color: '#12244d'
    },
    tagline: {
      family: 'Montserrat', weight: 500, size: 22.7, tracking: 2.6,
      lineHeight: 1.55, transform: 'uppercase', color: '#8b939e'
    }
  },
  text: {
    script: 'Just\nSold!',
    model: '2026 SEA FOX\n268 COMMANDER',
    tagline: 'CONGRATULATIONS\nTO THE NEW OWNER!'
  },
  logo: {
    position: 'top-right', size: 112, offsetX: 23, offsetY: 23, padding: 17,
    wrapper: { shape: 'circle', fill: '#ffffff', opacity: 1, shadow: 0.12, bleed: 'none' }
  },
  rule: { show: true, color: '#2bb8b3', width: 120, thickness: 4 },
  divider: {
    style: 'diagonal', topX: 0.405, midX: 0.39, bottomX: 0.468,
    band: 0.022, band2: 0.016, ghost: 0.07,
    color: '#12244d', color2: '#c8d4e2'
  },
  photo: { focusX: 0.5 }
};

export const DESIGNS = [
  {
    id: 'design-3', slot: 3, name: 'Bold Fade', status: 'ready',
    blurb: 'Oversized JUST SOLD over a brand-coloured fade, badge bottom right.',
    preset: DESIGN_3,
    /** Fade colour is the logo's major colour; type stays white on it. */
    paletteMap(S, r) {
      S.brand.dark = r.primary;
      S.photo.overlay = r.primary;
      S.type.display.color = r.light;
      S.type.model.color = r.light;
      S.type.tagline.color = tint(r.primary, 0.72);
      S.rule.color = r.secondary;
      S.ruleB.color = r.secondary;
      S.logo.wrapper.fill = r.light;
    }
  },
  {
    id: 'design-4', slot: 4, name: 'Diagonal Divider', status: 'ready',
    blurb: 'Brush script on a light panel, geometric diagonal into the photo.',
    preset: DESIGN_4,
    /** Script, boat name and divider all take the logo's major colour. */
    paletteMap(S, r) {
      S.brand.light = '#ffffff';
      S.type.script.color = r.primary;
      S.type.model.color = r.primary;
      S.type.tagline.color = '#8b939e';      // spec pins the tagline to grey
      S.divider.color = r.primary;
      S.divider.color2 = tint(r.primary, 0.78);
      S.rule.color = r.secondary;
      S.logo.wrapper.fill = r.light;
    }
  },
  {
    id: 'draft-full-bleed', slot: null, name: 'Full Bleed', status: 'draft',
    blurb: 'Not yet numbered or spec’d — corner tag with a footer bar.',
    preset: { template: 'full-bleed' },
    paletteMap: null
  },
  {
    id: 'draft-editorial', slot: null, name: 'Editorial', status: 'draft',
    blurb: 'Not yet numbered or spec’d — serif column with a spec strip.',
    preset: { template: 'editorial' },
    paletteMap: null
  }
];

export const DESIGN_SLOTS = 8;
export const byId = id => DESIGNS.find(d => d.id === id);

/** The numbered slots still waiting on a specification. */
export const pendingSlots = () => {
  const taken = new Set(DESIGNS.map(d => d.slot).filter(Boolean));
  return Array.from({ length: DESIGN_SLOTS }, (_, i) => i + 1).filter(n => !taken.has(n));
};
