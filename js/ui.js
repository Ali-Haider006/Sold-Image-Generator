/* ------------------------------------------------------------------
   ui.js — builds the control panel from SCHEMA
   ------------------------------------------------------------------
   Controls are built once and then refreshed in place, so dragging the
   logo on the canvas moves its sliders without tearing down the DOM (and
   without losing focus on whatever field is being typed into).
------------------------------------------------------------------- */

import { SCHEMA, get, set } from './settings.js';
import { ensureFont, stack } from './fonts.js';

const round = v => Math.round(v * 1000) / 1000;

/** Compact read-only readout for a slider-only control. */
function format(v, field) {
  const n = round(v);
  if (field.unit === 'px') return n + 'px';
  if (field.unit === '×') return n + '×';
  // Fractions of the canvas read better as percentages than as 0.405.
  if (field.max <= 1.2 && field.min >= -1.2) return Math.round(v * 100) + '%';
  return String(n);
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export class Panel {
  /**
   * @param {HTMLElement} root  container the sections are appended to
   * @param {Object} settings   live settings object (mutated in place)
   * @param {Function} onChange called with (key, value) after every edit
   */
  constructor(root, settings, onChange) {
    this.root = root;
    this.S = settings;
    this.onChange = onChange;
    this.controls = new Map();   // key -> {row, read, write, field}
    this.sections = new Map();
    this.build();
  }

  build() {
    this.root.innerHTML = '';
    for (const group of SCHEMA) {
      const sec = el('section', 'group');
      if (group.tab) sec.dataset.tab = group.tab;
      if (group.collapsed) sec.classList.add('collapsed');
      const head = el('button', 'group-head');
      head.type = 'button';
      head.innerHTML = `<span>${group.title}</span><span class="chev" aria-hidden="true">▾</span>`;
      const body = el('div', 'group-body');

      if (group.note) body.appendChild(el('p', 'note', group.note));
      for (const field of group.fields) body.appendChild(this.buildField(field, group));

      sec.append(head, body);
      this.root.appendChild(sec);
      this.sections.set(group.id, { sec, group });
    }
    this.refresh();
  }

  buildField(field, group) {
    const row = el('div', 'row');
    const label = el('label', 'row-label', field.label);
    label.htmlFor = 'f-' + field.key;
    row.appendChild(label);

    const wrap = el('div', 'row-input');
    let read, write;

    switch (field.type) {
      case 'range': {
        const r = el('input'); r.type = 'range'; r.id = 'f-' + field.key;
        r.min = field.min; r.max = field.max; r.step = field.step;
        wrap.appendChild(r);

        // Spatial values are set by dragging the slider alone. Only fields
        // marked `box` — the type properties, where an exact 33.3 has to be
        // typeable — also get an editable number input.
        if (field.box) {
          const n = el('input', 'num'); n.type = 'number';
          n.min = field.min; n.max = field.max; n.step = field.step;
          r.addEventListener('input', () => { n.value = r.value; this.commit(field.key, +r.value); });
          n.addEventListener('input', () => {
            const v = +n.value;
            if (Number.isFinite(v)) { r.value = v; this.commit(field.key, v); }
          });
          wrap.appendChild(n);
          if (field.unit) wrap.appendChild(el('span', 'unit', field.unit));
          read = () => +r.value;
          write = v => { r.value = v; if (document.activeElement !== n) n.value = round(v); };
        } else {
          const out = el('span', 'readout-val');
          r.addEventListener('input', () => {
            out.textContent = format(+r.value, field);
            this.commit(field.key, +r.value);
          });
          wrap.appendChild(out);
          read = () => +r.value;
          write = v => { r.value = v; out.textContent = format(v, field); };
        }
        break;
      }
      case 'number': {
        const n = el('input', 'num wide'); n.type = 'number'; n.id = 'f-' + field.key;
        n.min = field.min; n.max = field.max; n.step = field.step;
        n.addEventListener('input', () => this.commit(field.key, +n.value));
        wrap.appendChild(n);
        if (field.unit) wrap.appendChild(el('span', 'unit', field.unit));
        read = () => +n.value; write = v => { n.value = v; };
        break;
      }
      case 'color': {
        const c = el('input', 'swatch'); c.type = 'color'; c.id = 'f-' + field.key;
        const t = el('input', 'hex'); t.type = 'text'; t.spellcheck = false;
        c.addEventListener('input', () => { t.value = c.value; this.commit(field.key, c.value); });
        t.addEventListener('input', () => {
          const v = t.value.trim();
          if (/^#?[0-9a-f]{6}$/i.test(v)) {
            const hx = v.startsWith('#') ? v : '#' + v;
            c.value = hx; this.commit(field.key, hx);
          }
        });
        wrap.append(c, t);
        read = () => c.value; write = v => { c.value = v; t.value = v; };
        break;
      }
      case 'select':
      case 'font': {
        const s = el('select'); s.id = 'f-' + field.key;
        const opts = field.type === 'font'
          ? field.options.map(f => ({ value: f, label: f }))
          : field.options;
        for (const o of opts) {
          const op = el('option', null, o.label);
          op.value = o.value;
          if (field.type === 'font') op.style.fontFamily = stack(o.value);
          s.appendChild(op);
        }
        s.addEventListener('change', () => {
          const v = field.numeric ? +s.value : s.value;
          this.commit(field.key, v);
          if (field.type === 'font') {
            s.style.fontFamily = stack(v);
            // Canvas falls back silently for a face that has not downloaded
            // yet, so ask for a repaint once it is genuinely available.
            ensureFont(v).then(() => this.onChange(field.key, v));
          }
        });
        wrap.appendChild(s);
        read = () => (field.numeric ? +s.value : s.value);
        write = v => {
          s.value = v;
          if (field.type === 'font') s.style.fontFamily = stack(v);
        };
        break;
      }
      case 'checkbox': {
        const c = el('input'); c.type = 'checkbox'; c.id = 'f-' + field.key;
        c.addEventListener('change', () => this.commit(field.key, c.checked));
        wrap.appendChild(c);
        row.classList.add('row-check');
        read = () => c.checked; write = v => { c.checked = !!v; };
        break;
      }
      case 'textarea': {
        const t = el('textarea'); t.id = 'f-' + field.key; t.rows = field.rows || 2;
        t.addEventListener('input', () => this.commit(field.key, t.value));
        wrap.appendChild(t);
        row.classList.add('row-stack');
        read = () => t.value; write = v => { if (document.activeElement !== t) t.value = v; };
        break;
      }
      default: {
        const t = el('input'); t.type = 'text'; t.id = 'f-' + field.key;
        t.addEventListener('input', () => this.commit(field.key, t.value));
        wrap.appendChild(t);
        row.classList.add('row-stack');
        read = () => t.value; write = v => { if (document.activeElement !== t) t.value = v; };
      }
    }

    row.appendChild(wrap);
    this.controls.set(field.key, { row, read, write, field, group });
    return row;
  }

  commit(key, value) {
    set(this.S, key, value);
    this.onChange(key, value);
    this.applyVisibility();
  }

  /** Push current settings values into every control. */
  refresh() {
    for (const [key, c] of this.controls) {
      const v = get(this.S, key);
      if (v !== undefined) c.write(v);
    }
    this.applyVisibility();
  }

  /** Hide controls that do not apply to the current template or state. */
  applyVisibility() {
    const tpl = this.S.template;
    const applies = show => !show || show.includes(tpl);
    for (const [, c] of this.controls) {
      const f = c.field;
      // A group-scoped section hides its rows too, so a row's own `hidden`
      // is always the truth about whether that control is reachable.
      const okTpl = applies(f.show) && applies(c.group?.show);
      const okWhen = !f.when || f.when(this.S);
      c.row.hidden = !(okTpl && okWhen);
    }
    for (const [, { sec, group }] of this.sections) {
      const okTpl = !group.show || group.show.includes(tpl);
      const anyVisible = group.fields.some(f => {
        const c = this.controls.get(f.key);
        return c && !c.row.hidden;
      });
      sec.hidden = !(okTpl && anyVisible);
    }
  }
}

export const TABS = [
  { id: 'photo', label: 'Photo' },
  { id: 'text', label: 'Text' },
  { id: 'logo', label: 'Logo' },
  { id: 'style', label: 'Style' },
  { id: 'export', label: 'Export' }
];

/**
 * Tab bar over the whole sidebar. Sections carry `data-tab`, including the
 * hand-written ones, so one switcher governs every group.
 */
export function buildTabs(host, onSwitch) {
  host.innerHTML = '';
  const buttons = new Map();

  const setTab = id => {
    for (const [tabId, b] of buttons) {
      const on = tabId === id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    }
    document.querySelectorAll('.sidebar .group[data-tab]').forEach(sec => {
      sec.classList.toggle('off-tab', sec.dataset.tab !== id);
    });
    onSwitch?.(id);
  };

  for (const t of TABS) {
    const b = el('button', 'tab');
    b.type = 'button';
    b.textContent = t.label;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => setTab(t.id));
    buttons.set(t.id, b);
    host.appendChild(b);
  }
  setTab('photo');
  return setTab;
}

/** Spec-strip editor (variable-length, so it sits outside SCHEMA). */
export function buildSpecEditor(container, settings, onChange) {
  const render = () => {
    container.innerHTML = '';
    settings.text.specs.forEach((spec, i) => {
      const row = el('div', 'spec-row');
      const l = el('input'); l.type = 'text'; l.value = spec.label; l.placeholder = 'Label';
      const v = el('input'); v.type = 'text'; v.value = spec.value; v.placeholder = 'Value';
      const x = el('button', 'icon-btn', '✕');
      x.type = 'button'; x.title = 'Remove';
      l.addEventListener('input', () => { spec.label = l.value; onChange(); });
      v.addEventListener('input', () => { spec.value = v.value; onChange(); });
      x.addEventListener('click', () => {
        settings.text.specs.splice(i, 1); render(); onChange();
      });
      row.append(l, v, x);
      container.appendChild(row);
    });
    const add = el('button', 'ghost-btn', '+ Add spec');
    add.type = 'button';
    add.addEventListener('click', () => {
      settings.text.specs.push({ label: 'Label', value: 'Value' });
      render(); onChange();
    });
    container.appendChild(add);
  };
  render();
  return render;
}
