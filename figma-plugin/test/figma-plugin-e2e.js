/* ============================================================================
   figma-plugin-e2e.js — drives figma-plugin/code.js against mock-figma.js.

   code.js normally runs inside Figma's sandbox, where the only way to exercise
   it is to open the plugin, export a .figma.json by hand and eyeball the layers.
   Here it runs under plain Node: the mock stands in for the figma.* API, the
   fixture stands in for a FIGMA JSON export, and every report the plugin hands
   back to the UI is asserted on — plus the geometry of the tree it produced.

       node figma-plugin/test/figma-plugin-e2e.js
       node figma-plugin/test/figma-plugin-e2e.js --reparent=relative
       node figma-plugin/test/figma-plugin-e2e.js path/to/Screen.figma.json

   Exit code 0 when every check passes, 1 otherwise. The last argument form
   imports a real export and prints what the plugin made of it, without the
   fixture's expected values.

   What is asserted, and why
     • the message protocol both halves agree on (ui.html ↔ code.js)
     • the report: counts, warnings, notes — the plugin's promise that nothing
       fails silently
     • the geometry, fills, gradients, shadows, strokes and fonts of the tree
     • the options: gradients off, shadows off, scale 2
     • the failure paths: no document, a future version, a cancel
   ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var mockApi = require('./mock-figma');

var PLUGIN_DIR = path.join(__dirname, '..');
var CODE_PATH = path.join(PLUGIN_DIR, 'code.js');
var UI_PATH = path.join(PLUGIN_DIR, 'ui.html');
var FIXTURE_PATH = path.join(__dirname, 'fixtures', 'send-to-bank.figma.json');

var tol = 1e-9;

/* ------------------------------------------------------------- reporting */
var checks = 0;
var failures = [];
var findings = [];

function ok(label, condition, detail) {
  checks++;
  if (condition) return true;
  failures.push(label + (detail ? ' — ' + detail : ''));
  return false;
}

function show(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  try { return JSON.stringify(value); } catch (e) { return String(value); }
}

function is(label, actual, expected) {
  return ok(label, actual === expected, 'expected ' + show(expected) + ', got ' + show(actual));
}

function near(label, actual, expected, tolerance) {
  var t = tolerance === undefined ? tol : tolerance;
  return ok(label, Math.abs(actual - expected) <= t,
    'expected ' + expected + ' ±' + t + ', got ' + actual);
}

function colorNear(label, actual, expected) {
  var channels = ['r', 'g', 'b'];
  for (var i = 0; i < channels.length; i++) {
    near(label + ' ' + channels[i], actual[channels[i]], expected[channels[i]], 0.001);
  }
}

function matrixNear(label, actual, expected) {
  for (var r = 0; r < expected.length; r++) {
    for (var c = 0; c < expected[r].length; c++) near(label + ' [' + r + '][' + c + ']', actual[r][c], expected[r][c]);
  }
}

function contains(list, needle) {
  for (var i = 0; i < (list || []).length; i++) {
    if (String(list[i]).indexOf(needle) !== -1) return true;
  }
  return false;
}

function section(title) {
  console.log('\n' + title);
  console.log(new Array(title.length + 1).join('-'));
}

/* ----------------------------------------------------------- environment */
function loadPlugin(mock) {
  var sandbox = {
    figma: mock.figma,
    __html__: fs.readFileSync(UI_PATH, 'utf8'),
    console: console,
    URL: URL,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(CODE_PATH, 'utf8'), sandbox, { filename: 'code.js' });
  return sandbox;
}

function newRun(mockOptions) {
  var mock = mockApi.createMockFigma(mockOptions);
  var sandbox = loadPlugin(mock);
  return { mock: mock, sandbox: sandbox, figma: mock.figma };
}

/* Drives the UI side of the conversation: options first, then the file. */
async function importScreen(run, doc, options) {
  await run.figma.ui.onmessage({
    type: 'options',
    options: options || { scale: 1, gradients: true, effects: true }
  });
  await run.figma.ui.onmessage({ type: 'import', json: JSON.stringify(doc) });
  return run.mock.log.messages;
}

function lastOf(messages, type) {
  for (var i = messages.length - 1; i >= 0; i--) if (messages[i].type === type) return messages[i];
  return null;
}

function typesOf(messages) {
  return messages.map(function (m) { return m.type; });
}

