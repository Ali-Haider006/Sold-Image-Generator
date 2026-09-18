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
    position: 'bottom-right', size: 150, offsetX: 35, offsetY: -14, padding: 30,
    wrapper: {
      shape: 'circle', fill: '#ffffff', opacity: 1, shadow: 0,
      diameter: 245, bleed: 'none', bleedAmount: 0.3
    }
  },
  rule:  { show: true, color: '#2bb8b3', width: 180, thickness: 3 },
  ruleB: { show: true, color: '#2bb8b3', width: 270, thickness: 3 },
  layout: { textWidth: 0.50 },
  photo: { fadeOpacity: 1, fadeLength: 0.66, fadeHold: 0.38, offsetX: 0.06, zoom: 1.1 }
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
    position: 'top-right', size: 104, offsetX: 23, offsetY: 23, padding: 20,
    wrapper: {
      shape: 'circle', fill: '#ffffff', opacity: 1, shadow: 0.12,
      diameter: 146, bleed: 'none', bleedAmount: 0.3
    }
  },
  layout: { textWidth: 0.32 },
  rule: { show: true, color: '#2bb8b3', width: 120, thickness: 4 },
  divider: {
    style: 'diagonal', topX: 0.405, midX: 0.39, bottomX: 0.468,
    band: 0.022, band2: 0.016, ghost: 0.07,
    color: '#12244d', color2: '#c8d4e2'
  },
  photo: { offsetX: 0, offsetY: 0, zoom: 1.1 }
};

/* Full Bleed, measured off the reference at 1200x800. */
const FULL_BLEED = {
  template: 'full-bleed',
  type: {
    script: {
      family: 'Breathing', weight: 400, size: 82, tracking: 0,
      lineHeight: 1.0, transform: 'none', color: '#ffffff', fit: true
    },
    model: {
      family: 'Montserrat', weight: 800, size: 38, tracking: 1.2,
      lineHeight: 1.22, transform: 'uppercase', color: '#ffffff', fit: true
    },
    tagline: {
      family: 'Montserrat', weight: 500, size: 26, tracking: 3.2,
      lineHeight: 1.45, transform: 'uppercase', color: '#dfe6ef', fit: true
    }
  },
  text: {
    script: 'Just\nSold!',
    model: '2026 SEA FOX\n268 COMMANDER',
    tagline: 'CONGRATULATIONS\nTO THE NEW OWNER!'
  },
  logo: {
    position: 'bottom-right', size: 158, offsetX: 20, offsetY: -13, padding: 30,
    wrapper: {
      shape: 'circle', fill: '#ffffff', opacity: 1, shadow: 0,
      diameter: 225, bleed: 'none', bleedAmount: 0.3
    }
  },
  rule: { show: true, color: '#ffffff', width: 2, thickness: 2 },
  panels: {
    tagX: 0, tagY: 0, tagW: 0.31, tagH: 0.3625,
    tagFill: '#12244d', tagOpacity: 1,
    barH: 0.181, barFill: '#12244d', barOpacity: 1,
    dividerX: 0.4125, fade: 0
  },
  photo: { zoom: 1.02, offsetX: 0, offsetY: 0 }
};

/* Design 5, measured off the reference at 1200x800. Type sizes are my own
   call rather than a supplied spec, so they are round-ish numbers chosen to
   sit correctly against the reference's proportions. */
const DESIGN_5 = {
  template: 'design-5',
  type: {
    script: {
      family: 'Breathing', weight: 400, size: 152, tracking: 0,
      lineHeight: 1.0, transform: 'none', color: '#ffffff', fit: true
    },
    model: {
      family: 'Montserrat', weight: 700, size: 25.5, tracking: 2.4,
      lineHeight: 1.3, transform: 'uppercase', color: '#dfe6f2', fit: true
    },
    spec: {
      family: 'Montserrat', weight: 700, size: 17.5, tracking: 1.8,
      lineHeight: 1.5, transform: 'uppercase', color: '#ffffff', fit: true
    }
  },
  text: {
    script: 'Just Sold!',
    model: '2026 SEA FOX 268 COMMANDER',
    specs: [
      { label: 'Model',      value: '268 Commander' },
      { label: 'Year',       value: '2026' },
      { label: 'Length',     value: '26.0 ft' },
      { label: 'Horsepower', value: '400hp' }
    ]
  },
  logo: {
    // No badge here — the mark sits straight on the navy, so it needs the
    // reversed file, or a white knockout when none has been supplied.
    variant: 'reversed', knockout: true, knockoutColor: '#ffffff',
    position: 'custom', customX: 0.89, customY: 0.60,
    size: 162, padding: 0,
    wrapper: { shape: 'none', opacity: 0, shadow: 0, diameter: 0, bleed: 'none' }
  },
  rule: { show: false },
  frame: {
    // One continuous diagonal from the top band to the right edge — the navy
    // it opens up is what the badge sits on, around 60% of the height.
    topLeft: 0.081, topRight: 0.8225,
    riseFrom: 0.338, riseTo: 1.0,
    strip: 0.8625, stripFrom: 0.338, stripTo: 0.271,
    specLeft: 0.375, specRight: 0.95,
    textRight: 0.905, scriptY: 0.19, modelY: 0.328,
    stripes: 3, stripeOpacity: 0.16
  },
  photo: { zoom: 1.04, offsetX: 0, offsetY: 0 }
};

