# Handoff — Sold Image Generator

Written for whoever picks this up next. It covers what exists, why it is built
the way it is, the traps that already caught me, and what is left.

Current state: `main` @ `68a8db0`. Seven of eight design slots built to a
supplied reference. ~4,800 lines, no dependencies, no build step.

---

## 1. What it is

A browser tool for a boat dealership. You give it a photo of a sold boat and
the dealership logo; it renders that into eight social-media graphics and
exports one as an image.

Three screens:

```
intake  →  gallery  →  editor
```

- **intake** — boat photo, dealership logo, and the boat record (year,
  manufacturer, model, display model, length, horsepower). Optional extras:
  reversed logo, water texture, brush artwork, licensed font files.
- **gallery** — every design rendered from those inputs, as live thumbnails.
- **editor** — one design, a tabbed control panel, and Download.

### Run it

```
python3 -m http.server 8000      # then open http://localhost:8000
```

**It must be served.** Opening `index.html` as a file gives a rendered page
with dead controls, because browsers block ES-module imports over `file://`
— silently, unless the console is open. The page detects this and says so,
via a classic (non-module) script, since a module there would be blocked by
the very thing it is reporting. This cost real debugging time once already.

---

## 2. Architecture

```
index.html        three screens, markup only
css/app.css       editor chrome — never affects output
js/settings.js    DEFAULTS + SCHEMA: the single source of truth
js/designs.js     the design catalogue: presets + palette mappings
js/templates.js   the renderers, one function per design
js/draw.js        canvas primitives (text, images, shapes, image treatments)
js/logo.js        logo geometry + badge wrapper painting
js/palette.js     colour extraction from the logo
js/fonts.js       font catalogue, licensed-font handling, loading
js/ui.js          builds the control panel from SCHEMA
js/app.js         flow, assets, state, drag, export
assets/           bundled samples: boat.jpg, logo.png, water.jpg, brush.png
```

### Rendering is Canvas 2D, deliberately

Several incoming briefs asked for layered HTML elements plus `html2canvas`.
I did not do that, and I would push back on changing it. With Canvas 2D the
export **is** the preview — same code path, at any scale — rather than a
re-capture that approximates it. html2canvas is also notoriously fragile
about custom fonts, which matters a lot here because three of the fonts are
commercial files the user uploads at runtime.

Consequence: there are no per-template CSS classes or CSS variables. Briefs
that specify `.tpl-whatever { --x: … }` are satisfied by the settings schema
instead.

### Adding a setting

Add it in two places — `DEFAULTS` and `SCHEMA` in `js/settings.js` — and the
control, its persistence and the JSON export all appear for free. `SCHEMA`
groups carry:

- `tab` — which sidebar tab it lives on (`photo`/`text`/`logo`/`style`/`export`)
- `show` — array of template ids; the group hides for any other design
- `collapsed` — starts folded

Fields carry `when` (a predicate on settings) for conditional visibility, and
`box: true` to get an editable number input alongside the slider.

**Control convention, set by the user and worth preserving:** everything
spatial is a **slider only**, with a small read-only readout. Only type
properties (size, letter spacing, line height) get an editable number box,
because the specified sizes are exact and fractional — 33.3, 92.2, 22.7 —
and a slider cannot land on those.

### Adding a design

1. Write a renderer in `js/templates.js` taking `(ctx, S, A, W, H)`.
   `S` is settings, `A` is `{boat, logo, logoAlt, water, brush}`.
2. Attach `defaults` (logo treatment), `surfaces` (light/dark per text role)
   and `displayFont` to the function.
3. Register it in `RENDERERS`.
4. Add a preset object and a registry entry in `js/designs.js`, with `slot`,
   `status`, `blurb`, `preset`, optional `modelTransform` and `paletteMap`.
5. Add any design-specific SCHEMA group with `show: ['your-id']`.

Settings are held **per design**. Editing one cannot affect another. Shared
inputs — artwork, boat record, extracted palette — are pushed into all of
them when they change.

---

## 3. The eight slots

| Slot | id | Name | Status |
|---|---|---|---|
| 1 | `design-1` | Brush Sheet | built to reference |
| 2 | `design-2` | Waterline | built to reference |
| 3 | `design-3` | Bold Fade | built to reference |
| 4 | `design-4` | Diagonal Divider | built to reference |
| 5 | `design-5` | Signature Frame | built to reference |
| 6 | `full-bleed` | Full Bleed | built to reference |
| 7 | `draft-editorial` | Editorial | **first-pass layout, no spec yet** |
| 8 | `design-8` | Dealership Arch | built to reference |

Slot 7 is the only outstanding design. It renders, but it is a layout I
invented before the slot had a number — it has never been measured against a
reference. It needs a reference image and a type spec in the same form as the
others (font, size, colour per role).

