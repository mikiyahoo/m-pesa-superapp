/* ------------------------------------------------------------------
   Prototype bootstrap.

   Linking prompts are dismissible as a rule. The one exception is
   baked into the send-to-bank flow: an amount above 7,000 Br makes the
   link prompt mandatory because the money is not allowed to move until
   the account is linked. That case is raised by the flow itself through
   window.prototypeMode.forceMandatory().

   Prompts are presented as a full screen, except on screens marked
   data-prompt="popup" (buying a package), which keep the centred card.
   The full screen is applied by restyling the existing #faydaModal
   rather than replacing it, so each page's own openFayda()/closeFayda()
   keep working untouched.

   The withdraw flow is fixed to options first: the linking ask is
   raised on the chosen method's screen, never before the sheet.
------------------------------------------------------------------ */
(function () {
    'use strict';

    /* ---------------------------------------------------- entry point */
    /* A run always starts at the app home. Opening or refreshing any
       other screen bounces there, while moving between screens inside a
       run is left alone -- both look like a plain navigation to the
       browser, so a session marker tells them apart. */
    var ENTRY = 'index.html';
    var RUN_KEY = 'appRunning';

    function onEntryPage() {
        var path = location.pathname;
        return path === '' || path === '/' || /\/index\.html$/i.test(path);
    }

    function wasReloaded() {
        try {
            var entry = performance.getEntriesByType('navigation')[0];
            return !!entry && entry.type === 'reload';
        } catch (e) {
            return false;
        }
    }

    function beginRun() {
        try {
            sessionStorage.removeItem('faydaActivated');
            sessionStorage.removeItem('pendingWithdraw');
            sessionStorage.removeItem('pendingPurchase');
            sessionStorage.removeItem('fdState');
            sessionStorage.removeItem('savingsReturn');
            sessionStorage.setItem(RUN_KEY, '1');
        } catch (e) {}
    }

    /* Returns false when the page is being navigated away from. */
    function guardEntry() {
        var running = false;
        try { running = sessionStorage.getItem(RUN_KEY) === '1'; } catch (e) {}
        var fresh = !running || wasReloaded();

        if (onEntryPage()) {
            if (fresh) beginRun();
            return true;
        }
        if (!fresh) return true;

        /* Drop the marker so the home screen treats this as a new run. */
        try { sessionStorage.removeItem(RUN_KEY); } catch (e) {}
        location.replace(ENTRY);
        return false;
    }

    if (!guardEntry()) return;

    window.prototypeMode = {
        /* Linking is forced only where the money has to be locked behind
           it (sending more than 7,000 Br to a bank), so the flow that
           raises that prompt applies the mandate itself. */
        forceMandatory: function (modal) {
            if (!modal) return;
            var close = modal.querySelector('.modal-close');
            var skip = modal.querySelector('.modal-btn.secondary');
            if (close) close.remove();
            if (skip) skip.remove();
        }
    };

    /* ---------------------------------------------------------- styles */
    function injectStyles() {
        var css = [
            /* ----- sidebar ----- */
            '.proto-rail {',
            '    position: fixed;',
            '    top: 0;',
            '    left: 0;',
            '    bottom: 0;',
            '    width: 196px;',
            '    background: #097E46;',
            '    padding: 22px 0 22px 0;',
            '    font-family: Barlow, sans-serif;',
            '    z-index: 2000;',
            '    overflow-y: auto;',
            '}',
            '.proto-home {',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 10px;',
            '    padding: 9px 16px;',
            '    margin-bottom: 16px;',
            '    text-decoration: none;',
            '    border-left: 3px solid transparent;',
            '    color: rgba(255,255,255,0.85);',
            '    font-size: 12.5px;',
            '    font-weight: 700;',
            '    letter-spacing: 0.8px;',
            '}',
            '.proto-home:hover { background: rgba(255,255,255,0.08); color: #ffffff; }',
            '.proto-home svg {',
            '    width: 17px;',
            '    height: 17px;',
            '    fill: currentColor;',
            '    flex-shrink: 0;',
            '    display: block;',
            '}',
            '.proto-rail h4 {',
            '    font-size: 10px;',
            '    font-weight: 700;',
            '    letter-spacing: 1.4px;',
            '    color: rgba(255,255,255,0.55);',
            '    margin: 0 0 12px 16px;',
            '}',
            /* Keep the phone centred in the space that is left over. */
            '@media (min-width: 720px) { body { padding-left: 196px; } }',
            '@media (max-width: 719px) { .proto-rail { display: none; } }',

            /* ----- export ----- */
            '.proto-export {',
            '    position: fixed;',
            '    top: 16px;',
            '    right: 16px;',
            '    display: flex;',
            '    gap: 8px;',
            '    font-family: Barlow, sans-serif;',
            '    z-index: 2000;',
            '}',
            '.proto-export button {',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 7px;',
            '    padding: 9px 14px;',
            '    border: 1px solid #DDE3E0;',
            '    border-radius: 8px;',
            '    background: #ffffff;',
            '    color: #12492C;',
            '    font: inherit;',
            '    font-size: 12px;',
            '    font-weight: 700;',
            '    letter-spacing: 0.8px;',
            '    cursor: pointer;',
            '    box-shadow: 0 2px 6px rgba(0,0,0,0.06);',
            '}',
            '.proto-export button:hover { background: #F2FAF5; border-color: #2FC56D; }',
            '.proto-export button:disabled { opacity: 0.55; cursor: progress; }',
            '.proto-export svg {',
            '    width: 15px;',
            '    height: 15px;',
            '    stroke: currentColor;',
            '    stroke-width: 2;',
            '    fill: none;',
            '    stroke-linecap: round;',
            '    stroke-linejoin: round;',
            '    display: block;',
            '}',
            '@media (max-width: 719px) { .proto-export { display: none; } }',

            /* ----- the phone's own navigation ----- */
            /* Back/home/recents is device chrome, not app surface. No
               overlay may dim or cover it: someone always has to be able
               to leave. Sits above every overlay in the prototype, the
               highest of which is 40. */
            '.system-nav {',
            '    position: sticky;',
            '    bottom: 0;',
            '    z-index: 50;',
            '}',

            /* ----- full-screen prompt ----- */
            '#faydaModal.fayda-screen {',
            '    background: #ffffff;',
            '    padding: 0;',
            '    align-items: stretch;',
            '    justify-content: stretch;',
            '    padding-bottom: 48px; /* leaves the phone nav showing */',
            '}',
            '#faydaModal.fayda-screen .modal-card {',
            '    width: 100%;',
            '    height: 100%;',
            '    border-radius: 0;',
            '    box-shadow: none;',
            '    transform: none;',
            '    overflow: hidden;',
            '    padding: 54px 24px 20px 24px;',
            '    display: flex;',
            '    flex-direction: column;',
            '    align-items: center;',
            '}',
            '#faydaModal.fayda-screen .modal-card > * { position: relative; z-index: 1; }',
            '#faydaModal.fayda-screen .modal-close {',
            '    position: absolute;',
            '    top: 14px;',
            '    left: 12px;',
            '    right: auto;',
            '    z-index: 2;',
            '}',
            '#faydaModal.fayda-screen .modal-close svg { stroke: #1a1a1a; stroke-width: 2.4; width: 24px; height: 24px; }',
            '#faydaModal.fayda-screen h2 {',
            '    order: 1;',
            '    margin: 0;',
            /* 280px clears the 222px title, so it stays on one line */
            '    max-width: 280px;',
            '    font-size: 24px;',
            '    font-weight: 300;',
            '    color: #2f2f2f;',
            '    letter-spacing: 0.6px;',
            '    line-height: 1.25;',
            '}',
            '#faydaModal.fayda-screen .fayda-cta {',
            '    order: 3;',
            '    margin: 22px 0 0 0;',
            '    max-width: 270px;',
            '    font-size: 13px;',
            '    font-weight: 600;',
            '    text-transform: uppercase;',
            '    color: #8d9691;',
            '    letter-spacing: 0.7px;',
            '    line-height: 1.4;',
            '}',
            /* ----- the two marks ----- */
            '#faydaModal.fayda-screen .fayda-bridge {',
            '    order: 2;',
            '    display: flex;',
            '    align-items: center;',
            '    width: 100%;',
            '    max-width: 296px;',
            '    margin-top: 30px;',
            '    padding: 16px 18px;',
            '    background: #ffffff;',
            '    border: 1px solid #EDEFF0;',
            '    border-radius: 18px;',
            '    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.07);',
            '}',
            /* each mark sits in its own green ring */
            '#faydaModal.fayda-screen .fayda-bridge .node {',
            '    width: 64px;',
            '    height: 64px;',
            '    flex-shrink: 0;',
            '    border-radius: 50%;',
            '    border: 3px solid #2FC56D;',
            '    background: #ffffff;',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '    overflow: hidden;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .node.brand img { width: 40px; display: block; }',
            '#faydaModal.fayda-screen .modal-card img.fayda {',
            '    width: 58px;',
            '    height: 58px;',
            '    margin: 0;',
            '}',
            /* dashed run with the exchange badge riding on it */
            '#faydaModal.fayda-screen .fayda-bridge .link {',
            '    flex-grow: 1;',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 5px;',
            '    padding: 0 8px;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .dots {',
            '    flex-grow: 1;',
            '    border-top: 2px dashed #D9DDDF;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .swap {',
            '    width: 30px;',
            '    height: 30px;',
            '    flex-shrink: 0;',
            '    border-radius: 50%;',
            '    background: #ffffff;',
            '    border: 1px solid #ECEFF0;',
            '    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .swap svg {',
            '    width: 16px;',
            '    height: 16px;',
            '    stroke: #2FC56D;',
            '    stroke-width: 2;',
            '    fill: none;',
            '    stroke-linecap: round;',
            '    stroke-linejoin: round;',
            '    display: block;',
            '}',
            /* ----- what linking gets you ----- */
            '#faydaModal.fayda-screen .fayda-benefits {',
            '    order: 4;',
            '    width: 100%;',
            '    max-width: 300px;',
            '    margin-top: 26px;',
            '    padding: 0 16px;',
            '    background: #FAFBFC;',
            '    border-radius: 16px;',
            '    text-align: left;',
            '}',
            '#faydaModal.fayda-screen .fayda-benefit {',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 14px;',
            '    padding: 15px 0;',
            '}',
            '#faydaModal.fayda-screen .fayda-benefit + .fayda-benefit { border-top: 1px solid #EDEFF1; }',
            '#faydaModal.fayda-screen .fayda-benefit .ic {',
            '    width: 44px;',
            '    height: 44px;',
            '    flex-shrink: 0;',
            '    border-radius: 50%;',
            '    background: #DEEFE5;',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '}',
            '#faydaModal.fayda-screen .fayda-benefit .ic svg { width: 21px; height: 21px; display: block; }',
            '#faydaModal.fayda-screen .fayda-benefit .t {',
            '    font-size: 13px;',
            '    font-weight: 700;',
            '    text-transform: uppercase;',
            '    color: #12492C;',
            '    letter-spacing: 0.6px;',
            '    line-height: 1.32;',
            '}',
            '#faydaModal.fayda-screen p:not(.fayda-cta) {',
            '    order: 5;',
            '    margin: auto 0 0 0;',
            '    max-width: 290px;',
            '    font-size: 13px;',
            '    font-weight: 400;',
            '    color: #9aa19d;',
            '    line-height: 1.5;',
            '}',
            '#faydaModal.fayda-screen .modal-btn.primary {',
            '    order: 6;',
            '    width: 100%;',
            '    position: relative;',
            '    margin: 14px 0 0 0;',
            '    padding: 17px 0;',
            '    font-size: 14.5px;',
            '    background: #2FC56D;',
            '}',
            '#faydaModal.fayda-screen .modal-btn.secondary { display: none; }',
            '#faydaModal.fayda-screen .modal-btn.primary .arrow {',
            '    position: absolute;',
            '    right: 26px;',
            '    top: 50%;',
            '    transform: translateY(-50%);',
            '    display: flex;',
            '}',
            '#faydaModal.fayda-screen .modal-btn.primary .arrow svg {',
            '    width: 19px;',
            '    height: 19px;',
            '    stroke: #ffffff;',
            '    stroke-width: 2.4;',
            '    fill: none;',
            '    stroke-linecap: round;',
            '    stroke-linejoin: round;',
            '}'
        ].join('\n');

        var el = document.createElement('style');
        el.textContent = css;
        document.head.appendChild(el);
    }

    /* ---------------------------------------------------------- sidebar */
    function injectRail() {
        var rail = document.createElement('nav');
        rail.className = 'proto-rail';

        /* Quick navigation between the prototype's screens. */
        rail.innerHTML = '<a class="proto-home" href="index.html">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M3.4 10.4 12 3.6l8.6 6.8V20a1 1 0 0 1-1 1h-5v-6h-5.2v6h-5a1 1 0 0 1-1-1v-9.6Z"/>'
            + '</svg><span>HOME</span></a>'
            + '<h4>FLOWS</h4>'
            + '<a class="proto-home" href="Home Screen.html?withdraw=1">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M4 6.5h16a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 17.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z"/>'
            + '<circle cx="12" cy="12" r="2.4"/>'
            + '<path d="M5.5 9.2h.01M18.5 14.8h.01"/>'
            + '</svg><span>WITHDRAW TO BANK</span></a>'
            + '<a class="proto-home" href="Send to Bank.html">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M3.5 9.6 12 4.4l8.5 5.2v1.7H3.5V9.6Z"/>'
            + '<path d="M5.6 12h12.8V19H5.6z"/>'
            + '<path d="M9 19v-4h6v4"/>'
            + '</svg><span>SEND TO BANK</span></a>'
            + '<a class="proto-home" href="Buy Packages.html">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M12 3.4 20 7.4v9.2l-8 4-8-4V7.4l8-4Z"/>'
            + '<path d="M4 7.6l8 4 8-4M12 11.6v8.8"/>'
            + '</svg><span>BUY PACKAGE</span></a>'
            + '<a class="proto-home" href="Mini Apps.html">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<rect x="2.9" y="3.1" width="7.6" height="7.6" rx="1.5"/>'
            + '<path d="M17.3 2.9 21.2 10.7h-7.8l3.9-7.8Z"/>'
            + '<circle cx="6.7" cy="17.5" r="3.8"/><circle cx="17.3" cy="17.5" r="3.8"/>'
            + '</svg><span>MINI APPS</span></a>'
            + '<a class="proto-home" href="Savings.html?tab=fixed">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<rect x="5" y="10.5" width="14" height="10" rx="2"/>'
            + '<path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7h-2V7.8a1.5 1.5 0 0 0-3 0v2.7Z"/>'
            + '</svg><span>FIXED DEPOSIT</span></a>';

        document.body.appendChild(rail);
    }

    /* ----------------------------------------------------------- export */
    /* Saves the phone frame as it stands: a PNG for decks and reviews,
       and a node tree shaped like Figma's plugin API (frames, text, SVG
       and image nodes with absolute sizes and 0-1 colours) so a plugin
       can rebuild the screen as editable layers. */
    var HTML_TO_IMAGE = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';
    var EXPORT_SCALE = 3;

    function phoneFrame() {
        return document.querySelector('.mobile-container');
    }

    function exportName() {
        var page = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
        return page.replace(/\.html$/i, '').replace(/\s+/g, '-').toLowerCase() || 'screen';
    }

    function saveBlob(blob, filename) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    var libLoading = null;
    function loadHtmlToImage() {
        if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
        if (libLoading) return libLoading;
        libLoading = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = HTML_TO_IMAGE;
            s.onload = function () { resolve(window.htmlToImage); };
            s.onerror = function () { libLoading = null; reject(new Error('Could not load html-to-image')); };
            document.head.appendChild(s);
        });
        return libLoading;
    }

    /* The Google Fonts sheet is cross-origin, so its rules can't be read
       off the page; fetch it and inline the font files instead. */
    var fontCss = null;
    function embeddedFontCss() {
        if (fontCss) return fontCss;
        var link = document.querySelector('link[href*="fonts.googleapis.com/css"]');
        if (!link) return (fontCss = Promise.resolve(''));
        fontCss = fetch(link.href).then(function (r) { return r.text(); }).then(function (css) {
            var urls = css.match(/url\([^)]+\)/g) || [];
            return Promise.all(urls.map(function (u) {
                var src = u.slice(4, -1).replace(/['"]/g, '');
                return fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
                    return new Promise(function (done) {
                        var fr = new FileReader();
                        fr.onload = function () { css = css.split(src).join(fr.result); done(); };
                        fr.readAsDataURL(b);
                    });
                });
            })).then(function () { return css; });
        }).catch(function () { return ''; });
        return fontCss;
    }

    function downloadPng(btn) {
        var frame = phoneFrame();
        if (!frame) return;
        btn.disabled = true;
        Promise.all([loadHtmlToImage(), embeddedFontCss()]).then(function (r) {
            return r[0].toBlob(frame, {
                pixelRatio: EXPORT_SCALE,
                fontEmbedCSS: r[1],
                backgroundColor: '#ffffff'
            });
        }).then(function (blob) {
            saveBlob(blob, exportName() + '.png');
        }).catch(function (e) {
            console.error(e);
            alert('PNG export failed: ' + e.message);
        }).then(function () { btn.disabled = false; });
    }

    /* ---- Figma node tree ---- */
    function parseColor(str) {
        var m = str && str.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
        var a = p.length > 3 ? p[3] : 1;
        if (a === 0) return null;
        return { r: p[0] / 255, g: p[1] / 255, b: p[2] / 255, a: a };
    }

    function solid(c) {
        return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
    }

    function round(n) { return Math.round(n * 100) / 100; }

    function isVisible(el, cs) {
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function box(rect, origin) {
        return {
            x: round(rect.left - origin.left),
            y: round(rect.top - origin.top),
            width: round(rect.width),
            height: round(rect.height)
        };
    }

    function intersects(rect, clip) {
        return rect.right > clip.left && rect.left < clip.right
            && rect.bottom > clip.top && rect.top < clip.bottom;
    }

    function textNode(textEl, parentCs, origin) {
        var text = textEl.textContent.replace(/\s+/g, ' ');
        if (!text.trim()) return null;
        var range = document.createRange();
        range.selectNodeContents(textEl);
        var rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        var color = parseColor(parentCs.color);
        var weight = parseInt(parentCs.fontWeight, 10) || 400;
        var t = parentCs.textTransform;
        if (t === 'uppercase') text = text.toUpperCase();
        else if (t === 'lowercase') text = text.toLowerCase();
        var node = box(rect, origin);
        node.type = 'TEXT';
        node.name = text.trim().slice(0, 40);
        node.characters = text.trim();
        node.fontName = {
            family: parentCs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
            weight: weight,
            style: parentCs.fontStyle === 'italic' ? 'Italic' : 'Regular'
        };
        node.fontSize = parseFloat(parentCs.fontSize);
        var ls = parseFloat(parentCs.letterSpacing);
        if (ls) node.letterSpacing = { value: ls, unit: 'PIXELS' };
        var lh = parseFloat(parentCs.lineHeight);
        if (lh) node.lineHeight = { value: lh, unit: 'PIXELS' };
        node.textAlignHorizontal = { center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' }[parentCs.textAlign] || 'LEFT';
        node.fills = color ? [solid(color)] : [];
        return node;
    }

    function elementNode(el, origin, clip) {
        var cs = getComputedStyle(el);
        if (!isVisible(el, cs)) return null;
        var rect = el.getBoundingClientRect();
        if (!intersects(rect, clip)) return null;

        var node = box(rect, origin);
        node.name = el.getAttribute('aria-label') || el.id
            || (typeof el.className === 'string' && el.className.split(' ')[0]) || el.tagName.toLowerCase();
        var opacity = parseFloat(cs.opacity);
        if (opacity < 1) node.opacity = opacity;

        if (el.tagName.toLowerCase() === 'svg') {
            node.type = 'SVG';
            /* Bake currentColor so the markup stands on its own. */
            node.svg = el.outerHTML.replace(/currentColor/g, cs.color);
            return node;
        }

        if (el.tagName === 'IMG') {
            node.type = 'RECTANGLE';
            node.fills = [{ type: 'IMAGE', scaleMode: cs.objectFit === 'contain' ? 'FIT' : 'FILL', src: el.currentSrc || el.src }];
            node.cornerRadius = parseFloat(cs.borderTopLeftRadius) || 0;
            return node;
        }

        node.type = 'FRAME';
        node.fills = [];
        var bg = parseColor(cs.backgroundColor);
        if (bg) node.fills.push(solid(bg));
        var bgImage = cs.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (bgImage) node.fills.push({ type: 'IMAGE', scaleMode: 'FILL', src: bgImage[1] });
        if (cs.backgroundImage.indexOf('gradient') !== -1) node.cssBackground = cs.backgroundImage;

        var radii = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(function (k) {
            return parseFloat(cs['border' + k + 'Radius']) || 0;
        });
        if (radii[0] === radii[1] && radii[1] === radii[2] && radii[2] === radii[3]) {
            if (radii[0]) node.cornerRadius = Math.min(radii[0], node.width / 2, node.height / 2);
        } else {
            node.topLeftRadius = radii[0];
            node.topRightRadius = radii[1];
            node.bottomRightRadius = radii[2];
            node.bottomLeftRadius = radii[3];
        }

        var bw = parseFloat(cs.borderTopWidth);
        var bc = parseColor(cs.borderTopColor);
        if (bw && bc && cs.borderTopStyle !== 'none') {
            node.strokes = [solid(bc)];
            node.strokeWeight = bw;
            node.strokeAlign = 'INSIDE';
            if (cs.borderTopStyle === 'dashed') node.dashPattern = [bw * 3, bw * 2];
        }

        if (cs.boxShadow && cs.boxShadow !== 'none') node.cssBoxShadow = cs.boxShadow;
        node.clipsContent = cs.overflow !== 'visible';

        /* Children are clipped to this box when it clips. */
        var childClip = node.clipsContent ? {
            left: Math.max(clip.left, rect.left), top: Math.max(clip.top, rect.top),
            right: Math.min(clip.right, rect.right), bottom: Math.min(clip.bottom, rect.bottom)
        } : clip;

        node.children = [];
        Array.prototype.forEach.call(el.childNodes, function (child) {
            var c = null;
            if (child.nodeType === 3) c = textNode(child, cs, rect);
            else if (child.nodeType === 1) c = elementNode(child, rect, childClip);
            if (c) node.children.push(c);
        });

        return node;
    }

    function downloadFigmaJson() {
        var frame = phoneFrame();
        if (!frame) return;
        var rect = frame.getBoundingClientRect();
        var root = elementNode(frame, rect, rect);
        root.x = 0;
        root.y = 0;
        root.name = document.title || exportName();
        var doc = {
            format: 'figma-node-tree',
            version: 1,
            source: location.href,
            exportedAt: new Date().toISOString(),
            note: 'Node properties follow the Figma Plugin API. Child x/y are relative to their parent. '
                + 'SVG nodes map to figma.createNodeFromSvg; IMAGE fills carry a src URL to fetch.',
            document: root
        };
        saveBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }),
            exportName() + '.figma.json');
    }

    function injectExport() {
        if (!phoneFrame()) return;
        var bar = document.createElement('div');
        bar.className = 'proto-export';
        bar.innerHTML = '<button type="button" data-export="png">'
            + '<svg viewBox="0 0 24 24"><path d="M12 4v11"/><path d="m7 10.5 5 5 5-5"/><path d="M4.5 19.5h15"/></svg>'
            + '<span>DOWNLOAD PNG</span></button>'
            + '<button type="button" data-export="figma">'
            + '<svg viewBox="0 0 24 24"><path d="M9 3.5h3v6H9a3 3 0 0 1 0-6Z"/><path d="M12 3.5h3a3 3 0 0 1 0 6h-3Z"/>'
            + '<path d="M9 9.5h3v6H9a3 3 0 0 1 0-6Z"/><circle cx="15" cy="12.5" r="3"/>'
            + '<path d="M9 15.5h3v3a3 3 0 1 1-3-3Z"/></svg>'
            + '<span>FIGMA JSON</span></button>';
        bar.querySelector('[data-export="png"]').addEventListener('click', function () { downloadPng(this); });
        bar.querySelector('[data-export="figma"]').addEventListener('click', downloadFigmaJson);
        document.body.appendChild(bar);
    }

    /* ------------------------------------------------------- prompt */

    function applyScreenStyle(modal) {
        var card = modal.querySelector('.modal-card');
        var fayda = card && card.querySelector('img.fayda');
        if (!card || !fayda) return;

        /* Each mark on its own tile, chained together. */
        var bridge = document.createElement('div');
        bridge.className = 'fayda-bridge';
        bridge.innerHTML = '<span class="node" id="faydaNode"></span>'
            + '<span class="link">'
            + '<span class="dots"></span>'
            + '<span class="swap"><svg viewBox="0 0 24 24">'
            + '<path d="M4.2 9.2h13"/><path d="m13.6 5.6 3.8 3.6-3.8 3.6"/>'
            + '<path d="M19.8 14.8h-13"/><path d="m10.4 11.2-3.8 3.6 3.8 3.6"/>'
            + '</svg></span>'
            + '<span class="dots"></span>'
            + '</span>'
            + '<span class="node brand"><img src="assets/M-PESA-Logo-Green.svg" alt="M-PESA"></span>';
        card.insertBefore(bridge, fayda);
        bridge.querySelector('#faydaNode').appendChild(fayda);

        /* Replaces the markup's standing paragraph with what linking buys. */
        var BENEFITS = [
            ['SECURE IDENTITY VERIFICATION',
             '<path d="M12 2.6 20 5.6v6c0 4.6-3.2 8.3-8 9.8-4.8-1.5-8-5.2-8-9.8v-6l8-3Z" fill="#2FC56D"/>'
             + '<path d="m8.3 12.2 2.6 2.6 4.9-5" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
            ['FASTER ACCOUNT SERVICES',
             '<path d="M13.6 2.2 4.8 13.1c-.4.5-.05 1.2.58 1.2H10l-1.5 8.5 8.8-10.9c.4-.5.05-1.2-.58-1.2H12l1.6-8.5Z" fill="#2FC56D"/>'],
            ['SEAMLESS M-PESA EXPERIENCE',
             '<g stroke="#2FC56D" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">'
             + '<path d="M10.1 13.6a3.7 3.7 0 0 0 5.4.3l2.6-2.6a3.7 3.7 0 1 0-5.3-5.2l-1.5 1.5"/>'
             + '<path d="M13.9 10.4a3.7 3.7 0 0 0-5.4-.3l-2.6 2.6a3.7 3.7 0 1 0 5.3 5.2l1.5-1.5"/>'
             + '</g>']
        ];

        var benefits = document.createElement('div');
        benefits.className = 'fayda-benefits';
        benefits.innerHTML = BENEFITS.map(function (b) {
            return '<div class="fayda-benefit">'
                + '<span class="ic"><svg viewBox="0 0 24 24">' + b[1] + '</svg></span>'
                + '<span class="t">' + b[0] + '</span>'
                + '</div>';
        }).join('');
        bridge.insertAdjacentElement('afterend', benefits);

        /* Why the prompt appeared, kept under the title. */
        var reason = document.body.dataset.linkReason;
        if (reason) {
            var cta = document.createElement('p');
            cta.className = 'fayda-cta';
            cta.textContent = reason + ', link your Fayda ID';
            card.appendChild(cta);
        }

        var go = card.querySelector('.modal-btn.primary');
        if (go && !go.querySelector('.arrow')) {
            go.insertAdjacentHTML('beforeend',
                '<span class="arrow"><svg viewBox="0 0 24 24"><path d="M4 12h15"/><path d="m13.5 6.5 6 5.5-6 5.5"/></svg></span>');
        }

        modal.classList.add('fayda-screen');
        pinToViewport(modal);
    }

    /* The home screen's frame scrolls, so a full-bleed panel has to be
       pinned to what is actually on screen when it opens. */
    function pinToViewport(modal) {
        var frame = document.querySelector('.mobile-container');
        if (!frame) return;

        var statusBar = document.querySelector('.status-bar');

        function place() {
            if (!modal.classList.contains('show')) return;
            /* Sit below the phone's status bar while it is on screen;
               once it has scrolled away, take the full visible area. */
            var offset = 0;
            if (statusBar) {
                var bar = statusBar.getBoundingClientRect();
                var box = frame.getBoundingClientRect();
                offset = Math.max(0, Math.min(bar.bottom - box.top, bar.height));
            }
            modal.style.top = (frame.scrollTop + offset) + 'px';
            modal.style.bottom = 'auto';
            modal.style.height = (frame.clientHeight - offset) + 'px';
        }

        new MutationObserver(place).observe(modal, {
            attributes: true,
            attributeFilter: ['class']
        });
        place();
    }

    function init() {
        injectStyles();
        injectRail();
        injectExport();

        var modal = document.getElementById('faydaModal');
        if (!modal) return;

        /* A screen can opt out and keep the card it has in its markup. */
        if (document.body.dataset.prompt === 'popup') return;

        applyScreenStyle(modal);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