/* Design 2, measured off the reference at 1200x800. */
const DESIGN_2 = {
  template: 'design-2',
  canvas: { preset: '1200x800', width: 1200, height: 800, exportScale: 1, format: 'png' },
  type: {
    script: {
      family: 'Breathing', weight: 400, size: 158, tracking: 0,
      lineHeight: 1.0, transform: 'none', color: '#ffffff',
      fit: true, rotate: 0, opacity: 1
    },
    model: {
      family: 'Montserrat', weight: 700, size: 30, tracking: 1.1,
      lineHeight: 1.2, transform: 'uppercase', color: '#e65a0a',
      fit: true, rotate: 0, opacity: 1
    },
    spec: {
      family: 'Montserrat', weight: 700, size: 19, tracking: 1.4,
      lineHeight: 1.5, transform: 'uppercase', color: '#ffffff',
      fit: true, rotate: 0, opacity: 1
    }
  },
  text: {
    script: 'Just Sold!',
    model: '2026 SEA FOX 268 COMMANDER'
  },
  logo: {
    variant: 'main', knockout: false,
    position: 'top-right', size: 118, offsetX: 60, offsetY: 8, padding: 16,
    wrapper: {
      shape: 'circle', fill: '#ffffff', opacity: 1, shadow: 0.1,
      diameter: 150, bleed: 'none', bleedAmount: 0.3
    }
  },
  rule: { show: false },
  water: {
    y: 0.45, scale: 1.0, offsetX: 0, keyWhite: 1,
    deep: '#06304f', deepStart: 0.55,
    scrim: '#04223a', scrimOpacity: 0.56, scrimReach: 0.6,
    scriptY: 0.672, scriptWidth: 0.68,
    headingY: 0.818,
    specLeft: 0.1875, specRight: 0.8125,
    specY: 0.855, specH: 0.115
  },
  photo: { zoom: 1.0, offsetX: 0, offsetY: -0.06 }
};

export const DESIGNS = [
  {
    id: 'design-2', slot: 2, name: 'Waterline', status: 'ready',
    blurb: 'Boat half-submerged, script over the water, orange heading, spec row.',
    preset: DESIGN_2,
    /** The heading is one line here, not stacked. */
    modelTransform: t => t.replace(/\s*\n+\s*/g, ' '),
    /**
     * Only the badge and the deep water follow the logo. The script stays
     * white and the heading stays orange — the brief pins both, and a palette
     * that overrode them would stop reproducing the reference.
     */
    paletteMap(S, r) {
      S.brand.dark = r.primary;
      S.brand.light = r.light;
      S.logo.wrapper.fill = r.light;
      S.type.script.color = r.light;
      S.type.spec.color = r.light;
    }
  },
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
    id: 'design-5', slot: 5, name: 'Signature Frame', status: 'ready',
    blurb: 'Signature script on navy, photo cut to an angled frame, spec strip.',
    preset: DESIGN_5,
    /** The reference sets the boat name on one line, not stacked. */
    modelTransform: t => t.replace(/\s*\n+\s*/g, ' '),
    /** Navy ground and diagonals from the logo; type knocks out in white. */
    paletteMap(S, r) {
      S.brand.dark = r.primary;
      S.brand.light = r.light;
      S.photo.overlay = r.primary;
      S.type.script.color = r.light;
      S.type.model.color = tint(r.primary, 0.84);
      S.type.spec.color = r.light;
      S.logo.knockoutColor = r.light;
    }
  },
  {
    id: 'full-bleed', slot: 6, name: 'Full Bleed', status: 'ready',
    blurb: 'Photo edge to edge, solid corner tag, solid footer bar.',
    preset: FULL_BLEED,
    /** Both panels and the type take the logo's major colour. */
    paletteMap(S, r) {
      S.panels.tagFill = r.primary;
      S.panels.barFill = r.primary;
      S.brand.dark = r.primary;
      S.type.script.color = r.light;
      S.type.model.color = r.light;
      S.type.tagline.color = tint(r.primary, 0.86);
      S.rule.color = r.light;
      S.logo.wrapper.fill = r.light;
    }
  },
  {
    id: 'draft-editorial', slot: 7, name: 'Editorial', status: 'draft',
    blurb: 'Numbered, but still on its first-pass layout — send the reference and type spec to finish it.',
    preset: { template: 'editorial' },
    paletteMap: null
  }
];

export const DESIGN_SLOTS = 8;
export const byId = id => DESIGNS.find(d => d.id === id);

/** Gallery order follows the slot numbers; anything unnumbered trails them. */
export const inSlotOrder = () =>
  [...DESIGNS].sort((a, b) => (a.slot || 99) - (b.slot || 99));

/** Slot numbers with no design assigned to them at all. */
export const emptySlots = () => {
  const taken = new Set(DESIGNS.map(d => d.slot).filter(Boolean));
  return Array.from({ length: DESIGN_SLOTS }, (_, i) => i + 1).filter(n => !taken.has(n));
};

/** Numbered, but the layout is still a first pass rather than a spec. */
export const draftSlots = () =>
  DESIGNS.filter(d => d.slot && d.status !== 'ready').map(d => d.slot).sort((a, b) => a - b);