`bold-left` and `diagonal-split` in `RENDERERS` are superseded ancestors of
designs 3 and 4, kept because they still work and cost nothing. They are not
in the gallery.

The gallery distinguishes three states — built to spec, numbered but
awaiting a spec, unassigned — because collapsing them hides real progress.

---

## 4. Image treatments — the interesting part

Three different techniques, because the source artwork differs in kind.
Getting these wrong is subtle: the output looks plausible but loses the thing
that made it work.

### `keyWhite(img, strength)` — water texture

The supplied water cut-out is a **JPEG with a flat white sky** above the
surface. Drawn as-is it paints a white band across the boat photo. Keying
near-white to transparent keeps the irregular, photographic waterline that a
drawn shape cannot fake. The threshold is deliberately tight (238–252) so
foam and crests — light blue, not white — survive.

### `stencil(img, color)` — brush stroke

The brush artwork is navy on opaque white, **no alpha**. Keying near-white
here would destroy the dry-brush texture, because the scratchy parts are
mid-grey blends rather than white. So alpha comes from **luminance** instead,
normalised against the darkest pixel found, then `source-in` fills it with the
brand colour. Result: the file's texture, the logo's navy.

### `knockout(img, …, color)` — logo on a dark ground

Paints the logo's alpha silhouette flat. The fallback when no reversed logo
exists. **It is deliberately skipped when a reversed file is present** —
flattening an asset that is already the right colour throws away its inner
detail for nothing. On a compass rose that is the difference between the
linework and a solid disc.

All three cache their result on the image element. They walk every pixel and
must not run per frame.

---

## 5. Palette extraction

`js/palette.js` buckets logo pixels in a coarse RGB grid, merges visually
identical buckets, and scores survivors by coverage × saturation, discounting
the paper-white and pure-black extremes that carry no brand identity.

**Two things here are load-bearing and easy to undo by accident:**

**Accent candidates are judged on chroma, not HSL saturation.** Saturation
*rises* as a colour darkens — a near-black navy scores 0.385, higher than
plenty of obvious greys — so it cannot separate a teal from a blue-grey edge
blend. Chroma has no such bias. This was a real bug: the dealership's actual
logo is one navy on transparency, its runner-up colour is a grey-blue
antialiasing blend, and that was being handed back as the brand accent,
painting Design 8's script and the rules on 3 and 4 in near-grey.

**Monochrome logos are detected and reported.** When no candidate qualifies,
`roles.monochrome` is true and each design keeps its **own specified accent**
rather than taking an invented one. A logo with no second colour should not
get one fabricated for it.

Note `roles` therefore carries one non-colour key. Anything iterating it must
guard (`typeof v === 'string'`) — the swatch UI threw on this once.

Each design maps roles onto itself via its own `paletteMap(S, roles)`,
because the same colours land differently on a dark fade than a light panel.
Some designs deliberately **pin** a colour against the palette — Design 2's
orange `#E65A0A` is fixed by its brief, and letting extraction override it
would stop it reproducing the reference.

---

## 6. Fonts

Three of the specified faces are **commercial and cannot be fetched**:

| Specified | Standing in with |
|---|---|
| Intro Rust | Archivo Black |
| Breathing | Kaushan Script |
| Amertsadam Four | Allura |

Each is declared in `LICENSED_FONTS` with its substitute, and `stack()` lists
the **real name first**: `"Breathing", "Kaushan Script", cursive`. So the
moment the licensed file is uploaded through the intake font slots, output
becomes exact with no other change. Uploaded faces register via `FontFace`
and persist in localStorage.

Montserrat is real, from Google Fonts, and is never substituted.

---

## 7. Bugs already found and fixed

Listed because each was a trap that looked like working code.

- **Photo panning did nothing.** `cover()` positioned the image by
  interpolating its *overflow*, so a 3:2 photo in a 3:2 frame had zero
  overflow and the sliders moved nothing. Now centre-fits and applies an
  explicit offset.
- **Headline size capped near 163.** Text was auto-shrunk to a hardcoded
  44%-width column. Column width is now a setting and every type role has a
  `fit` flag that takes the authored size literally when off.
- **Logo wrapper did nothing on two designs.** Their presets said "no badge"
  three ways — `shape: 'none'` *and* `opacity: 0` *and* `padding: 0` — so
  turning a shape on produced a transparent fill sized exactly to the art.
  Separately, the border was nested inside the fill's opacity check, making
  an outline-only badge impossible on *any* design.
- **Hidden screens stayed visible.** `.screen.editor { display: grid }` tied
  with `.screen[hidden]` on specificity and won by source order.
- **Number inputs stretched across their rows**, squeezing sliders to a stub:
  `input[type="number"]`'s `width: 100%` outranks a bare `.num` class.
- **Slider tracks never painted** — `background-clip` on an
  `appearance: none` range is unreliable; style the track pseudo-elements.
