/* ------------------------------------------------------------------
   Prototype bootstrap.

   Linking prompts are dismissible unless a flow needs the account
   linked before money can move: withdrawing, and sending to a bank
   (asked on arrival, or above 7,000 Br). Those flows make the prompt
   mandatory themselves through window.prototypeMode.forceMandatory().

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
            sessionStorage.removeItem('railHomeOpen');
            sessionStorage.removeItem('railAppsOpen');
            sessionStorage.removeItem('railMpesaOpen');
            sessionStorage.removeItem('railDemoOpen');
            sessionStorage.removeItem('railSavingOpen');
            sessionStorage.removeItem('railVouchersOpen');
            sessionStorage.removeItem('gvState');
            sessionStorage.removeItem('railSendOpen');
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
        },

        /* A yellow sticky note for developers, in the empty space to the
           right of the phone (desktop only, never part of an export).
           devNote(text) shows it, devNote() takes it away. */
        devNote: function (text) {
            var note = document.getElementById('protoNote');
            if (!text) { if (note) note.remove(); return; }
            if (!note) {
                note = document.createElement('aside');
                note.id = 'protoNote';
                note.className = 'proto-note';
                note.innerHTML = '<span class="tag">Developer Note</span><p></p>';
                document.body.appendChild(note);
                window.addEventListener('resize', placeNote);
                window.addEventListener('load', placeNote);
            }
            setTimeout(placeNote, 60);   // again once the page's own layout has settled
            note.querySelector('p').textContent = text;
            placeNote();
        }
    };

    function placeNote() {
        var note = document.getElementById('protoNote');
        var frame = document.querySelector('.mobile-container');
        if (!note || !frame) return;
        var r = frame.getBoundingClientRect();
        note.style.left = (r.right + 32) + 'px';
        note.style.top = (Math.max(r.top, 0) + 120) + 'px';
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
            '    width: 236px;',
            '    background: #ffffff;',   /* white, with near-black, green and grey type */
            '    border-right: 1px solid #E8ECEA;',
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
            '    color: #1c1c1c;',
            '    font-size: 12.5px;',
            '    font-weight: 700;',
            '    letter-spacing: 0.8px;',
            '}',
            '.proto-home:hover { background: #F1FAF4; color: #1E9E4F; }',
            /* root icons are green */
            '.proto-row .proto-home svg { color: #1E9E4F; }',
            /* main menu titles read a little larger than their submenus */
            '.proto-row .proto-home { font-size: 14px; }',
            '.proto-row .proto-home svg, .proto-row .proto-home img { width: 19px; height: 19px; }',
            '.proto-home svg {',
            '    width: 17px;',
            '    height: 17px;',
            '    fill: currentColor;',
            '    flex-shrink: 0;',
            '    display: block;',
            '}',
            /* the M-PESA mark keeps its own colours on the white rail */
            '.proto-home img { width: 17px; height: 17px; flex-shrink: 0; display: block; }',
            '.proto-row { display: flex; align-items: center; }',
            '.proto-row .proto-home { flex: 1; margin-bottom: 0; }',
            '.proto-group { margin-bottom: 16px; }',
            '.proto-toggle {',
            '    background: none;',
            '    border: 0;',
            '    padding: 8px 14px;',
            '    color: #9aa19d;',
            '    cursor: pointer;',
            '    display: flex;',
            '}',
            '.proto-toggle:hover { color: #1E9E4F; }',
            '.proto-toggle svg {',
            '    width: 16px;',
            '    height: 16px;',
            '    fill: none;',
            '    stroke: currentColor;',
            '    stroke-width: 2.2;',
            '    stroke-linecap: round;',
            '    stroke-linejoin: round;',
            '    transition: transform 0.18s ease;',
            '}',
            '.proto-group.open .proto-toggle svg { transform: rotate(180deg); }',
            /* submenu items lead with an arrow, the list under them with a dot */
            '.proto-sub { display: none; padding: 6px 0 0 6px; }',
            '.proto-group.open .proto-sub { display: block; }',
            '.proto-sub .proto-home { margin-bottom: 6px; font-size: 12px; color: #4a4a4a; }',
            '.proto-sub .proto-home::before { color: #1E9E4F; }',   /* green arrows and dots */
            '.proto-sub2 > .proto-home:not(.proto-label) { color: #1E9E4F; font-weight: 400; }',   /* the deepest links: regular, in green */
            '.proto-sub .proto-home:hover { color: #1E9E4F; }',
            /* a full arrow (shaft and head), drawn in the text colour */
            '.proto-sub > .proto-home::before, .proto-label::before {',
            '    content: "";',
            '    width: 12px;',
            '    height: 12px;',
            '    background: currentColor;',
            '    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27black%27 stroke-width=%272.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M4 12h15%27/%3E%3Cpath d=%27m13 6 6 6-6 6%27/%3E%3C/svg%3E") center / contain no-repeat;',
            '    mask: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27black%27 stroke-width=%272.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M4 12h15%27/%3E%3Cpath d=%27m13 6 6 6-6 6%27/%3E%3C/svg%3E") center / contain no-repeat;',
            '    transition: transform 0.18s ease;',
            '    flex-shrink: 0;',
            '}',
            /* a fold (M-PESA Saving, Group Saving Demo) opens and closes its
               list; its arrow turns down when open, and folds can nest */
            '.proto-fold.open > .proto-label::before { transform: rotate(90deg); }',
            '.proto-sub2 { display: none; padding-left: 12px; }',
            /* deep rows keep to one line */
            '.proto-sub2 .proto-home { padding-right: 6px; white-space: nowrap; }',
            /* the deepest links read lighter than the menus above them */
            '.proto-sub2 > .proto-home:not(.proto-label) { font-weight: 400; }',
            '.proto-fold.open > .proto-sub2 { display: block; }',
            '.proto-sub2 > .proto-home:not(.proto-label)::before {',
            '    content: "";',
            '    width: 5px;',
            '    height: 5px;',
            '    border-radius: 50%;',
            '    background: currentColor;',
            '    flex-shrink: 0;',
            '}',
            '.proto-label {',
            '    width: 100%;',
            '    background: none;',
            '    border-width: 0 0 0 3px;',
            '    font-family: inherit;',
            '    text-align: left;',
            '    cursor: pointer;',
            '}',
            /* Keep the phone centred in the space that is left over. */
            '@media (min-width: 720px) { body { padding-left: 236px; } }',
            '@media (max-width: 719px) { .proto-rail { display: none; } }',

            /* ----- the linking prompt as a popup is a centred card ----- */
            '#faydaModal:not(.fayda-screen) { align-items: center; padding: 0 20px 48px 20px; }',
            '#faydaModal:not(.fayda-screen) .modal-card {',
            '    border-radius: 16px;',
            '    transform: scale(0.94);',
            '    opacity: 0;',
            '    transition: transform 0.2s ease, opacity 0.2s ease;',
            '}',
            '#faydaModal.show:not(.fayda-screen) .modal-card { transform: none; opacity: 1; }',

            /* ----- developer sticky note beside the phone ----- */
            '.proto-note {',
            '    position: fixed;',
            '    z-index: 1500;',
            '    width: 300px;',
            '    font-family: Barlow, sans-serif;',
            '}',
            '.proto-note .tag {',
            '    display: inline-block;',
            '    margin-bottom: 8px;',
            '    padding: 4px 9px;',
            '    border-radius: 6px;',
            '    background: #FFF7A8;',
            '    border: 1px solid #E9DD6B;',
            '    font-size: 12px;',
            '    font-weight: 700;',
            '    color: #2a2a2a;',
            '}',
            '.proto-note p {',
            '    margin: 0;',
            '    padding: 20px 22px;',
            '    border-radius: 16px;',
            '    background: #FFF9B8;',
            '    border: 1px solid #E9DD6B;',
            '    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);',
            '    font-size: 16px;',
            '    line-height: 1.45;',
            '    letter-spacing: 0.3px;',
            '    color: #1c1c1c;',
            '}',
            /* no room beside the phone: no note */
            '@media (max-width: 1060px) { .proto-note { display: none; } }',

            /* ----- the currency unit sits smaller than its amount ----- */
            '.cur { font-size: max(0.6em, 9px); letter-spacing: 0.4px; }',   /* same colour and weight as the amount */

            /* ----- no step-progress marks in flow headers ----- */
            /* hidden rather than removed, so each header keeps its balance */
            '.progress { visibility: hidden !important; }',

            /* ----- no fake clock/battery bar, on desktop as on a phone ----- */
            /* On desktop the bar stays as a thin empty strip, so screens keep
               a little room at the top and green heads still run up to the
               edge; the fake system nav buttons at the bottom stay too. */
            '.status-bar { height: 10px; padding: 0 !important; transition: none !important; }',
            '.status-bar > * { display: none !important; }',
            '@media (max-width: 719px) { .status-bar { display: none !important; } }',

            /* ----- on a real phone, the screen is the whole page ----- */
            /* No frame around it. */
            '@media (max-width: 719px) {',
            '    body { display: block; min-height: 0; background: #ffffff; }',
            '    .mobile-container {',
            '        width: 100% !important;',
            '        height: 100vh !important;',
            '        height: 100dvh !important;',
            '        box-shadow: none !important;',
            '    }',
            /* nor the fake back / home / recents bar, and nothing keeps
               room for it any more */
            '    .system-nav { display: none !important; }',
            '    .sheet-overlay, .dialog-overlay, #faydaModal:not(.fayda-screen) { padding-bottom: 0 !important; }',
            '    .proc-overlay { bottom: 0 !important; }',
            '    #faydaModal.fayda-screen { padding-bottom: 0 !important; }',
            '    .bottom-nav { bottom: 0 !important; }',
            '    .fab { bottom: 80px !important; }',
            '}',
            /* short phones: the full-screen linking prompt tightens up,
               and can scroll if it still doesn't fit (!important: the
               prompt's own rules come later in this sheet) */
            '@media (max-width: 719px) and (max-height: 720px) {',
            '    #faydaModal.fayda-screen .modal-card { padding-top: 46px !important; overflow-y: auto !important; }',
            '    #faydaModal.fayda-screen .fayda-bridge { margin-top: 18px !important; }',
            '    #faydaModal.fayda-screen .fayda-cta { margin-top: 12px !important; }',
            '    #faydaModal.fayda-screen p:not(.fayda-cta) { padding-top: 12px; }',
            '}',

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
            '    max-width: 300px;',
            '    font-size: 16px;',
            '    font-weight: 500;',
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
            /* a heavier ring, with a little white gap before the mark */
            '#faydaModal.fayda-screen .fayda-bridge .node {',
            '    width: 68px;',
            '    height: 68px;',
            '    flex-shrink: 0;',
            '    box-sizing: border-box;',
            '    padding: 3px;',
            '    border-radius: 50%;',
            '    border: 4.5px solid #2FC56D;',
            '    background: #ffffff;',
            '    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '    overflow: hidden;',
            '}',
            '#faydaModal.fayda-screen .fayda-bridge .node.brand img { width: 40px; display: block; }',
            '#faydaModal.fayda-screen .modal-card img.fayda {',
            '    width: 100%;',
            '    height: 100%;',
            '    border-radius: 50%;',
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
            '    width: 40px;',
            '    height: 40px;',
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
            '    width: 20px;',
            '    height: 20px;',
            '    stroke: #2FC56D;',
            '    stroke-width: 2.2;',
            '    fill: none;',
            '    stroke-linecap: round;',
            '    stroke-linejoin: round;',
            '    display: block;',
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

        /* Quick navigation between the prototype's screens. Only the
           root items carry an icon; each opens a closed-by-default group. */
        rail.innerHTML = '<div class="proto-group" data-key="railHomeOpen" data-open="1">'
            + '<div class="proto-row"><a class="proto-home" href="index.html">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<path d="M3.4 10.4 12 3.6l8.6 6.8V20a1 1 0 0 1-1 1h-5v-6h-5.2v6h-5a1 1 0 0 1-1-1v-9.6Z"/>'
            + '</svg><span>HOME</span></a>'
            + '<button class="proto-toggle" type="button" aria-label="Show home flows" aria-expanded="false">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>'
            + '<div class="proto-sub">'
            /* two ways into sending to a bank */
            + '<div class="proto-fold" data-key="railSendOpen" data-open="1">'
            + '<button class="proto-home proto-label" type="button" aria-expanded="false">SEND TO BANK</button>'
            + '<div class="proto-sub2">'
            /* from the M-PESA tab or the home tile, unlinked (the name is just a label) */
            + '<a class="proto-home" href="Home Screen.html?nofayda=1"><span>3000 WHITELIST</span></a>'
            /* straight onto the form, which asks to link first */
            + '<a class="proto-home" href="Send to Bank.html?fayda=ask"><span>FAYDA NOT LINKED</span></a>'
            + '</div></div>'
            + '<a class="proto-home" href="Buy Packages.html"><span>BUY PACKAGE</span></a>'
            + '</div></div>'
            /* the M-PESA tab of the bottom nav, which also offers withdrawing */
            + '<div class="proto-group" data-key="railMpesaOpen" data-open="1">'
            + '<div class="proto-row"><a class="proto-home" href="Home Screen.html">'
            + '<img src="assets/M-PESA%20Icon.svg" alt=""><span>M-PESA</span></a>'
            + '<button class="proto-toggle" type="button" aria-label="Show M-PESA flows" aria-expanded="false">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>'
            + '<div class="proto-sub">'
            + '<a class="proto-home" href="Home Screen.html?withdraw=1"><span>WITHDRAW TO BANK</span></a>'
            + '<a class="proto-home" href="Send to Bank.html"><span>SEND TO BANK</span></a>'
            + '<a class="proto-home" href="Buy Packages.html"><span>BUY PACKAGE</span></a>'
            + '</div></div>'
            + '<div class="proto-group" data-key="railAppsOpen" data-open="1">'
            + '<div class="proto-row"><a class="proto-home" href="Mini Apps.html">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<rect x="2.9" y="3.1" width="7.6" height="7.6" rx="1.5"/>'
            + '<path d="M17.3 2.9 21.2 10.7h-7.8l3.9-7.8Z"/>'
            + '<circle cx="6.7" cy="17.5" r="3.8"/><circle cx="17.3" cy="17.5" r="3.8"/>'
            + '</svg><span>MINI APPS</span></a>'
            + '<button class="proto-toggle" type="button" aria-label="Show mini app flows" aria-expanded="false">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>'
            + '<div class="proto-sub">'
            + '<div class="proto-fold" data-key="railSavingOpen" data-open="1">'
            + '<button class="proto-home proto-label" type="button" aria-expanded="false">M-PESA SAVING</button>'
            + '<div class="proto-sub2">'
            /* always starts from the activation screen */
            + '<a class="proto-home" href="Savings.html?optin=1"><span>SAVING OPT-IN</span></a>'
            /* already activated: the one for normal use */
            + '<a class="proto-home" href="Savings.html?activated=1"><span>SAVING ACTIVATED</span></a>'
            /* the same group seen by each member: a leave request to answer */
            + '<div class="proto-fold" data-key="railDemoOpen">'
            + '<button class="proto-home proto-label" type="button" aria-expanded="false">GROUP SAVING DEMO</button>'
            + '<div class="proto-sub2">'
            + '<a class="proto-home" href="Savings.html?demo=me"><span>YOU &ndash; ADMIN</span></a>'
            + '<a class="proto-home" href="Savings.html?demo=c1"><span>BETH O &ndash; MEMBER</span></a>'
            + '<a class="proto-home" href="Savings.html?demo=c3"><span>SARA T &ndash; MEMBER</span></a>'
            /* whoever you invited: the invitation as Daniel sees it */
            + '<a class="proto-home" href="Savings.html?invite=c4"><span>DANIEL B &ndash; INVITED</span></a>'
            + '</div></div></div></div>'
            /* Global Vouchers: the happy path and each exception path */
            + '<div class="proto-fold" data-key="railVouchersOpen" data-open="1">'
            + '<button class="proto-home proto-label" type="button" aria-expanded="false">GLOBAL VOUCHERS</button>'
            + '<div class="proto-sub2">'
            + '<a class="proto-home" href="Global Vouchers.html?gv=normal"><span>BUY A VOUCHER</span></a>'
            + '<a class="proto-home" href="Global Vouchers.html?gv=empty"><span>FIRST VISIT</span></a>'
            + '<a class="proto-home" href="Global Vouchers.html?gv=lowbal"><span>LOW BALANCE</span></a>'
            + '<a class="proto-home" href="Global Vouchers.html?gv=payfail"><span>PAYMENT FAILS</span></a>'
            + '<a class="proto-home" href="Global Vouchers.html?gv=issuefail"><span>ISSUE FAILS &ndash; REFUND</span></a>'
            + '<a class="proto-home" href="Global Vouchers.html?gv=smsfail"><span>SMS FAILS</span></a>'
            + '</div></div></div></div>'
            /* the web portal behind the mini apps (desktop pages) */
            + '<div class="proto-group" data-key="railPortalOpen" data-open="1">'
            + '<div class="proto-row"><a class="proto-home" href="Voucher Portal.html">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true">'
            + '<rect x="2.8" y="4" width="18.4" height="12.5" rx="1.8"/><path d="M8.5 20.5h7M12 16.5v4"/>'
            + '</svg><span>PORTAL</span></a>'
            + '<button class="proto-toggle" type="button" aria-label="Show portal pages" aria-expanded="false">'
            + '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></div>'
            + '<div class="proto-sub">'
            + '<a class="proto-home" href="Voucher Portal.html"><span>VOUCHER PAYMENT REPORT</span></a>'
            + '</div></div>';

        /* each group stays as left while moving between screens; a new run
           starts with the main menus and M-PESA Saving open, Group Saving Demo closed */
        Array.prototype.forEach.call(rail.querySelectorAll('.proto-group, .proto-fold'), function (group) {
            var key = group.getAttribute('data-key');
            var toggle = group.querySelector(':scope > .proto-row > .proto-toggle, :scope > .proto-label');
            var open = group.getAttribute('data-open') === '1';
            function setOpen() {
                group.classList.toggle('open', open);
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            }
            try { var kept = sessionStorage.getItem(key); if (kept !== null) open = kept === '1'; } catch (e) {}
            setOpen();
            toggle.addEventListener('click', function () {
                open = !open;
                setOpen();
                try { sessionStorage.setItem(key, open ? '1' : '0'); } catch (e) {}
            });
        });

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

    /* html-to-image reads every image back through fetch(). A page opened
       from the file system cannot fetch its own assets, and a resource that
       cannot be read leaves the clone's src empty: its error event then
       rejects the whole export, which used to surface as "Failed to fetch"
       or, worse, "undefined". Give it a transparent pixel to fall back on,
       so one unreadable logo cannot sink the screen, and name the cause. */
    var BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    function downloadPng(btn) {
        var frame = phoneFrame();
        if (!frame) return;
        if (location.protocol === 'file:') {
            console.warn('PNG export: a file:// page cannot fetch its own images, so they will come out blank. '
                + 'Serve the prototype over http (e.g. "python -m http.server 5500") to include them.');
        }
        btn.disabled = true;
        Promise.all([loadHtmlToImage(), embeddedFontCss()]).then(function (r) {
            return r[0].toBlob(frame, {
                pixelRatio: EXPORT_SCALE,
                fontEmbedCSS: r[1],
                backgroundColor: '#ffffff',
                imagePlaceholder: BLANK_PIXEL
            });
        }).then(function (blob) {
            if (!blob || !blob.size) throw new Error('the exporter returned an empty image');
            saveBlob(blob, exportName() + '.png');
        }).catch(function (e) {
            console.error(e);
            alert('PNG export failed: ' + String((e && (e.message || e.type || e)) || e));
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


        /* Why the prompt appeared, kept under the title. */
        var reason = document.body.dataset.linkReason;
        if (reason) {
            var cta = document.createElement('p');
            cta.className = 'fayda-cta';
            /* always two lines: the reason, then the ask */
            cta.innerHTML = reason + ',<br>link your Fayda ID';
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

    /* ---------------------------------------------------------- currency */
    /* "ETB" always reads smaller than the amount beside it. Every page
       builds its amounts as plain text, so the unit is wrapped as it
       appears (including text added later) rather than edited in each. */
    function shrinkCurrency(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                if (n.nodeValue.indexOf('ETB') === -1) return NodeFilter.FILTER_REJECT;
                var p = n.parentNode;
                if (!p || (p.classList && p.classList.contains('cur'))) return NodeFilter.FILTER_REJECT;
                if (p.closest && p.closest('svg, script, style, textarea, option, title')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        var hits = [];
        while (walker.nextNode()) hits.push(walker.currentNode);
        hits.forEach(function (n) {
            var parts = n.nodeValue.split(/\b(ETB)\b/);
            if (parts.length < 2) return;
            var frag = document.createDocumentFragment();
            parts.forEach(function (t) {
                if (t === 'ETB') {
                    var s = document.createElement('span');
                    s.className = 'cur';
                    s.textContent = 'ETB';
                    frag.appendChild(s);
                } else if (t) {
                    frag.appendChild(document.createTextNode(t));
                }
            });
            n.parentNode.replaceChild(frag, n);
        });
    }

    function watchCurrency() {
        var queued = false;
        shrinkCurrency(document.body);
        new MutationObserver(function () {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function () {
                queued = false;
                shrinkCurrency(document.body);
            });
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    /* ---------------------------------------------------------- top strip */
    /* On desktop the old status bar is a thin empty strip that keeps a
       little room at the top of the screen. Over a coloured head (a
       gradient, a pattern) the strip folds away and the head takes the
       room as extra top padding instead, so it runs up to the edge whole. */
    var STRIP = 10;
    var padded = null;   // the head currently carrying the strip's room

    function unpad() {
        if (!padded) return;
        padded.style.paddingTop = padded.dataset.stripPad || '';
        delete padded.dataset.stripPad;
        padded = null;
    }

    function paintStrip() {
        var bar = document.querySelector('.status-bar');
        var frame = phoneFrame();
        if (!bar || !frame || getComputedStyle(bar).display === 'none') { unpad(); return; }
        var rb = bar.getBoundingClientRect();
        var under = document.elementsFromPoint(rb.left + rb.width / 2, rb.bottom + 2);
        var head = null;
        for (var i = 0; i < under.length; i++) {
            var el = under[i];
            if (el === bar || !frame.contains(el) || el === frame) continue;
            /* skip toasts, banners, patterns and other floating layers */
            var floating = false;
            for (var a = el; a && a !== frame; a = a.parentElement) {
                var pos = getComputedStyle(a).position;
                if (pos === 'fixed' || pos === 'absolute') { floating = true; break; }
            }
            if (floating) continue;
            for (var e = el; e && e !== frame; e = e.parentElement) {
                var cs = getComputedStyle(e);
                var c = parseColor(cs.backgroundColor);
                var white = c && c.r > 0.98 && c.g > 0.98 && c.b > 0.98;
                if (cs.backgroundImage !== 'none' || (c && !white)) { head = e; break; }
                if (white) break;
            }
            break;
        }
        if (head === padded) return;
        unpad();
        if (head) {
            head.dataset.stripPad = head.style.paddingTop;
            /* a head that already has room at the top keeps what it has */
            var own = parseFloat(getComputedStyle(head).paddingTop);
            if (own < 20) head.style.paddingTop = (own + STRIP) + 'px';
            padded = head;
            bar.style.height = '0px';
        } else {
            bar.style.height = '';
        }
    }

    function watchStrip() {
        var queued = false, settling = false;
        function later() {
            if (!queued) {
                queued = true;
                setTimeout(function () { queued = false; paintStrip(); }, 0);
            }
            /* once a screen has slid in, look again */
            if (!settling) {
                settling = true;
                setTimeout(function () { settling = false; paintStrip(); }, 400);
            }
        }
        later();
        window.addEventListener('load', later);
        window.addEventListener('resize', later);
        new MutationObserver(later).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
    }

    function init() {
        injectStyles();
        watchCurrency();
        injectRail();
        watchStrip();
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
