/* ------------------------------------------------------------------
   Prototype variant switcher.

   Two independent choices, both driven from the sidebar and both kept
   in localStorage so they survive reloads and carry across screens:

     activation  optional  - the link prompt can be dismissed
                 mandatory - no SKIP, no close; CONTINUE is the only move
                             (screens marked data-activation="always-optional"
                              opt out, e.g. buying a package)

     prompt      popup     - the centred card
                 screen    - a full-bleed screen with the M-PESA and Fayda
                             marks bridged together

   The screen variant is applied by restyling the existing #faydaModal
   rather than replacing it, so each page's own openFayda()/closeFayda()
   keep working untouched.
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

    var MODE_KEY = 'faydaMode';
    var STYLE_KEY = 'faydaPrompt';

    var MODES = [
        { id: 'optional',  label: 'OPTIONAL',  hint: 'Prompt can be skipped' },
        { id: 'mandatory', label: 'MANDATORY', hint: 'Send to bank & withdraw' }
    ];

    function read(key, allowed, fallback) {
        try {
            var v = localStorage.getItem(key);
            return allowed.indexOf(v) === -1 ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    /* Without a destination this just reloads in place, which is what the
       prompt-style toggle wants: you stay where you are and watch the
       prompt change. Switching activation restarts the demo at the home
       screen instead, and clears the run's state so the prompt actually
       appears rather than being skipped by an earlier activation. */
    function write(key, value, destination) {
        try { localStorage.setItem(key, value); } catch (e) {}

        if (!destination) {
            window.location.reload();
            return;
        }

        try {
            sessionStorage.removeItem('faydaActivated');
            sessionStorage.removeItem('pendingWithdraw');
            sessionStorage.removeItem('pendingPurchase');
        } catch (e) {}
        window.location.href = destination;
    }

    function currentMode() {
        return read(MODE_KEY, ['optional', 'mandatory'], 'optional');
    }

    function currentStyle() {
        return read(STYLE_KEY, ['popup', 'screen'], 'popup');
    }

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
            '.proto-rail h4 {',
            '    font-size: 10px;',
            '    font-weight: 700;',
            '    letter-spacing: 1.4px;',
            '    color: rgba(255,255,255,0.55);',
            '    margin: 0 0 12px 16px;',
            '}',
            '.proto-rail h4.later { margin-top: 26px; }',
            '.proto-tab {',
            '    display: block;',
            '    width: 100%;',
            '    text-align: left;',
            '    background: none;',
            '    border: none;',
            '    border-left: 3px solid transparent;',
            '    cursor: pointer;',
            '    font-family: Barlow, sans-serif;',
            '    padding: 10px 14px;',
            '}',
            '.proto-tab:hover { background: rgba(255,255,255,0.08); }',
            '.proto-tab .t {',
            '    display: block;',
            '    font-size: 12.5px;',
            '    font-weight: 700;',
            '    letter-spacing: 0.8px;',
            '    color: rgba(255,255,255,0.78);',
            '}',
            '.proto-tab .h {',
            '    display: block;',
            '    font-size: 10.5px;',
            '    font-weight: 500;',
            '    color: rgba(255,255,255,0.5);',
            '    margin-top: 2px;',
            '}',
            '.proto-tab.on { background: rgba(255,255,255,0.14); border-left-color: #ffffff; }',
            '.proto-tab.on .t { color: #ffffff; }',
            '.proto-tab.on .h { color: rgba(255,255,255,0.8); }',
            /* ----- toggle ----- */
            '.proto-switch {',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: space-between;',
            '    gap: 10px;',
            '    width: 100%;',
            '    background: none;',
            '    border: none;',
            '    cursor: pointer;',
            '    font-family: Barlow, sans-serif;',
            '    padding: 10px 16px;',
            '}',
            '.proto-switch:hover { background: rgba(255,255,255,0.08); }',
            '.proto-switch .t {',
            '    font-size: 12.5px;',
            '    font-weight: 700;',
            '    letter-spacing: 0.8px;',
            '    color: rgba(255,255,255,0.78);',
            '    text-align: left;',
            '}',
            '.proto-switch.on .t { color: #ffffff; }',
            '.proto-switch .sw {',
            '    width: 36px;',
            '    height: 20px;',
            '    border-radius: 10px;',
            '    background: rgba(0,0,0,0.28);',
            '    flex-shrink: 0;',
            '    position: relative;',
            '    transition: background-color 0.18s ease;',
            '}',
            '.proto-switch .sw::after {',
            '    content: "";',
            '    position: absolute;',
            '    top: 3px;',
            '    left: 3px;',
            '    width: 14px;',
            '    height: 14px;',
            '    border-radius: 50%;',
            '    background: #ffffff;',
            '    transition: transform 0.18s ease;',
            '}',
            '.proto-switch.on .sw { background: #0A5B34; }',
            '.proto-switch.on .sw::after { transform: translateX(16px); }',
            '.proto-hint {',
            '    font-size: 10.5px;',
            '    font-weight: 500;',
            '    color: rgba(255,255,255,0.5);',
            '    padding: 0 16px;',
            '    line-height: 1.4;',
            '}',
            /* Keep the phone centred in the space that is left over. */
            '@media (min-width: 720px) { body { padding-left: 196px; } }',
            '@media (max-width: 719px) { .proto-rail { display: none; } }',

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
            '    padding: 54px 26px 24px 26px;',
            '    display: flex;',
            '    flex-direction: column;',
            '    align-items: center;',
            '}',
            '#faydaModal.fayda-screen .modal-close {',
            '    top: 14px;',
            '    left: 12px;',
            '    right: auto;',
            '}',
            '#faydaModal.fayda-screen .modal-close svg { stroke: #4a4a4a; stroke-width: 2; }',
            '#faydaModal.fayda-screen h2 {',
            '    order: 1;',
            '    margin: 0 0 auto 0;',
            '    font-size: 21px;',
            '    font-weight: 400;',
            '    color: #2f2f2f;',
            '    letter-spacing: 0.6px;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge {',
            '    order: 2;',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 14px;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .brand {',
            '    border: 1.5px solid #2BB24B;',
            '    border-radius: 8px;',
            '    background: #ffffff;',
            '    padding: 13px 16px;',
            '    display: flex;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .brand img { width: 94px; display: block; }',
            '#faydaModal.fayda-screen .fayda-bridge .link svg {',
            '    width: 19px;',
            '    height: 19px;',
            '    stroke: #2BB24B;',
            '    stroke-width: 2;',
            '    fill: none;',
            '    stroke-linecap: round;',
            '    stroke-linejoin: round;',
            '    display: block;',
            '}',
            '#faydaModal.fayda-screen .modal-card img.fayda {',
            '    width: 62px;',
            '    height: 62px;',
            '    margin: 0;',
            '}',
            '#faydaModal.fayda-screen p {',
            '    order: 3;',
            '    margin: auto 0 18px 0;',
            '    font-size: 13px;',
            '    color: #7a7a7a;',
            '    line-height: 1.5;',
            '}',
            '#faydaModal.fayda-screen .modal-btn.primary {',
            '    order: 4;',
            '    width: 100%;',
            '    position: relative;',
            '    margin: 0;',
            '}',
            '#faydaModal.fayda-screen .modal-btn.secondary { display: none; }',
            '#faydaModal.fayda-screen .modal-btn.primary .arrow {',
            '    position: absolute;',
            '    right: 22px;',
            '    top: 50%;',
            '    transform: translateY(-50%);',
            '    display: flex;',
            '}',
            '#faydaModal.fayda-screen .modal-btn.primary .arrow svg {',
            '    width: 18px;',
            '    height: 18px;',
            '    stroke: #ffffff;',
            '    stroke-width: 2.2;',
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
    function injectRail(mode, style) {
        var rail = document.createElement('nav');
        rail.className = 'proto-rail';

        rail.innerHTML = '<h4>FAYDA ACTIVATION</h4>'
            + MODES.map(function (m) {
                return '<button class="proto-tab' + (m.id === mode ? ' on' : '') + '" data-mode="' + m.id + '">'
                    + '<span class="t">' + m.label + '</span>'
                    + '<span class="h">' + m.hint + '</span>'
                    + '</button>';
            }).join('')
            + '<h4 class="later">PROMPT STYLE</h4>'
            + '<button class="proto-switch' + (style === 'screen' ? ' on' : '') + '" id="protoStyle">'
            + '<span class="t">FULL SCREEN</span><span class="sw"></span>'
            + '</button>'
            + '<p class="proto-hint">' + (style === 'screen' ? 'Full-bleed screen' : 'Centred popup card') + '</p>';

        rail.addEventListener('click', function (ev) {
            var tab = ev.target.closest('.proto-tab');
            if (tab) {
                if (tab.dataset.mode !== mode) write(MODE_KEY, tab.dataset.mode, 'Home Screen.html');
                return;
            }
            if (ev.target.closest('#protoStyle')) {
                write(STYLE_KEY, style === 'screen' ? 'popup' : 'screen');
            }
        });

        document.body.appendChild(rail);
    }

    /* ------------------------------------------------------- variants */
    function applyMode(modal, mode) {
        if (mode !== 'mandatory') return;
        if (document.body.dataset.activation === 'always-optional') return;

        var close = modal.querySelector('.modal-close');
        var skip = modal.querySelector('.modal-btn.secondary');
        if (close) close.remove();
        if (skip) skip.remove();
    }

    function applyScreenStyle(modal) {
        var card = modal.querySelector('.modal-card');
        var fayda = card && card.querySelector('img.fayda');
        if (!card || !fayda) return;

        /* Bridge the two marks: M-PESA card, connector, Fayda seal. */
        var bridge = document.createElement('div');
        bridge.className = 'fayda-bridge';
        bridge.innerHTML = '<span class="brand"><img src="assets/M-PESA-Logo-Green.svg" alt="M-PESA"></span>'
            + '<span class="link"><svg viewBox="0 0 24 24">'
            + '<path d="M9.5 7 5 12l4.5 5"/><path d="M14.5 7 19 12l-4.5 5"/>'
            + '</svg></span>';
        card.insertBefore(bridge, fayda);
        bridge.appendChild(fayda);

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
        var mode = currentMode();
        var style = currentStyle();

        injectStyles();
        injectRail(mode, style);

        var modal = document.getElementById('faydaModal');
        if (!modal) return;

        applyMode(modal, mode);
        if (style === 'screen') applyScreenStyle(modal);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
