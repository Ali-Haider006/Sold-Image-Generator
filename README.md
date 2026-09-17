# Sold Image Generator

A browser tool that turns a sold-boat photo and a dealership logo into a
ready-to-post social graphic. Everything runs client-side — no build step, no
server, no upload. Drop in two images, pick a template, hit **Download**.

```
python3 -m http.server 8000     # or any static server
open http://localhost:8000
```

It must be *served*, not opened as `file://` — the code is ES modules and the
browser blocks module imports from the filesystem. Any static host works
(GitHub Pages, S3, a folder behind nginx).

## What it does

| # | Component | Where it lives |
|---|-----------|----------------|
| 1 | Logo placement & background wrapper | `js/logo.js` |
| 2 | Logo size | `js/logo.js`, `logo.size` |
| 3 | Fonts & font sizes | `js/fonts.js`, `type.*` |
| 4 | Text & text colours | `text.*`, `type.*.color` |
| 5 | Colour extraction from the logo | `js/palette.js` |
| 6 | Secondary fonts & taglines matched to site typography | `siteType.*` |
| 7 | Every colour and size customisable | `js/settings.js` → `js/ui.js` |

### 1 · Logo placement and background wrapper

Nine anchors plus a free `custom` position you get by **dragging the logo
directly on the preview**. The wrapper behind it is drawn from the same
geometry: `none`, `circle`, `rounded`, `square`, `pill`, `shield` (the tapered
dealer badge) or a full-width `banner`, each with its own fill, opacity,
border, corner radius, inner padding and drop shadow.

`bleed` lets the badge run half off the bottom edge or into the nearest
corner, the way most dealer templates sit it. Dragging the logo overrides
bleed — an explicit placement always wins.

### 2 · Logo size

`logo.size` is the artwork's width in design px. The wrapper sizes itself
around the artwork plus padding, so changing the size never clips the logo,
and the art is always `contain`-fitted, never cropped.

### 3 · Fonts and font sizes

A curated Google Fonts catalogue split into display, text and script faces,
loaded on demand. Each of the five type roles — headline, script headline,
model, tagline, spec strip — carries its own family, weight, size, letter
spacing, line height, case transform and colour.

Sizes are authored against a 1200 × 800 reference and scaled by the geometric
mean of the two axes, so a design keeps its proportions from a link card to a
9:16 story. Text blocks auto-fit their column in a single exact pass (letter
spacing scales with the type, so the relationship stays linear).

### 4 · Text and text colours

Headline, script headline, boat/model, tagline and a variable-length spec
strip. Newlines in a field are real line breaks. Every role has an
independent colour.

### 5 · Colour extraction from the logo

Upload a logo and its palette is read automatically. Pixels are bucketed in a
coarse RGB grid, visually identical buckets are merged, and the survivors are
scored by coverage × saturation — with the paper-white and pure-black
extremes discounted, because they are almost never the brand colour. The top
ten become swatches (click to copy); five are mapped to semantic roles
(`primary`, `secondary`, `dark`, `light`, `accent`).

**Apply palette to design** pushes those roles through the whole card. Each
template declares which of its text roles sit on a light surface and which on
a dark one, so the same palette stays legible on all four — and switching
template re-derives the mapping, unless you have set a colour by hand.

### 6 · Secondary fonts and taglines matched to site typography

Set your site's heading and body faces once under **Website typography**. With
*Lock secondary text & taglines to site body* on (the default), the model,
tagline and spec-strip faces follow the site body font and their individual
family pickers are hidden — a tagline cannot drift away from the site's voice.
Turn a lock off to take manual control of that role.

### 7 · Everything customisable

`DEFAULTS` holds every knob, `SCHEMA` describes it, and `js/ui.js` builds the
panel from that description. Adding a setting in both places gets you the
control, the persistence and the JSON export for free. Controls hide
themselves when they do not apply (`show` per template, `when` per state).

Configurations save to **brand kits** in `localStorage`, or export/import as
JSON to share between machines.

## Templates

| Template | Landscape | Portrait / square |
|---|---|---|
| **Bold Left** | oversized headline over a photo faded into the brand colour | headline stack drops to the bottom under a rising scrim |
| **Chevron Split** | script headline on a light panel, chevron-edged photo beside it | photo on top, chevron bites downward into the panel below |
| **Full Bleed** | corner tag over the photo, footer bar with model + tagline | footer stacks model over tagline |
| **Editorial** | serif headline column, photo, spec strip beneath it | photo band on top, text block below, spec strip across the foot |

Each layout picks up a matching logo treatment and headline face when you
select it — unless you have already chosen your own, in which case your choice
is kept.

## Output

PNG or JPEG at 1×, 2× or 3× the design size, plus **Copy** to put the image
straight on the clipboard. Presets cover 1200×800, 1200×630, 1080×1080,
1080×1350 and 1080×1920, or set a custom size. Filenames are derived from the
boat/model text.

## Architecture

```
index.html          shell
css/app.css         editor chrome (never affects output)
js/settings.js      DEFAULTS + SCHEMA — the single source of truth
js/ui.js            builds the control panel from SCHEMA
js/app.js           assets, preview, drag, palette, presets, export
js/templates.js     the four layouts
js/draw.js          canvas primitives: tracked text, cover-fit, scrims, shapes
js/logo.js          logo geometry + wrapper painting
js/palette.js       colour extraction and colour-space helpers
js/fonts.js         font catalogue and on-demand loader
```

Rendering is plain Canvas 2D — no html2canvas, no dependencies — so what you
see in the preview is exactly what the export contains, at any scale.
Geometry is separated from painting (`logoGeometry` vs `drawLogo`) because the
drag handler and the collision guards need to know where things are without
drawing them.
