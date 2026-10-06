/* ============================================================================
   mock-figma.js — a stand-in for the Figma Plugin API, complete enough to run
   figma-plugin/code.js under plain Node.

   Why it exists
     code.js is the only part of the plugin that touches the document, and it
     is plain ES2017 with no build step (see README, "Editing the plugin"). So
     a mock of the handful of figma.* calls it makes lets the importer run
     headlessly: no Figma, no network, no hand-exported .figma.json.

   Fidelity, on purpose
     The behaviours the plugin leans on are imitated closely enough to catch the
     mistakes that otherwise only surface in the real editor:

       • a text node cannot be resized — resize() throws, as in Figma
       • characters / fontName throw unless loadFontAsync succeeded first
       • a font the document does not have is rejected, as Figma rejects it
       • createImageAsync rejects for the URLs a test marks as unreachable
       • appendChild keeps a node's absolute position, the way Figma does
         (switch `reparent: 'relative'` to model the other reading)

     Everything else is a plain object the runner asserts against.

   Usage
     var createMockFigma = require('./mock-figma');
     var mock = createMockFigma({ failImages: ['gone.png'] });
     mock.figma.createFrame();
   ========================================================================= */
'use strict';

var INTER_STYLES = ['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium',
  'SemiBold', 'Bold', 'ExtraBold', 'Black'];

/* Families a test can rely on being present. Barlow is deliberately absent: the
   prototype asks for it and most Figma accounts do not have it, so that is the
   interesting path (code.js falls back and says so in the report). */
function defaultFonts() {
  var out = [];
  for (var i = 0; i < INTER_STYLES.length; i++) out.push({ family: 'Inter', style: INTER_STYLES[i] });
  out.push({ family: 'Roboto', style: 'Regular' });
  return out;
}

function barlowFonts() {
  var out = [];
  for (var i = 0; i < INTER_STYLES.length; i++) out.push({ family: 'Barlow', style: INTER_STYLES[i] });
  return out;
}

function fontKey(font) { return font.family + '::' + font.style; }

function num(v) { return typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0; }

/* FNV-1a: an image hash that is stable across runs, so a report can be
   compared against a checked-in expectation. */