/* ------------------------------------------------------------- tree utils */
function findByName(node, name) {
  if (!node) return null;
  if (node.name === name) return node;
  for (var i = 0; i < (node.children || []).length; i++) {
    var hit = findByName(node.children[i], name);
    if (hit) return hit;
  }
  return null;
}

function walk(node, visit, parentAbs) {
  var abs = {
    x: (parentAbs ? parentAbs.x : 0) + num(node.x),
    y: (parentAbs ? parentAbs.y : 0) + num(node.y)
  };
  visit(node, abs);
  for (var i = 0; i < (node.children || []).length; i++) walk(node.children[i], visit, abs);
  return node;
}

function num(v) { return typeof v === 'number' && isFinite(v) ? v : parseFloat(v) || 0; }

function outline(node, depth) {
  var pad = new Array((depth || 0) * 2 + 1).join(' ');
  var line = pad + node.type + ' "' + node.name + '" '
    + Math.round(node.x) + ',' + Math.round(node.y) + ' ' + Math.round(node.width) + '×' + Math.round(node.height);
  var out = [line];
  for (var i = 0; i < (node.children || []).length; i++) {
    out = out.concat(outline(node.children[i], (depth || 0) + 1));
  }
  return out;
}

/* ----------------------------------------------------------------- main */
async function main(argv) {
  var reparent = 'absolute';
  var file = null;
  for (var a = 2; a < argv.length; a++) {
    if (argv[a].indexOf('--reparent=') === 0) reparent = argv[a].split('=')[1];
    else file = argv[a];
  }
  if (file) return smoke(file);

  var fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  var uiHtml = fs.readFileSync(UI_PATH, 'utf8');
  var codeSource = fs.readFileSync(CODE_PATH, 'utf8');

  console.log('Import M-PESA JSON — importer harness');
  console.log('fixture : ' + (file || path.relative(process.cwd(), FIXTURE_PATH)));
  console.log('mock    : reparent=' + reparent + ' (Figma preserves a node\'s absolute '
    + 'position when it is appended to a parent)');

  /* Every run gets the same world: Barlow missing (most Figma accounts) and
     assets/gone.png unreachable, which is what the fixture's notes describe. */
  function fresh(extra) {
    var opts = { reparent: reparent, failImages: ['gone.png'] };
    if (extra) for (var key in extra) opts[key] = extra[key];
    return newRun(opts);
  }

  /* -------------------------------------------------------- 1. protocol */
  section('1. ui.html ↔ code.js protocol');
  var sent = ['options', 'import', 'cancel'];
  var received = ['progress', 'done', 'error'];
  for (var s = 0; s < sent.length; s++) {
    ok('ui.html sends "' + sent[s] + '"', uiHtml.indexOf("type: '" + sent[s] + "'") !== -1);
    ok('code.js handles "' + sent[s] + '"', codeSource.indexOf("'" + sent[s] + "'") !== -1);
  }
  for (var r = 0; r < received.length; r++) {
    ok('code.js posts "' + received[r] + '"', codeSource.indexOf("type: '" + received[r] + "'") !== -1);
    ok('ui.html reacts to "' + received[r] + '"', uiHtml.indexOf("'" + received[r] + "'") !== -1);
  }
  /* "busy" is the plugin telling the page it is working; the page drives its
     own spinner off "progress" and "done", so it does not read this one. */
  ok('code.js brackets the work with busy', codeSource.indexOf("type: 'busy'") !== -1);
  ok('ui.html ignores the advisory busy message', uiHtml.indexOf("'busy'") === -1);

  /* -------------------------------------------------------- 2. boot */
  section('2. the plugin boots');
  var base = fresh();
  is('showUI called once', base.mock.log.showUI.length, 1);
  is('showUI got the real ui.html', base.mock.log.showUI[0].html, uiHtml);
  is('showUI window width', base.mock.log.showUI[0].options.width, 440);
  is('showUI window height', base.mock.log.showUI[0].options.height, 620);
  ok('onmessage is waiting', typeof base.figma.ui.onmessage === 'function');

  var messages = await importScreen(base, fixture);
  is('message sequence', typesOf(messages).join(' → '), 'busy → progress → done → busy');

  var root = findByName(base.figma.currentPage.children[0], 'Send to Bank');
  var report = lastOf(messages, 'done').report;
  ok('the screen was built', !!root, 'no FRAME named "Send to Bank" on the page');

  /* -------------------------------------------------------- 3. the tree */
  section('3. the tree it built');
  is('root type', root.type, 'FRAME');
  is('root width', root.width, 360);
  is('root height', root.height, 808);
  is('root name from the export', root.name, 'Send to Bank');
  is('root clips content', root.clipsContent, true);

  /* The root lands centred in the viewport, selected and scrolled to. */
  is('root centred on the viewport x', root.x, 1000 - 360 / 2);
  is('root centred on the viewport y', root.y, 500 - 808 / 2);
  is('root selected', base.figma.currentPage.selection.length, 1);
  is('the selection is the screen', base.figma.currentPage.selection[0], root);
  is('scrolled into view', base.mock.log.scroll.length, 1);
  is('scrollAndZoomIntoView got the screen', base.mock.log.scroll[0][0], root);

  /* -------------------------------------------------- 4. gradient + fills */
  section('4. gradient on the root');
  var paint = root.fills[0];
  is('root fill count', root.fills.length, 1);
  is('root fill is a gradient', paint.type, 'GRADIENT_LINEAR');
  is('gradient stop count', paint.gradientStops.length, 2);
  colorNear('gradient start #EAF7F0', paint.gradientStops[0].color, { r: 234 / 255, g: 247 / 255, b: 240 / 255 });
  near('gradient start position', paint.gradientStops[0].position, 0);
  colorNear('gradient end #FFFFFF', paint.gradientStops[1].color, { r: 1, g: 1, b: 1 });
  near('gradient end position', paint.gradientStops[1].position, 1);
  /* 180deg is "to bottom": Figma's own u axis turned a quarter of a turn. */
  matrixNear('gradient transform', paint.gradientTransform, [[0, 1, 0], [-1, 0, 1]]);

  /* --------------------------------------------- 5. card: radius, shadow */
  section('5. balance-card');
  var card = findByName(root, 'balance-card');
  ok('the card exists', !!card);
  is('corner radius', card.cornerRadius, 16);
  is('card width', card.width, 328);
  is('card height', card.height, 160);
  is('white fill', card.fills[0].type, 'SOLID');
  colorNear('card fill colour', card.fills[0].color, { r: 1, g: 1, b: 1 });
  is('stroke count', card.strokes.length, 1);
  is('stroke weight', card.strokeWeight, 1);
  is('stroke alignment (CSS draws borders inside)', card.strokeAlign, 'INSIDE');
  is('shadow count', card.effects.length, 1);
  is('shadow type', card.effects[0].type, 'DROP_SHADOW');
  is('shadow offset x', card.effects[0].offset.x, 0);
  is('shadow offset y', card.effects[0].offset.y, 2);
  is('CSS blur halved for Figma', card.effects[0].radius, 4);
  near('shadow keeps the CSS alpha', card.effects[0].color.a, 0.06, 0.001);

  /* ------------------------------------------------------- 6. the text */
  section('6. text layers');
  var balance = findByName(card, 'BALANCE');
  ok('BALANCE exists', !!balance);
  is('characters kept', balance.characters, 'BALANCE');
  /* Barlow is not installed in most Figma accounts, and code.js deliberately
     does not guess a weight on a family it could not load: it drops to the
     nearest family it knows and names the swap in the report. */
  is('font family substituted', balance.fontName.family, 'Inter');
  is('the substitute style Figma actually offered', balance.fontName.style, 'Regular');
  is('font size', balance.fontSize, 11);
  is('letter spacing', balance.letterSpacing.value, 1);
  is('line height', balance.lineHeight.value, 14);
  is('horizontal alignment', balance.textAlignHorizontal, 'CENTER');
  is('text fill count', balance.fills.length, 1);
  colorNear('text colour #7A8480', balance.fills[0].color, { r: 122 / 255, g: 132 / 255, b: 128 / 255 });
  ok('text kept auto width (never resized)',
    balance.width > 0 && balance.width < card.width, 'width was ' + balance.width);

  var amount = findByName(card, 'Ksh 12,450.00');
  is('amount font size', amount.fontSize, 28);

  var photoText = findByName(root, 'photo-text');
  is('an image fill on text becomes a solid, so the words stay visible',
    photoText.fills[0].type, 'SOLID');
  colorNear('substitute ink colour', photoText.fills[0].color, { r: 0.16, g: 0.19, b: 0.18 });

  /* ------------------------------------------------------ 7. the images */
  section('7. images');
  var logo = findByName(card, 'logo');
  is('logo fill is an image', logo.fills[0].type, 'IMAGE');
  is('image hash matches the URL', logo.fills[0].imageHash,
    mockApi.hashOf('http://localhost:5500/assets/mpesa-mark.png'));
  is('relative src resolved against doc.source', base.mock.log.images[0],
    'http://localhost:5500/assets/mpesa-mark.png');
  is('scaleMode', logo.fills[0].scaleMode, 'FILL');
  is('corner radius kept on the picture', logo.cornerRadius, 8);

  var avatar = findByName(card, 'avatar');
  is('a picture that failed stays a grey box', avatar.fills[0].type, 'SOLID');
  colorNear('placeholder grey', avatar.fills[0].color, { r: 0.86, g: 0.87, b: 0.87 });
  is('the failed address was still tried', base.mock.log.images.length, 2);
  is('and it is the missing one', base.mock.log.images[1], 'http://localhost:5500/assets/gone.png');
  ok('the wordmark on text was never fetched (textFills swaps it for ink)',
    !contains(base.mock.log.images, 'wordmark'));

  /* -------------------------------------------------------- 8. vectors */
  section('8. vectors');
  var icon = findByName(root, 'send-icon');
  ok('the icon was created from its markup', !!icon);
  is('scaled to the box CSS gave it (width)', icon.width, 20);
  is('scaled to the box CSS gave it (height)', icon.height, 18);
  is('createNodeFromSvg returns a frame of shapes', icon.children.length, 2);
  is('and the shapes were scaled with it', icon.children[0].width, 20);
  is('in y as well', icon.children[0].height, 18);

  var nav = findByName(root, 'nav');
  is('per-corner radius, top left', nav.topLeftRadius, 12);
  is('per-corner radius, top right', nav.topRightRadius, 12);
  is('per-corner radius, bottom right', nav.bottomRightRadius, 0);
  is('per-corner radius, bottom left', nav.bottomLeftRadius, 0);
  is('dashes carried over', nav.dashPattern.join(' '), '3 2');

  /* -------------------------------------------------------- 9. the report */
  section('9. the report the UI shows');
  is('frames (the SVG frame counts, as it does in Figma)', report.frames, 4);
  is('text layers', report.texts, 4);
  is('images fetched', report.images, 1);
  is('images that failed', report.imagesFailed, 1);
  is('vectors', report.svgs, 1);
  is('gradients', report.gradients, 1);
  is('gradients flattened', report.gradientsFlattened, 0);
  is('shadows', report.effects, 1);
  is('fonts substituted', report.fallbackFonts, 4);
  is('font tally — Inter Regular (the fallback style)', report.fonts['Inter Regular'], 4);
  ok('the unknown layer is named, not dropped silently',
    contains(report.warnings, 'unknown type: CANVAS'), show(report.warnings));
  ok('and the grey box is flagged',
    contains(report.warnings, 'grey box'), show(report.warnings));
  ok('the substitution is spelled out',
    contains(report.notes, 'Barlow SemiBold → Inter SemiBold'), show(report.notes));
  ok('the failed picture is named with its address',
    contains(report.notes, 'assets/gone.png'), show(report.notes));

  /* ------------------------------------------- 10. Barlow really present */
  section('10. the same screen where Barlow is installed');
  var withBarlow = fresh({ availableFonts: mockApi.defaultFonts().concat(mockApi.barlowFonts()) });
  var barlowMessages = await importScreen(withBarlow, fixture);
  var barlowReport = lastOf(barlowMessages, 'done').report;
  is('nothing had to be substituted', barlowReport.fallbackFonts, 0);
  is('Barlow Bold used', barlowReport.fonts['Barlow Bold'], 2);
  is('Barlow SemiBold used', barlowReport.fonts['Barlow SemiBold'], 1);
  is('Barlow Regular used', barlowReport.fonts['Barlow Regular'], 1);
  /* Here the exported weight can be honoured, which is what the tally above
     only half shows: 600 is asked for as SemiBold, not as Regular. */
  var barlowRoot = findByName(withBarlow.figma.currentPage.children[0], 'Send to Bank');
  var barlowCard = findByName(barlowRoot, 'balance-card');
  is('weight 600 becomes the SemiBold style', findByName(barlowCard, 'BALANCE').fontName.style, 'SemiBold');
  is('weight 700 becomes the Bold style', findByName(barlowCard, 'Ksh 12,450.00').fontName.style, 'Bold');
  is('weight 400 stays Regular', findByName(barlowRoot, 'photo-text').fontName.style, 'Regular');

  /* ------------------------------------------------------- 11. options */
  section('11. gradients off');
  var noGradients = fresh();
  var flatMessages = await importScreen(noGradients, fixture,
    { scale: 1, gradients: false, effects: true });
  var flatReport = lastOf(flatMessages, 'done').report;
  is('no gradient painted', flatReport.gradients, 0);
  is('one gradient flattened', flatReport.gradientsFlattened, 1);
  var flatRoot = findByName(noGradients.figma.currentPage.children[0], 'Send to Bank');
  is('and the screen is not left blank', flatRoot.fills[0].type, 'SOLID');
  colorNear('flattened to the gradient\'s last colour', flatRoot.fills[0].color, { r: 1, g: 1, b: 1 });
  ok('the substitution is reported', contains(flatReport.notes, 'flattened'), show(flatReport.notes));

  section('12. shadows off');
  var noEffects = fresh();
  var noEffectMessages = await importScreen(noEffects, fixture,
    { scale: 1, gradients: true, effects: false });
  is('no shadow applied', lastOf(noEffectMessages, 'done').report.effects, 0);
  is('the card has no effects', findByName(noEffects.figma.currentPage.children[0], 'balance-card').effects.length, 0);

  section('13. scale 2');
  var scaled = fresh();
  var scaledMessages = await importScreen(scaled, fixture,
    { scale: 2, gradients: true, effects: true });
  var scaledRoot = findByName(scaled.figma.currentPage.children[0], 'Send to Bank');
  is('screen width doubled', scaledRoot.width, 720);
  is('screen height doubled', scaledRoot.height, 1616);
  var scaledCard = findByName(scaledRoot, 'balance-card');
  is('card width doubled', scaledCard.width, 656);
  is('card moved with the scale', scaledCard.x, 32);
  is('card moved in y too', scaledCard.y, 240);
  var scaledBalance = findByName(scaledCard, 'BALANCE');
  is('auto-width text cannot be scaled, so it is left alone', scaledBalance.width, balance.width);
  is('but it still moves with the scale (x)', scaledBalance.x, balance.x * 2);
  is('and in y', scaledBalance.y, balance.y * 2);
  ok('the screen is still centred after scaling', scaledRoot.x === 1000 - 720 / 2);

  /* ------------------------------------------------------ 14. bad input */
  section('14. input that is not a screen');
  var broken = fresh();
  var brokenMessages = await importScreen(broken, { format: 'figma-node-tree', version: 1 });
  is('nothing was reported as done', lastOf(brokenMessages, 'done'), null);
  is('the UI was told why', lastOf(brokenMessages, 'error').message,
    'No "document" tree found — this does not look like a FIGMA JSON export.');
  is('and the spinner was stopped', lastOf(brokenMessages, 'busy').busy, false);
  is('nothing was left on the page', broken.figma.currentPage.children.length, 0);

  section('15. a file from a newer exporter');
  var future = JSON.parse(JSON.stringify(fixture));
  future.version = 2;
  var futureRun = fresh();
  var futureReport = lastOf(await importScreen(futureRun, future), 'done').report;
  ok('the version mismatch is noted, not fatal',
    contains(futureReport.notes, 'version 2'), show(futureReport.notes));
  is('and the screen still came through', futureReport.frames, 4);

  section('16. cancel');
  var closing = fresh();
  await closing.figma.ui.onmessage({ type: 'cancel' });
  is('the plugin closed', closing.mock.log.closed, 1);

  /* --------------------------------------------------------- 17. layout */
  section('17. layout — where every layer actually lands');
  /* The exporter zeroes the screen's own origin and the plugin then centres the
     screen in the viewport, so the screen's origin here is (820, 96), not
     (0, 0). Everything below is measured from there. */
  var origin = { x: 1000 - 360 / 2, y: 500 - 808 / 2 };
  var expected = {};
  walk(fixture.document, function (node, abs) {
    if (node.name) expected[node.name] = { x: abs.x, y: abs.y };
  }, origin);

  var misplaced = [];
  walk(root, function (node, abs) {
    var live = base.mock.absPos(node);
    if (!expected[node.name]) return;
    if (Math.abs(live.x - expected[node.name].x) > 0.5 || Math.abs(live.y - expected[node.name].y) > 0.5) {
      misplaced.push(node.name + ': expected ' + Math.round(expected[node.name].x) + ','
        + Math.round(expected[node.name].y) + ' — landed at ' + Math.round(live.x) + ',' + Math.round(live.y));
    }
  });
  ok('every named layer sits where the exporter measured it',
    misplaced.length === 0, misplaced.join('; '));
  ok('the layer the exporter could not name is simply absent', findByName(root, 'mystery') === null);

  /* The other reading of appendChild, to show which rule the code assumes. */
  var relativeRun = fresh({ reparent: 'relative' });
  await importScreen(relativeRun, fixture);
  var relativeRoot = findByName(relativeRun.figma.currentPage.children[0], 'Send to Bank');
  var relativeMisplaced = [];
  walk(relativeRoot, function (node) {
    var live = relativeRun.mock.absPos(node);
    if (!expected[node.name]) return;
    if (Math.abs(live.x - expected[node.name].x) > 0.5 || Math.abs(live.y - expected[node.name].y) > 0.5) {
      relativeMisplaced.push(node.name + ' ' + Math.round(live.x) + ',' + Math.round(live.y)
        + ' (wanted ' + Math.round(expected[node.name].x) + ',' + Math.round(expected[node.name].y) + ')');
    }
  });

  if (misplaced.length) {
    findings.push(
      'code.js positions a child before appending it to its parent, and Figma\'s\n'
      + '    appendChild keeps a node\'s absolute position, rewriting x/y in the new\n'
      + '    frame. So every nested frame\'s children land short by that frame\'s own\n'
      + '    origin — visible above as the balance card\'s text and pictures. Under the\n'
      + '    "keep relative" reading the geometry is right except for: '
      + (relativeMisplaced.length ? relativeMisplaced.join('; ') : 'nothing')
      + '\n    which is the rule the code assumes. Fix: append first, then position — in\n'
      + '    buildFrame, build the child, frame.appendChild(child), then applyBox(child).');
  }

  /* ---------------------------------------------------------- summary */
  console.log('');
  if (misplaced.length) {
    console.log('FINDING (in code.js, not in the harness)');
    console.log('  ' + misplaced.length + ' layer(s) are misplaced under Figma\'s reparent rule:');
    for (var m = 0; m < misplaced.length; m++) console.log('    ' + misplaced[m]);
    console.log('  ' + findings.join('\n  '));
  }

  console.log('');
  console.log('done     : ' + (lastOf(messages, 'done') ? 'yes' : 'no'));
  console.log('report   : frames ' + report.frames + ', text ' + report.texts + ', images ' + report.images
    + ' (' + report.imagesFailed + ' failed), vectors ' + report.svgs + ', gradients ' + report.gradients
    + ', shadows ' + report.effects);
  console.log('fonts    : ' + Object.keys(report.fonts).map(function (f) {
    return f + ' ×' + report.fonts[f];
  }).join(', '));
  console.log('checks   : ' + (checks - failures.length) + '/' + checks + ' passed');

  if (failures.length) {
    console.log('\nfailed checks:');
    for (var f = 0; f < failures.length; f++) console.log('  ✘ ' + failures[f]);
  }

  process.exitCode = failures.length || misplaced.length ? 1 : 0;
}

/* A real export: import it, print what came out, skip the fixture's numbers. */
async function smoke(file) {
  var doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  var run = newRun({});
  var messages = await importScreen(run, doc);
  var error = lastOf(messages, 'error');
  if (error) {
    console.log('the plugin refused the file: ' + error.message);
    process.exitCode = 1;
    return;
  }
  var root = run.figma.currentPage.children[0];
  console.log(root ? outline(root).join('\n') : 'nothing was built');
  var report = lastOf(messages, 'done').report;
  console.log('\nframes ' + report.frames + ', text ' + report.texts + ', images ' + report.images
    + ' (' + report.imagesFailed + ' failed), vectors ' + report.svgs + ', gradients ' + report.gradients
    + ', shadows ' + report.effects);
  if (report.warnings.length) console.log('needs a look:\n  ' + report.warnings.join('\n  '));
  if (report.notes.length) console.log('approximated:\n  ' + report.notes.join('\n  '));
}

main(process.argv).catch(function (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exitCode = 1;
});