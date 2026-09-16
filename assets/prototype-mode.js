/* ------------------------------------------------------------------
   Prototype variant switcher.

   Two ways to demo Fayda activation, chosen from a sidebar that sits
   outside the phone frame:

     optional   - the current behaviour: the link prompt can be
                  dismissed with SKIP or the X.
     mandatory  - the same flows, but the prompt has no way out; the
                  only move is CONTINUE.

   The choice lives in localStorage so it survives reloads and carries
   across every screen of the prototype.
------------------------------------------------------------------ */
(function () {
    'use strict';

    var KEY = 'faydaMode';
    var MODES = [
        { id: 'optional',  label: 'OPTIONAL',  hint: 'Prompt can be skipped' },
        { id: 'mandatory', label: 'MANDATORY', hint: 'No skip, no close' }
    ];

    function currentMode() {
        try {
            return localStorage.getItem(KEY) === 'mandatory' ? 'mandatory' : 'optional';
        } catch (e) {
            return 'optional';
        }
    }

    function setMode(mode) {
        try { localStorage.setItem(KEY, mode); } catch (e) {}
        /* Reload so the screen re-reads the mode from a clean state. */
        window.location.reload();
    }

    function injectStyles() {
        var css = [
            '.proto-rail {',
            '    position: fixed;',
            '    top: 0;',
            '    left: 0;',
            '    bottom: 0;',
            '    width: 188px;',
            '    background: #1C1F24;',
            '    padding: 22px 14px;',
            '    font-family: Barlow, sans-serif;',
            '    z-index: 2000;',
            '    overflow-y: auto;',
            '}',
            '.proto-rail h4 {',
            '    font-size: 10px;',
            '    font-weight: 700;',
            '    letter-spacing: 1.4px;',
            '    color: #6B7280;',
            '    margin-bottom: 14px;',
            '}',
            '.proto-tab {',
            '    display: block;',
            '    width: 100%;',
            '    text-align: left;',
            '    background: none;',
            '    border: none;',
            '    border-left: 3px solid transparent;',
            '    cursor: pointer;',
            '    font-family: Barlow, sans-serif;',
            '    padding: 10px 12px;',
            '    margin-bottom: 4px;',
            '    border-radius: 0 6px 6px 0;',
            '}',
            '.proto-tab:hover { background: #262A31; }',
            '.proto-tab .t {',
            '    display: block;',
            '    font-size: 12.5px;',
            '    font-weight: 700;',
            '    letter-spacing: 0.8px;',
            '    color: #9CA3AF;',
            '}',
            '.proto-tab .h {',
            '    display: block;',
            '    font-size: 10.5px;',
            '    font-weight: 500;',
            '    color: #6B7280;',
            '    margin-top: 2px;',
            '}',
            '.proto-tab.on { background: #262A31; border-left-color: #2FC56D; }',
            '.proto-tab.on .t { color: #ffffff; }',
            '.proto-tab.on .h { color: #2FC56D; }',
            /* Keep the phone centred in the space that is left over. */
            '@media (min-width: 720px) { body { padding-left: 188px; } }',
            '@media (max-width: 719px) { .proto-rail { display: none; } }'
        ].join('\n');

        var el = document.createElement('style');
        el.textContent = css;
        document.head.appendChild(el);
    }

    function injectRail(mode) {
        var rail = document.createElement('nav');
        rail.className = 'proto-rail';
        rail.innerHTML = '<h4>FAYDA ACTIVATION</h4>' + MODES.map(function (m) {
            return '<button class="proto-tab' + (m.id === mode ? ' on' : '') + '" data-mode="' + m.id + '">'
                + '<span class="t">' + m.label + '</span>'
                + '<span class="h">' + m.hint + '</span>'
                + '</button>';
        }).join('');

        rail.addEventListener('click', function (ev) {
            var tab = ev.target.closest('.proto-tab');
            if (tab && tab.dataset.mode !== mode) setMode(tab.dataset.mode);
        });

        document.body.appendChild(rail);
    }

    /* In mandatory mode the prompt keeps only CONTINUE.
       Screens marked always-optional opt out: buying a package is not
       gated on activation, so its prompt keeps SKIP either way. */
    function applyMode(mode) {
        var modal = document.getElementById('faydaModal');
        if (!modal || mode !== 'mandatory') return;
        if (document.body.dataset.activation === 'always-optional') return;

        var close = modal.querySelector('.modal-close');
        var skip = modal.querySelector('.modal-btn.secondary');
        if (close) close.remove();
        if (skip) skip.remove();
    }

    function init() {
        var mode = currentMode();
        injectStyles();
        injectRail(mode);
        applyMode(mode);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
