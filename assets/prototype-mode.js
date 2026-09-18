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
    var GATE_KEY = 'withdrawGate';

    var MODES = [
        { id: 'optional',  label: 'OPTIONAL',  hint: 'Prompt can be skipped' },
        { id: 'mandatory', label: 'MANDATORY', hint: 'Send to bank & withdraw' }
    ];

    /* Where the linking prompt sits in the withdraw flow. */
    var GATES = [
        { id: 'before', label: 'GATE FIRST',    hint: 'Fayda, then options' },
        { id: 'after',  label: 'OPTIONS FIRST', hint: 'Options, then Fayda' }
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

    function currentGate() {
        return read(GATE_KEY, ['before', 'after'], 'before');
    }

    window.prototypeMode = {
        activation: currentMode(),
        prompt: currentStyle(),
        withdrawGate: currentGate()
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
            '    overflow: hidden;',
            '    padding: 54px 24px 20px 24px;',
            '    display: flex;',
            '    flex-direction: column;',
            '    align-items: center;',
            '}',
            /* soft mint blobs bleeding off two corners */
            '#faydaModal.fayda-screen .modal-card::before,',
            '#faydaModal.fayda-screen .modal-card::after {',
            '    content: "";',
            '    position: absolute;',
            '    border-radius: 50%;',
            '    background: #EAF7EF;',
            '    z-index: 0;',
            '}',
            '#faydaModal.fayda-screen .modal-card::before {',
            '    top: -120px;',
            '    right: -90px;',
            '    width: 300px;',
            '    height: 300px;',
            '}',
            '#faydaModal.fayda-screen .modal-card::after {',
            '    bottom: -110px;',
            '    left: -90px;',
            '    width: 230px;',
            '    height: 230px;',
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
            '    max-width: 215px;',
            '    font-size: 32px;',
            '    font-weight: 700;',
            '    color: #111111;',
            '    letter-spacing: 0.4px;',
            '    line-height: 1.14;',
            '}',
            '#faydaModal.fayda-screen .fayda-cta {',
            '    order: 2;',
            '    margin: 12px 0 0 0;',
            '    max-width: 280px;',
            '    font-size: 12.5px;',
            '    font-weight: 600;',
            '    text-transform: uppercase;',
            '    color: #5c6b62;',
            '    letter-spacing: 0.8px;',
            '    line-height: 1.4;',
            '}',
            /* ----- the two marks ----- */
            '#faydaModal.fayda-screen .fayda-bridge {',
            '    order: 3;',
            '    display: flex;',
            '    align-items: center;',
            '    width: 100%;',
            '    max-width: 300px;',
            '    margin-top: 34px;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .node {',
            '    width: 88px;',
            '    height: 88px;',
            '    flex-shrink: 0;',
            '    border-radius: 20px;',
            '    background: #ffffff;',
            '    border: 1px solid #EDF4EF;',
            '    box-shadow: 0 5px 16px rgba(0, 0, 0, 0.08);',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .node.brand img { width: 74px; display: block; }',
            '#faydaModal.fayda-screen .modal-card img.fayda {',
            '    width: 68px;',
            '    height: 68px;',
            '    margin: 0;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .link {',
            '    flex-grow: 1;',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 5px;',
            '    padding: 0 6px;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .dots {',
            '    flex-grow: 1;',
            '    border-top: 3px dotted #2BB24B;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .swap {',
            '    width: 42px;',
            '    height: 42px;',
            '    flex-shrink: 0;',
            '    border-radius: 50%;',
            '    background: #17A04A;',
            '    box-shadow: 0 4px 12px rgba(23, 160, 74, 0.35);',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .swap svg {',
            '    width: 21px;',
            '    height: 21px;',
            '    stroke: #ffffff;',
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
            '    margin-top: 30px;',
            '    padding: 0 16px;',
            '    background: #F2F8F4;',
            '    border-radius: 16px;',
            '    text-align: left;',
            '}',
            '#faydaModal.fayda-screen .fayda-benefit {',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 14px;',
            '    padding: 15px 0;',
            '}',
            '#faydaModal.fayda-screen .fayda-benefit + .fayda-benefit { border-top: 1px solid #E2EEE7; }',
            '#faydaModal.fayda-screen .fayda-benefit .ic {',
            '    width: 44px;',
            '    height: 44px;',
            '    flex-shrink: 0;',
            '    border-radius: 50%;',
            '    background: #DDEFE4;',
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
            /* the popup's standing copy has nothing left to say here */
            '#faydaModal.fayda-screen p:not(.fayda-cta) { display: none; }',
            '#faydaModal.fayda-screen .modal-btn.primary {',
            '    order: 5;',
            '    width: 100%;',
            '    position: relative;',
            '    margin: auto 0 0 0;',
            '    padding: 17px 0;',
            '    font-size: 14.5px;',
            '    background: #128A3E;',
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
    function injectRail(mode, style, gate) {
        var rail = document.createElement('nav');
        rail.className = 'proto-rail';

        /* A way back to the app home from anywhere in the prototype. */
        rail.innerHTML = '<a class="proto-home" href="index.html">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M3.4 10.4 12 3.6l8.6 6.8V20a1 1 0 0 1-1 1h-5v-6h-5.2v6h-5a1 1 0 0 1-1-1v-9.6Z"/>'
            + '</svg><span>HOME</span></a>'
            + '<h4>FAYDA ACTIVATION</h4>'
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
            + '<p class="proto-hint">' + (style === 'screen' ? 'Full-bleed screen' : 'Centred popup card') + '</p>'
            + '<h4 class="later">WITHDRAW FLOW</h4>'
            + GATES.map(function (g) {
                return '<button class="proto-tab' + (g.id === gate ? ' on' : '') + '" data-gate="' + g.id + '">'
                    + '<span class="t">' + g.label + '</span>'
                    + '<span class="h">' + g.hint + '</span>'
                    + '</button>';
            }).join('');

        rail.addEventListener('click', function (ev) {
            var tab = ev.target.closest('.proto-tab');
            if (tab && tab.dataset.gate) {
                /* Withdraw lives on the M-PESA screen, so land there. */
                if (tab.dataset.gate !== gate) write(GATE_KEY, tab.dataset.gate, 'Home Screen.html');
                return;
            }
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

        /* Each mark on its own tile, chained together. */
        var bridge = document.createElement('div');
        bridge.className = 'fayda-bridge';
        bridge.innerHTML = '<span class="node" id="faydaNode"></span>'
            + '<span class="link">'
            + '<span class="dots"></span>'
            + '<span class="swap"><svg viewBox="0 0 24 24">'
            + '<path d="M10.1 13.6a3.7 3.7 0 0 0 5.4.3l2.6-2.6a3.7 3.7 0 1 0-5.3-5.2l-1.5 1.5"/>'
            + '<path d="M13.9 10.4a3.7 3.7 0 0 0-5.4-.3l-2.6 2.6a3.7 3.7 0 1 0 5.3 5.2l1.5-1.5"/>'
            + '</svg></span>'
            + '<span class="dots"></span>'
            + '</span>'
            + '<span class="node brand"><img src="assets/M-PESA-Logo-Green.svg" alt="M-PESA"></span>';
        card.insertBefore(bridge, fayda);
        bridge.querySelector('#faydaNode').appendChild(fayda);

        /* Replaces the popup's standing paragraph with what linking buys. */
        var BENEFITS = [
            ['SECURE IDENTITY VERIFICATION',
             '<path d="M12 2.6 20 5.6v6c0 4.6-3.2 8.3-8 9.8-4.8-1.5-8-5.2-8-9.8v-6l8-3Z" fill="#17A04A"/>'
             + '<path d="m8.3 12.2 2.6 2.6 4.9-5" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'],
            ['FASTER ACCOUNT SERVICES',
             '<path d="M13.6 2.2 4.8 13.1c-.4.5-.05 1.2.58 1.2H10l-1.5 8.5 8.8-10.9c.4-.5.05-1.2-.58-1.2H12l1.6-8.5Z" fill="#17A04A"/>'],
            ['SEAMLESS M-PESA EXPERIENCE',
             '<g stroke="#17A04A" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">'
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
        var mode = currentMode();
        var style = currentStyle();
        var gate = currentGate();

        injectStyles();
        injectRail(mode, style, gate);

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
