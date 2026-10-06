# Import M-PESA JSON — a Figma plugin

Turns the **FIGMA JSON** files the prototype exports into editable Figma
layers: real frames (auto layout off, absolute positions), real text you can
retype, real vector icons, and image fills.

```
figma-plugin/
├── manifest.json   points Figma at the other two files
├── code.js         the importer — plain JS, no build step
├── ui.html         the drop zone and the summary
└── README.md       this file
```

## 1. Export the JSON from the prototype

Open a screen in a desktop browser and press **FIGMA JSON** in the top-right
export bar (next to **DOWNLOAD PNG**). You get `<screen>.figma.json`, e.g.
`send-to-bank.figma.json`.

> The export bar is hidden below 720 px wide, so use a desktop-sized window.

Serve the prototype over http rather than opening the files directly — from
`file://` the browser refuses to fetch the local images, exactly as it does for
the PNG export:

```powershell
cd "c:\Users\LEGION\Documents\My Project\M-PESA Home"
python -m http.server 5500        # or: npx serve -l 5500
# then open http://localhost:5500/Send%20to%20Bank.html
```

## 2. Load the plugin in Figma

1. Figma desktop app → menu → **Plugins → Development → Import plugin from
   manifest…**
2. Pick `figma-plugin/manifest.json`.
3. Run it from **Plugins → Development → Import M-PESA JSON**.

Figma asks once whether the plugin may reach the network — say yes. That is the
image fetching, declared in `manifest.json`.

## 3. Import

Drop one or more `.figma.json` files onto the window (or click to browse), set
the options, press **Import**. Each screen lands centred in the current viewport
and is selected, so you can drag it straight into place.

| Option | What it does |
|---|---|
| **Scale** | Resizes the whole screen after it is built. `1×` keeps the prototype's 360 × 808. `2×` runs the same multiplies over the tree; `0.5×` is handy for a bird's-eye page. |
| **Gradients** | Figma has no CSS gradient syntax, so the importer converts `linear-`, `radial-` and `conic-gradient()` into real editable gradient fills. Turn it off to leave those layers filled with the gradient's last colour instead — useful when you only want structure. |
| **Shadows** | `box-shadow` → drop shadow, `inset` → inner shadow. CSS blur is halved, which is the closest Figma equivalent. |

## What comes through

| JSON | Figma |
|---|---|
| `FRAME` | Frame (background, radii, border, shadow, opacity, clipping) |
| `TEXT` | Text layer — family, weight, size, letter spacing, line height, alignment, colour |
| `RECTANGLE` + image fill | Rectangle filled with the downloaded picture, corner radius kept |
| `SVG` | Vectors via `createNodeFromSvg`, resized to the box CSS gave it |
| `cssBackground` | Linear, radial or conic gradient fills |
| `cssBoxShadow` | Drop or inner shadow |
| `strokes` / `strokeWeight` | Inside stroke |
| `topLeftRadius` … | Per-corner radii |

Images are fetched once each and reused, so six screens with the same logo add
one image to the file, not six.

## What it cannot do, and says so

The plugin never fails silently — anything it had to approximate is listed in
the summary when the import finishes, and logged to **Plugins → Development →
Open console**.

- **`background-size`, `background-position`, `filter`** — the prototype
  controls these in CSS (the repeating M-PESA pattern, the greyscale nav
  icons) and the JSON does not carry them. Gradients still import; the tile
  size and the greyscale do not.
- **Skew, rotate and 3D transforms** — the JSON keeps axis-aligned boxes only,
  so a rotated ring or a scaled-up sheet imports unrotated.
- **Fonts** — the prototype asks for Barlow. If Barlow is not available to your
  Figma account, the nearest available style is used and the substitution is
  named in the summary rather than the text being dropped.
- **Repeating gradients** — drawn once, edge to edge.
- **Failed images** — become a grey box at the right size instead of aborting
  the import, with the URL in the notes. If a picture is missing and the file
  was served from `file://`, that is the reason.

## Editing the plugin

There is no build step: `code.js` is plain ES2017 JavaScript (Figma's runtime
has `async`/`await`), and `ui.html` is a self-contained page. Edit and re-run;
no compile.

The JSON contract lives in `assets/prototype-mode.js` — `textNode`,
`elementNode` and `downloadFigmaJson` — under the comment
`/* ---- Figma node tree ---- */`. If you change what the exporter writes,
change `buildNode` and its helpers to match.