function hashOf(text) {
  var h = 2166136261;
  for (var i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return 'img' + ('00000000' + h.toString(16)).slice(-8);
}

function toMatcher(list) {
  if (!list) return function () { return false; };
  if (typeof list === 'function') return list;
  var parts = (list instanceof Array ? list : [list]).map(String);
  return function (url) {
    for (var i = 0; i < parts.length; i++) if (String(url).indexOf(parts[i]) !== -1) return true;
    return false;
  };
}

function createMockFigma(options) {
  options = options || {};

  var availableFonts = options.availableFonts || defaultFonts();
  var failsImage = toMatcher(options.failImages);
  var imageSizes = options.imageSizes || {};
  var reparent = options.reparent === 'relative' ? 'relative' : 'absolute';
  var center = options.viewportCenter || { x: 1000, y: 500 };

  var loaded = {};    /* "family::style" -> loaded at least once */
  var nodes = [];
  var log = {
    showUI: [], fonts: [], images: [], scroll: [], messages: [], closed: 0
  };

  function fontAvailable(font) {
    for (var i = 0; i < availableFonts.length; i++) {
      if (availableFonts[i].family === font.family && availableFonts[i].style === font.style) return true;
    }
    return false;
  }

  /* Position relative to the page, which is what the viewport and the exported
     numbers are measured from. */
  function absPos(node) {
    var x = 0, y = 0, n = node;
    while (n && n !== page) {
      x += num(n.x);
      y += num(n.y);
      n = n.parent;
    }
    return { x: x, y: y };
  }

  function detach(child) {
    if (!child.parent || !child.parent.children) return;
    var at = child.parent.children.indexOf(child);
    if (at !== -1) child.parent.children.splice(at, 1);
    child.parent = null;
  }

  /* Figma re-parents by preserving where the node sits on screen, so the new
     relative x/y is recomputed from the absolute one. */
  function attach(child, parent) {
    var before = absPos(child);
    detach(child);
    child.parent = parent;
    parent.children.push(child);
    if (reparent === 'absolute') {
      var pa = absPos(parent);
      child.x = before.x - pa.x;
      child.y = before.y - pa.y;
    }
    return child;
  }

  function makeNode(type, defaults) {
    var node = {
      type: type,
      name: type,
      x: 0, y: 0,
      width: defaults && defaults.width !== undefined ? num(defaults.width) : 100,
      height: defaults && defaults.height !== undefined ? num(defaults.height) : 100,
      opacity: 1,
      visible: true,
      fills: [],
      strokes: [],
      strokeWeight: 0,
      strokeAlign: 'INSIDE',
      dashPattern: [],
      effects: [],
      cornerRadius: 0,
      clipsContent: true,
      children: [],
      parent: null
    };

    node.resize = function (w, h) {
      if (type === 'TEXT') throw new Error('Cannot resize a text node with auto width');
      node.width = num(w);
      node.height = num(h);
    };
    node.appendChild = function (child) { return attach(child, node); };
    node.remove = function () { detach(node); };
    node.absPos = function () { return absPos(node); };

    nodes.push(node);
    return attach(node, page);   /* a new node lands on the current page */
  }

  /* Text keeps auto width, so the box follows the string: one line of about
     0.55em per character, and lineHeight when the plugin set one. */
  function measureText(node, characters) {
    var lines = String(characters).split('\n');
    var widest = 0;
    for (var i = 0; i < lines.length; i++) widest = Math.max(widest, lines[i].length);
    node.width = Math.max(1, Math.ceil(widest * node.fontSize * 0.55));
    var lh = node.lineHeight && node.lineHeight.unit === 'PIXELS' && num(node.lineHeight.value)
      ? num(node.lineHeight.value) : node.fontSize * 1.2;
    node.height = Math.round(lines.length * lh);
  }

  function makeText() {
    var node = makeNode('TEXT');
    node.fontSize = 12;
    node.textAlignHorizontal = 'LEFT';
    node.lineHeight = { unit: 'AUTO' };
    node.letterSpacing = { unit: 'PIXELS', value: 0 };
    node._fontName = { family: 'Inter', style: 'Regular' };
    node._characters = '';

    Object.defineProperty(node, 'fontName', {
      get: function () { return node._fontName; },
      set: function (value) {
        if (!loaded[fontKey(value)]) throw new Error('Cannot use a font before loading it: ' + fontKey(value));
        node._fontName = { family: value.family, style: value.style };
      }
    });

    Object.defineProperty(node, 'characters', {
      get: function () { return node._characters; },
      set: function (value) {
        if (!loaded[fontKey(node._fontName)]) throw new Error('Cannot write to a text node with an unloaded font');
        node._characters = String(value);
        measureText(node, node._characters);
      }
    });

    measureText(node, '');
    return node;
  }

  /* createNodeFromSvg hands back a frame of vectors, not one flattened node —
     which is why an icon counts as a FRAME in code.js's report. */
  function makeSvg(markup) {
    if (typeof markup !== 'string' || markup.indexOf('<svg') === -1) {
      throw new Error('Malformed SVG: no <svg> element');
    }
    var viewBox = markup.match(/viewBox\s*=\s*["']\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)/i);
    var widthAttr = markup.match(/\swidth\s*=\s*["'](-?[\d.]+)/i);
    var heightAttr = markup.match(/\sheight\s*=\s*["'](-?[\d.]+)/i);

    var w = widthAttr ? num(widthAttr[1]) : (viewBox ? num(viewBox[3]) : 100);
    var h = heightAttr ? num(heightAttr[1]) : (viewBox ? num(viewBox[4]) : 100);

    var frame = makeNode('FRAME', { width: w, height: h });
    frame.name = 'svg';
    frame.clipsContent = false;

    var shapes = markup.match(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/gi) || [];
    for (var i = 0; i < shapes.length; i++) {
      var vector = makeNode('VECTOR', { width: w, height: h });
      vector.name = shapes[i].replace(/[<>]/g, '').toLowerCase();
      vector.x = 0;
      vector.y = 0;
      attach(vector, frame);
    }
    return frame;
  }

  function makeImage(url) {
    log.images.push(url);
    if (failsImage(url)) return Promise.reject(new Error('Failed to fetch image: ' + url));
    var size = imageSizes[url] || { width: 64, height: 64 };
    return Promise.resolve({
      hash: hashOf(String(url)),
      getSizeAsync: function () { return Promise.resolve({ width: size.width, height: size.height }); }
    });
  }

  var page = {
    type: 'PAGE',
    name: 'Page 1',
    children: [],
    selection: [],
    appendChild: function (child) { return attach(child, page); },
    removeChild: function (child) { detach(child); }
  };

  var figma = {
    showUI: function (html, opts) { log.showUI.push({ html: html, options: opts }); },
    closePlugin: function () { log.closed++; },

    createFrame: function () { return makeNode('FRAME'); },
    createRectangle: function () { return makeNode('RECTANGLE'); },
    createText: makeText,
    createNodeFromSvg: makeSvg,
    createImageAsync: makeImage,

    loadFontAsync: function (font) {
      var key = fontKey(font);
      log.fonts.push(key);
      if (!fontAvailable(font)) {
        return Promise.reject(new Error('Font family "' + font.family + '" is not available'));
      }
      loaded[key] = true;
      return Promise.resolve();
    },

    viewport: {
      center: center,
      scrollAndZoomIntoView: function (nodes) { log.scroll.push(nodes); }
    },

    currentPage: page,
    ui: {
      postMessage: function (message) { log.messages.push(message); },
      onmessage: null
    }
  };

  return {
    figma: figma,
    log: log,
    nodes: nodes,
    reparent: reparent,
    absPos: absPos
  };
}

module.exports = {
  createMockFigma: createMockFigma,
  defaultFonts: defaultFonts,
  barlowFonts: barlowFonts,
  INTER_STYLES: INTER_STYLES,
  fontKey: fontKey,
  hashOf: hashOf
};