- **Slider readouts matched nothing** — a bad string replacement glued
  `.readout-val` onto an `input[type="number"]` selector, and the readout is
  a span.
- **Saved logo never restored** — written with `JSON.stringify`, read raw.
- **Dragging the logo snapped back vertically** when the badge had a corner
  bleed, because bleed overrode the dragged position.

---

## 8. Testing

There is no test framework, and **no tests in the repo — this is the biggest
gap here.**

Everything was verified by Playwright scripts driving the real app in
Chromium, but they lived in the session scratchpad rather than the repo, and
that scratchpad did not survive a container restart. They are gone. Writing
them was a mistake to leave outside version control; rebuilding them into
`test/` should be high on the list.

What they covered, so they can be rebuilt:

| Script | Covered |
|---|---|
| `flow` | intake gate, gallery contents and counts, per-design setting isolation, design-scoped control visibility, export |
| `fix` | photo movement by slider and by canvas drag, independent text nudges, headline size past the old auto-fit cap |
| `wrapper` | every badge shape draws; outline-only badge; designs still default to no badge |
| `d8check` | Design 8 script case and rotation, colour boost, no heading ink past the x=1150 safe limit with long names |
| `jpg` | export format from file headers, button label tracking the format setting |
| `review` | all eight designs rendered against the real bundled assets |

Mechanics they needed, which cost time to work out:

- A static server on `:8123`; the app cannot run from `file://`.
- Google Fonts is blocked by the sandbox proxy, so they mirrored fonts to
  disk and routed both `fonts.googleapis.com` **and**
  `**/*.{woff2,ttf,woff}` to local files. Google serves `.ttf` for some
  families, so routing only `.woff2` silently misses them — and canvas then
  falls back to a default face, making screenshots quietly wrong.
- `page.on('dialog', d => d.accept())`, or `confirm()` dialogs auto-dismiss
  and actions like Reset appear to do nothing.
- Fields on a hidden screen cannot be filled; navigate back to intake first.

Two habits worth keeping, both of which caught real problems:

**Verify from artefacts, not from settings.** Checking that a setting changed
proves nothing about what rendered. The wrapper bug passed every settings
check while drawing literally nothing — it was caught by sampling canvas
pixels before and after. Export correctness is read from **file headers**
(`FFD8FF` / `89504E47` plus parsed dimensions), not from the filename.

**A weak check that says PASS is worse than no check.** My first outline-only
border test "passed" on a 1-pixel difference, which is noise. Re-measuring
inside the badge's bounding box gave 7,267 pixels — actual evidence.

Serving locally needs a static server on `:8123` for these scripts. Google
Fonts is blocked by the sandbox proxy, so they mirror fonts locally and route
`fonts.googleapis.com` and `**/*.{woff2,ttf,woff}` to disk. Without that,
canvas silently falls back to a default face and screenshots mislead you.

---

## 9. Still open

1. **No tests in the repo.** See §8 — the verification scripts were lost
   with the session scratchpad and need rebuilding into `test/`.
2. **Slot 7 (Editorial)** needs a reference and a type spec.
3. **The sample logo is 93 × 82 px.** It scales to 150–245px in the badges
   and looks soft. A higher-resolution file is the single biggest available
   visual improvement.
4. **No reversed white logo uploaded** — Design 5's badge is a white
   silhouette until there is one.
5. **Licensed font files not supplied** — three designs lean heavily on
   scripts that are currently stand-ins.
6. **Sample photo is an ATX at Whitefish Marine; the boat record says
   "2026 SEA FOX 268 COMMANDER".** Deliberate — the record matches the
   references the designs were built from — but they disagree on screen.
7. **No backend.** The boat record is typed in. If listings live in a system
   somewhere, wiring that up is the obvious next structural piece.

---

## 10. Working notes

- Designs were measured off reference images at 1200×800. Every coordinate in
  a preset is a **fraction of the canvas**, so layouts hold at other sizes.
  Type sizes scale by `unit()` — the geometric mean of both axes against the
  1200×800 reference, not `min()`, so portrait formats don't leave type
  stranded.
- Each design has landscape and portrait arrangements. A side-by-side split
  becomes an unreadable sliver at 4:5, so regions stack instead.
- Export defaults to **JPG** at quality 0.95 (these are crisp type over flat
  colour, where JPEG artefacts show worst). The button label is derived from
  the chosen format so it cannot promise one and deliver the other.
- Text blocks are draggable on the canvas, and each nudge moves only its own
  block — it never pushes the blocks stacked after it.
- The live artifact build is published at
  <https://claude.ai/artifact/DkvLKRd2UTf3j7D3J2GXph>. It is a mirror of this
  repo plus a small wrapper (`<title>` and stylesheet link hoisted, since the
  artifact host supplies its own document skeleton). It is private; sharing is
  done from that page's Share menu.
