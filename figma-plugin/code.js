/* ============================================================================
   Import M-PESA JSON — a Figma plugin that rebuilds a screen as editable
   layers from the "FIGMA JSON" file the prototype's export bar writes.

   Where the JSON comes from
     Open a screen of the prototype in a desktop browser and press
     FIGMA JSON (top right). assets/prototype-mode.js walks .mobile-container
     and saves a node tree shaped like the Figma Plugin API:

       { format, version, source, exportedAt, document: <root frame> }

     Every node carries x/y (relative to its parent), width/height, a type of
     FRAME, TEXT, RECTANGLE or SVG, 0-1 colours, plus optional radii, strokes,
     cssBoxShadow, cssBackground, opacity and children.

   What this plugin does
     Rebuilds that tree with the real API — createFrame / createText /
     createRectangle / createNodeFromSvg — so the result stays editable, and
     reports anything it had to approximate instead of failing.

   No build step: this file is plain JavaScript, loaded by Figma directly.
   ========================================================================= */
(function () {
  'use strict';

  figma.showUI(__html__, { width: 440, height: 620 });

  /* Options sent up from the UI; overwritten on every import. */
  var options = { scale: 1, effects: true, gradients: true };
  var building = false;

  /* ------------------------------------------------------------- report */
  /* Everything the plugin could not do perfectly is collected here and
     handed back to the UI, so a screen never fails silently. */
  function newReport() {
    return {
      frames: 0, texts: 0, images: 0, imagesFailed: 0, svgs: 0,
      gradients: 0, gradientsFlattened: 0, effects: 0, fallbackFonts: 0,
      fonts: {}, warnings: [], notes: []
    };
  }

  function warn(report, message) {
    if (report.warnings.indexOf(message) === -1) report.warnings.push(message);
  }

  function note(report, message) {
    if (report.notes.indexOf(message) === -1) report.notes.push(message);
  }

  function progress(message) {
    figma.ui.postMessage({ type: 'progress', message: message });
  }

  /* -------------------------------------------------------------- small */
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0; }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* Split on commas that sit outside any brackets, so "rgba(0,0,0,0.06) 0 2px"
     and multi-layer backgrounds both come apart in the right places. */
  function splitTopLevel(str, sep) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === sep && depth === 0) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    var trimmed = [];
    for (var j = 0; j < out.length; j++) { if (out[j].trim()) trimmed.push(out[j].trim()); }
    return trimmed;
  }

  /* ------------------------------------------------------------- colour */
  var NAMED = {
    transparent: { r: 0, g: 0, b: 0, a: 0 }, white: { r: 1, g: 1, b: 1, a: 1 },
    black: { r: 0, g: 0, b: 0, a: 1 }, red: { r: 1, g: 0, b: 0, a: 1 },
    green: { r: 0, g: 0.5, b: 0, a: 1 }, blue: { r: 0, g: 0, b: 1, a: 1 },
    gray: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, grey: { r: 0.5, g: 0.5, b: 0.5, a: 1 }
  };

  /* Reads rgb(), rgba() and #abc / #abcd / #aabbcc / #aabbccdd — the forms
     the exporter writes — and returns 0-1 channels, or null. */
  function cssColor(str) {
    if (str === null || str === undefined) return null;
    var s = String(str).trim().toLowerCase();
    if (!s) return null;
    if (NAMED[s]) return NAMED[s];

    var m = s.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      if (p.length < 3) return null;
      var a = p.length > 3 ? p[3] : 1;
      return { r: clamp(p[0] / 255, 0, 1), g: clamp(p[1] / 255, 0, 1), b: clamp(p[2] / 255, 0, 1), a: clamp(a, 0, 1) };
    }

    m = s.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      var h = m[1];
      if (h.length === 3 || h.length === 4) {
        h = h.split('').map(function (c) { return c + c; }).join('');
      }
      if (h.length !== 6 && h.length !== 8) return null;
      return {
        r: parseInt(h.slice(0, 2), 16) / 255,
        g: parseInt(h.slice(2, 4), 16) / 255,
        b: parseInt(h.slice(4, 6), 16) / 255,
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      };
    }
    return null;
  }

  /* Paints a solid fill; alpha rides on the paint's own opacity. */
  function solidPaint(color, extraOpacity) {
    if (!color) return null;
    var a = clamp((color.a === undefined ? 1 : color.a) * (extraOpacity === undefined ? 1 : extraOpacity), 0, 1);
    var paint = { type: 'SOLID', color: { r: clamp(color.r, 0, 1), g: clamp(color.g, 0, 1), b: clamp(color.b, 0, 1) } };
    if (a < 1) paint.opacity = a;
    return paint;
  }

  /* -------------------------------------------------------------- fonts */
  /* The prototype asks for Barlow at five weights, and the exporter hands us
     a weight number. Figma names styles instead, so map across, and keep
     Inter / Roboto as last resorts: a missing family must never stop a screen
     from importing. */
  var WEIGHT_STYLE = {
    100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black'
  };
  var LAST_RESORTS = [{ family: 'Inter', style: 'Regular' }, { family: 'Roboto', style: 'Regular' }];
  var fontOk = {};    /* "family::style" -> loaded once already */
  var fontBad = {};   /* "family::style" -> Figma said no */

  function nearestWeight(w) {
    var best = 400, bestGap = Infinity;
    for (var key in WEIGHT_STYLE) {
      var gap = Math.abs(parseInt(key, 10) - w);
      if (gap < bestGap) { bestGap = gap; best = parseInt(key, 10); }
    }
    return best;
  }

  function fontCandidates(spec) {
    var family = (spec && spec.family ? String(spec.family) : 'Barlow').trim() || 'Barlow';
    var weight = num(spec && spec.weight) || 400;
    var italic = spec && spec.style === 'Italic';
    var base = WEIGHT_STYLE[nearestWeight(weight)];
    var list = [];
    if (italic) list.push({ family: family, style: base + ' Italic' });
    list.push({ family: family, style: base });
    if (base !== 'Regular') list.push({ family: family, style: 'Regular' });
    return list.concat(LAST_RESORTS);
  }

  /* Loads the first candidate Figma accepts, and remembers it. */
  async function resolveFont(spec, report) {
    var list = fontCandidates(spec);
    var wanted = list[0];
    for (var i = 0; i < list.length; i++) {
      var font = list[i];
      var key = font.family + '::' + font.style;
      if (fontBad[key]) continue;
      if (!fontOk[key]) {
        try { await figma.loadFontAsync(font); fontOk[key] = true; }
        catch (e) { fontBad[key] = true; continue; }
      }
      var label = font.family + ' ' + font.style;
      report.fonts[label] = (report.fonts[label] || 0) + 1;
      if (font.family !== wanted.family || font.style !== wanted.style) {
        report.fallbackFonts++;
        note(report, 'Font substituted: ' + wanted.family + ' ' + wanted.style + ' → ' + label);
      }
      return font;
    }
    warn(report, 'No font available for "' + (spec && spec.family) + '"; text kept its default.');
    return { family: 'Inter', style: 'Regular' };
  }

  /* ------------------------------------------------------------ shadows */
  /* CSS gives a blur radius, Figma wants about half of it. inset becomes an
     inner shadow. offset / blur / spread order is the CSS one. */
  function parseShadow(str) {
    var s = String(str).trim();
    if (!s) return null;
    var inset = false;
    if (/^inset\b/i.test(s)) { inset = true; s = s.replace(/^inset\b/i, ' '); }
    if (/\binset\b/i.test(s)) { inset = true; s = s.replace(/\binset\b/i, ' '); }

    /* Lift the colour out first, so its own numbers are not read as offsets. */
    var color = null;
    var cm = s.match(/rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}|\b[a-z]{3,}\b/i);
    if (cm) {
      color = cssColor(cm[0]);
      s = s.slice(0, cm.index) + ' ' + s.slice(cm.index + cm[0].length);
    }

    var nums = (s.match(/-?[\d.]+(?:px)?/g) || []).map(parseFloat).filter(function (n) { return !isNaN(n); });
    if (nums.length < 2) return null;

    var c = color || { r: 0, g: 0, b: 0, a: 0.25 };
    return {
      type: inset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: {
        r: clamp(c.r, 0, 1), g: clamp(c.g, 0, 1), b: clamp(c.b, 0, 1),
        a: clamp(c.a === undefined ? 1 : c.a, 0, 1)
      },
      offset: { x: nums[0], y: nums[1] },
      radius: Math.max(0, (nums[2] || 0) / 2),
      spread: nums[3] || 0,
      visible: true,
      blendMode: 'NORMAL'
    };
  }

  /* One element can carry several shadows, comma separated. */
  function effectsFromCss(value) {
    if (!value || String(value).trim() === 'none') return null;
    var parts = splitTopLevel(String(value), ',');
    var effects = [];
    for (var i = 0; i < parts.length; i++) {
      var e = parseShadow(parts[i]);
      if (e) effects.push(e);
    }
    return effects.length ? effects : null;
  }

  /* ---------------------------------------------------------- gradients */
  /* The first colour-ish token in a layer, so shapes and positions
     ("circle at 50% 50%") are skipped rather than misread. */
  var COLORISH = /(rgba?\(|hsla?\(|#[0-9a-f]{3,8}\b|^[a-z]{3,}$)/i;

  function rgbOf(c) { return { r: clamp(c.r, 0, 1), g: clamp(c.g, 0, 1), b: clamp(c.b, 0, 1) }; }

  /* One CSS colour stop: its colour, its opacity, and its position if it has
     one ("#fff 0%" → 0, "rgba(...)" alone → null). */
  function readStop(token) {
    var t = String(token).trim();
    var re = /rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b|\b[a-z]{3,}\b/gi;
    var m, color = null, matched = '';
    while ((m = re.exec(t))) {
      var c = cssColor(m[0]);
      if (c) { color = c; matched = m[0]; break; }
    }
    if (!color) return null;
    var rest = t.replace(matched, ' ');
    var pos = rest.match(/(-?[\d.]+)\s*%/);
    var stop = { color: rgbOf(color), position: pos ? clamp(parseFloat(pos[1]) / 100, 0, 1) : null };
    if (color.a < 1) stop.opacity = color.a;
    return stop;
  }

  function stopsFromTokens(tokens) {
    var stops = [];
    for (var i = 0; i < tokens.length; i++) {
      var s = readStop(tokens[i]);
      if (s) stops.push(s);
    }
    return stops;
  }

  /* CSS may leave positions implicit ("linear-gradient(#a, #b)") and Figma
     needs them, and needs them ascending. */
  function placeStops(stops) {
    var n = stops.length;
    if (!n) return stops;
    for (var i = 0; i < n; i++) {
      if (stops[i].position === null) stops[i].position = n === 1 ? 0 : i / (n - 1);
    }
    var last = 0;
    for (var j = 0; j < n; j++) {
      if (stops[j].position < last) stops[j].position = last;
      last = stops[j].position;
    }
    return stops;
  }

  /* gradientTransform maps a point of the node — 0-1 on each axis — into the
     gradient's own square, u across the gradient and v across it. Figma draws
     a paint with the identity matrix as a left-to-right gradient, and its
     start, end and control handles sit at (0, 0.5), (1, 0.5) and (0, 1) in
     that square. Every builder below is that same frame, so a 90° CSS
     gradient comes out as the identity and a 45° one runs corner to corner. */

  /* CSS angle: 0° points up, growing clockwise, so the direction is
     (sin, −cos). The gradient line spans |sin| + |cos| of the node, which is
     what keeps horizontal, vertical and diagonal runs on the node's edges. */
  function linearPaint(angleDeg, stops) {
    var rad = angleDeg * Math.PI / 180;
    var ux = Math.sin(rad), uy = -Math.cos(rad);
    var len = Math.abs(ux) + Math.abs(uy);
    if (!len) return null;
    var a = ux / len, b = uy / len;
    /* u = a·x + b·y + e, measured from the gradient line that starts at the
       node edge; v is the unit perpendicular, centred on v = 0.5. */
    return {
      type: 'GRADIENT_LINEAR',
      gradientTransform: [
        [a, b, 0.5 - (ux + uy) / (2 * len)],
        [-uy, ux, 0.5 * (1 + uy - ux)]
      ],
      gradientStops: placeStops(stops)
    };
  }

  function linearAngle(prelude) {
    var m = prelude.match(/(-?[\d.]+)\s*(deg|rad|turn|grad)\b/i);
    if (m) {
      var v = parseFloat(m[1]);
      var unit = m[2].toLowerCase();
      if (unit === 'rad') return v * 180 / Math.PI;
      if (unit === 'turn') return v * 360;
      if (unit === 'grad') return v * 0.9;
      return v;
    }
    var corner = prelude.match(/to\s+(top|bottom)?\s*(left|right)?/i);
    if (corner && (corner[1] || corner[2])) {
      var v2 = corner[1] || '', h = corner[2] || '';
      if (v2 === 'top') return h === 'right' ? 45 : h === 'left' ? 315 : 0;
      if (v2 === 'bottom') return h === 'right' ? 135 : h === 'left' ? 225 : 180;
      return h === 'right' ? 90 : 270;
    }
    return 180;   /* CSS default is "to bottom" */
  }

  function radialPaint(prelude, stops) {
    var centre = prelude.match(/at\s+(-?[\d.]+)%\s+(-?[\d.]+)%/i);
    var cx = centre ? clamp(parseFloat(centre[1]) / 100, 0, 1) : 0.5;
    var cy = centre ? clamp(parseFloat(centre[2]) / 100, 0, 1) : 0.5;
    /* The centre is the gradient's origin, so it sits at (0, 0.5), and a
       unit radius reaches the node's edges — the "circle at 50%" look, and
       how the prototype draws its dot patterns. */
    return {
      type: 'GRADIENT_RADIAL',
      gradientTransform: [
        [2, 0, -2 * cx],
        [0, 2, 0.5 - 2 * cy]
      ],
      gradientStops: placeStops(stops)
    };
  }

  /* CSS conic 0° is up, Figma's is its own u axis, so the frame is turned to
     put u on the CSS start direction. Radii are doubled, as for radial, so
     the ring reaches the node's edges. */
  function conicPaint(prelude, stops) {
    var from = prelude.match(/from\s+(-?[\d.]+)(deg|rad|turn)?/i);
    var deg = from ? parseFloat(from[1]) : 0;
    if (from && from[2] === 'rad') deg = deg * 180 / Math.PI;
    else if (from && from[2] === 'turn') deg = deg * 360;
    var rad = deg * Math.PI / 180;
    var s = Math.sin(rad), c = Math.cos(rad);
    return {
      type: 'GRADIENT_ANGULAR',
      gradientTransform: [
        [2 * s, -2 * c, 2 * (c * 0.5 - s * 0.5)],
        [2 * c, 2 * s, 0.5 - 2 * (c * 0.5 + s * 0.5)]
      ],
      gradientStops: placeStops(stops)
    };
  }

  /* Every gradient in a background value, in CSS order, taking care to close
     each one at its own bracket. */
  function gradientLayers(value) {
    var out = [];
    var re = /(repeating-)?(linear|radial|conic)-gradient\(/gi;
    var m;
    while ((m = re.exec(value))) {
      var open = value.indexOf('(', m.index);
      var depth = 0, end = -1;
      for (var i = open; i < value.length; i++) {
        var ch = value.charAt(i);
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end === -1) break;
      out.push({ kind: m[2].toLowerCase(), repeating: !!m[1], body: value.slice(open + 1, end) });
      re.lastIndex = end + 1;
    }
    return out;
  }

  /* The gradient paints of one element, back to front, so they stack the way
     Figma paints them (first fill is the bottom one). */
  function gradientPaints(cs, report) {
    var raw = cs.cssBackground || cs.backgroundImage || '';
    if (!raw || String(raw).indexOf('gradient') === -1) return null;
    var layers = gradientLayers(String(raw));
    if (!layers.length) return null;

    var paints = [];
    for (var i = layers.length - 1; i >= 0; i--) {
      var layer = layers[i];
      var tokens = splitTopLevel(layer.body, ',');
      var prelude = '';
      if (tokens.length && !COLORISH.test(tokens[0])) prelude = tokens.shift();
      var stops = stopsFromTokens(tokens);
      if (!stops.length) continue;
      if (layer.repeating) {
        note(report, 'A repeating gradient was drawn once, edge to edge (CSS repeating-* has no Figma equivalent).');
      }
      var paint = layer.kind === 'radial' ? radialPaint(prelude, stops)
        : layer.kind === 'conic' ? conicPaint(prelude, stops)
          : linearPaint(linearAngle(prelude), stops);
      if (paint) { paints.push(paint); report.gradients++; }
    }
    return paints.length ? paints : null;
  }

  function truncate(s, n) {
    s = String(s === undefined || s === null ? '' : s);
    n = n || 60;
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ------------------------------------------------------------ images */
  /* Each picture is fetched and hashed once, so screens that share a logo
     share a fill. Sizes only seed the placeholder rectangle a failed image
     leaves behind — scaleMode keeps the crop either way. */
  var imageCache = {};
  var baseUrl = '';

  function absoluteSrc(src) {
    if (!src) return '';
    if (/^(data:|blob:|https?:)/i.test(src)) return src;
    if (baseUrl) { try { return new URL(src, baseUrl).href; } catch (e) { } }
    return src;
  }

  /* Returns { hash, width, height } or null, remembering both outcomes. */
  async function imageInfo(src, report) {
    if (imageCache[src]) return imageCache[src].failed ? null : imageCache[src];
    try {
      var image = await figma.createImageAsync(absoluteSrc(src));
      var size = await image.getSizeAsync();
      imageCache[src] = { hash: image.hash, width: size.width, height: size.height };
      report.images++;
      return imageCache[src];
    } catch (e) {
      imageCache[src] = { failed: true };
      report.imagesFailed++;
      var why = e && e.message ? e.message : 'could not be read';
      note(report, 'Image not loaded (' + truncate(why, 60) + '): ' + truncate(src, 70));
      return null;
    }
  }

  function imagePaint(info, scaleMode) {
    return { type: 'IMAGE', scaleMode: scaleMode || 'FILL', imageHash: info.hash };
  }

  /* An image that could not be fetched still gets a grey box of the right
     shape, so the layout keeps its proportions instead of collapsing. */
  function placeholderFill(info) {
    return { type: 'SOLID', color: { r: 0.86, g: 0.87, b: 0.87 }, opacity: 1 };
  }

  /* ------------------------------------------------------------ layout */
  /* The exporter already resolved every box against its parent, so there is
     no flex, padding or stacking left to redo: position and size say it all.
     Text keeps its own width, so it can still grow when edited. */
  function applyBox(node, n, noResize) {
    node.x = num(n.x);
    node.y = num(n.y);
    var w = num(n.width), h = num(n.height);
    if (noResize) return;
    if (w > 0 && h > 0) { try { node.resize(w, h); } catch (e) { } }
  }

  function applyRadius(node, n) {
    try {
      if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
        node.cornerRadius = n.cornerRadius;
        return;
      }
      if (n.topLeftRadius || n.topRightRadius || n.bottomRightRadius || n.bottomLeftRadius) {
        node.topLeftRadius = num(n.topLeftRadius);
        node.topRightRadius = num(n.topRightRadius);
        node.bottomRightRadius = num(n.bottomRightRadius);
        node.bottomLeftRadius = num(n.bottomLeftRadius);
      }
    } catch (e) { }
  }

  function applyOpacity(node, n) {
    if (typeof n.opacity === 'number' && n.opacity < 1) {
      try { node.opacity = clamp(n.opacity, 0, 1); } catch (e) { }
    }
  }

  /* A CSS border becomes a stroke on the inside, which is where CSS draws it.
     Only the top edge survives the exporter, so all four match by definition. */
  function applyBorderGeometry(node, n) {
    if (!n.strokes || !n.strokes.length) return;
    try { node.strokes = n.strokes; } catch (e) { }
    try { if (n.strokeWeight) node.strokeWeight = n.strokeWeight; } catch (e) { }
    try { if (n.strokeAlign) node.strokeAlign = n.strokeAlign; } catch (e) { }
    if (n.dashPattern) { try { node.dashPattern = n.dashPattern; } catch (e) { } }
  }

  function applyEffects(node, n, report) {
    if (!options.effects) return;
    var effects = effectsFromCss(n.cssBoxShadow);
    if (!effects) return;
    try { node.effects = effects; report.effects++; }
    catch (e) { warn(report, 'A shadow on "' + truncate(n.name || '', 24) + '" could not be applied.'); }
  }

  /* The exporter hands over its own fills; keep the ones Figma accepts on a
     text layer and never leave a picture word invisible. */
  function textFills(fills) {
    var out = [];
    if (!Array.isArray(fills)) return out;
    for (var i = 0; i < fills.length; i++) {
      var p = fills[i];
      if (!p) continue;
      if (p.type === 'SOLID') {
        var solid = solidPaint(p.color, p.opacity);
        if (solid) out.push(solid);
      } else if (p.type === 'IMAGE') {
        out.push({ type: 'SOLID', color: { r: 0.16, g: 0.19, b: 0.18 } });
      } else if (String(p.type).indexOf('GRADIENT') === 0 && p.gradientStops) {
        out.push(p);
      }
    }
    return out;
  }

  /* Backgrounds stack the way Figma paints them: the first fill sits lowest.
     A gradient the plugin will not draw is replaced by its last colour, so a
     card is never left blank. */
  function fillStack(n, report) {
    var fills = [];
    if (n.cssBackground) {
      var gradient = options.gradients ? gradientPaints(n, report) : null;
      if (gradient) {
        for (var i = 0; i < gradient.length; i++) fills.push(gradient[i]);
      } else {
        report.gradientsFlattened++;
        note(report, 'A background gradient on "' + truncate(n.name || 'a layer', 22)
          + '" was flattened to its last colour (the JSON keeps a CSS-only value here).');
        var flat = dominantSolid(n.cssBackground);
        if (flat) fills.push(flat);
      }
    }
    var solid = solidPaint(cssColor(n.cssBackgroundColor));
    if (solid) fills.push(solid);
    return fills;
  }

  /* The last colour in a gradient, used when there is nothing better to do. */
  function dominantSolid(cssBackground) {
    var m = String(cssBackground || '').match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi);
    if (!m || !m.length) return null;
    return solidPaint(cssColor(m[m.length - 1]));
  }

  /* Uniform scale of a subtree, used when the import scale is not 1: a frame
     resize alone would move nothing inside it. */
  function scaleChildren(node, sx, sy) {
    var children = node.children || [];
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      try {
        c.x = c.x * sx;
        c.y = c.y * sy;
        if (typeof c.resize === 'function' && c.width > 0 && c.height > 0) {
          c.resize(c.width * sx, c.height * sy);
        }
        if (c.type !== 'TEXT' && 'strokeWeight' in c && typeof c.strokeWeight === 'number') {
          c.strokeWeight = c.strokeWeight * Math.min(sx, sy);
        }
        scaleChildren(c, sx, sy);
      } catch (e) { }
    }
  }

  /* ------------------------------------------------------------ builders */
  async function buildText(n, report) {
    var node = figma.createText();
    if (n.name) node.name = truncate(n.name, 40);

    var font = await resolveFont(n.fontName, report);
    try { node.fontName = font; } catch (e) { }
    try { node.characters = n.characters || n.name || ' '; }
    catch (e) { warn(report, 'A line of text had to be left empty.'); }

    if (n.fontSize) { try { node.fontSize = n.fontSize; } catch (e) { } }
    if (n.letterSpacing && n.letterSpacing.unit === 'PIXELS') {
      try { node.letterSpacing = { value: n.letterSpacing.value, unit: 'PIXELS' }; } catch (e) { }
    }
    if (n.lineHeight && n.lineHeight.unit === 'PIXELS' && n.lineHeight.value) {
      try { node.lineHeight = { value: n.lineHeight.value, unit: 'PIXELS' }; } catch (e) { }
    }
    if (n.textAlignHorizontal) { try { node.textAlignHorizontal = n.textAlignHorizontal; } catch (e) { } }

    node.fills = textFills(n.fills);
    applyOpacity(node, n);
    applyBox(node, n, true);   /* auto width: no resize, so editing stays easy */
    return node;
  }

  async function buildImage(n, report) {
    var rect = figma.createRectangle();
    if (n.name) rect.name = truncate(n.name, 40);
    applyBox(rect, n);
    applyRadius(rect, n);
    applyOpacity(rect, n);

    var fill = (n.fills && n.fills[0]) || {};
    var info = fill.src ? await imageInfo(fill.src, report) : null;
    if (info) {
      rect.fills = [imagePaint(info, fill.scaleMode === 'FIT' ? 'FIT' : 'FILL')];
    } else {
      rect.fills = [placeholderFill(info)];
      if (fill.src) warn(report, 'A picture stayed a grey box — its address is in the notes.');
    }
    return rect;
  }

  function buildRect(n, report) {
    var rect = figma.createRectangle();
    if (n.name) rect.name = truncate(n.name, 40);
    applyBox(rect, n);
    applyRadius(rect, n);
    rect.fills = fillStack(n, report);
    applyBorderGeometry(rect, n);
    applyEffects(rect, n, report);
    applyOpacity(rect, n);
    return rect;
  }

  /* The exporter bakes the mark's own colour into the markup, so the vector
     can be rebuilt as real, editable shapes rather than a flat picture. */
  async function buildSvg(n, report) {
    var markup = String(n.svg || '').trim();
    if (markup.indexOf('<svg') === -1) {
      warn(report, 'An SVG layer ("' + truncate(n.name || '', 24) + '") carried no usable markup.');
      return null;
    }
    var node;
    try { node = figma.createNodeFromSvg(markup); }
    catch (e) {
      warn(report, 'An SVG could not be read: ' + truncate(e && e.message, 60));
      return null;
    }
    report.svgs++;
    if (n.name) node.name = truncate(n.name, 40);
    applyOpacity(node, n);

    /* Match the size CSS gave it, scaling the artwork with the frame so icons
       are neither stretched to the corner nor left at their viewBox size. */
    var w = num(n.width), h = num(n.height);
    if (w > 0 && h > 0 && node.width > 0 && node.height > 0) {
      var sx = w / node.width, sy = h / node.height;
      if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
        try {
          node.resize(w, h);
          scaleChildren(node, sx, sy);
        } catch (e) {
          warn(report, 'An SVG was kept at its own size: ' + truncate(e && e.message, 60));
        }
      }
    }
    return node;
  }

  async function buildFrame(n, report) {
    var frame = figma.createFrame();
    if (n.name) frame.name = truncate(n.name, 40);
    applyBox(frame, n);
    applyRadius(frame, n);
    frame.fills = fillStack(n, report);
    frame.clipsContent = n.clipsContent !== false;
    applyBorderGeometry(frame, n);
    applyEffects(frame, n, report);
    applyOpacity(frame, n);

    /* Padding, flex and stacking are already resolved into the children's own
       coordinates, so each one is simply attached in order. */
    var children = Array.isArray(n.children) ? n.children : [];
    for (var i = 0; i < children.length; i++) {
      var child = await buildNode(children[i], report);
      if (child) frame.appendChild(child);
    }
    return frame;
  }

  async function buildNode(n, report) {
    if (!n || !n.type) return null;
    try {
      if (n.type === 'TEXT') return await buildText(n, report);
      if (n.type === 'SVG') return await buildSvg(n, report);
      if (n.type === 'RECTANGLE') {
        var first = n.fills && n.fills[0];
        if (first && first.type === 'IMAGE') return await buildImage(n, report);
        return buildRect(n, report);
      }
      if (n.type === 'FRAME') return await buildFrame(n, report);
      warn(report, 'Skipped a layer of an unknown type: ' + truncate(n.type, 20));
    } catch (e) {
      warn(report, 'A ' + n.type + ' layer ("' + truncate(n.name || '', 24) + '") failed: '
        + truncate(e && e.message, 70));
    }
    return null;
  }

  /* -------------------------------------------------------------- import */
  function countType(node, type) {
    var total = node.type === type ? 1 : 0;
    var children = node.children || [];
    for (var i = 0; i < children.length; i++) total += countType(children[i], type);
    return total;
  }

  async function importDocument(doc) {
    var report = newReport();
    baseUrl = doc && doc.source ? String(doc.source) : '';

    var tree = doc && (doc.document || doc.root);
    if (!tree) {
      throw new Error('No "document" tree found — this does not look like a FIGMA JSON export.');
    }
    if (num(doc.version) > 1) {
      note(report, 'The file says version ' + doc.version + '; this plugin reads the version 1 tree.');
    }

    progress('Rebuilding frames…');
    var root = await buildNode(tree, report);
    if (!root) throw new Error('The tree could not be rebuilt; see the notes below.');
    root.name = tree.name || 'Screen';

    if (options.scale && options.scale !== 1) {
      try {
        root.resize(root.width * options.scale, root.height * options.scale);
        scaleChildren(root, options.scale, options.scale);
      } catch (e) {
        warn(report, 'The scale could not be applied: ' + truncate(e && e.message, 60));
      }
    }

    figma.currentPage.appendChild(root);
    root.x = Math.round(figma.viewport.center.x - root.width / 2);
    root.y = Math.round(figma.viewport.center.y - root.height / 2);
    figma.currentPage.selection = [root];
    figma.viewport.scrollAndZoomIntoView([root]);

    report.frames = countType(root, 'FRAME');
    report.texts = countType(root, 'TEXT');
    return report;
  }

  figma.ui.onmessage = async function (msg) {
    if (!msg || !msg.type) return;
    if (msg.type === 'options') { options = msg.options || options; return; }
    if (msg.type === 'cancel') { figma.closePlugin(); return; }
    if (msg.type !== 'import' || building) return;

    building = true;
    figma.ui.postMessage({ type: 'busy', busy: true });
    try {
      var doc = JSON.parse(msg.json);
      var report = await importDocument(doc);
      figma.ui.postMessage({ type: 'done', report: report });
    } catch (e) {
      figma.ui.postMessage({ type: 'error', message: (e && e.message) ? e.message : String(e) });
    } finally {
      building = false;
      figma.ui.postMessage({ type: 'busy', busy: false });
    }
  };
})();