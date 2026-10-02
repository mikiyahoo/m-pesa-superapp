# M-PESA Savings — Feature & Functionality Specification

**Screen:** [`Savings.html`](./Savings.html) — one self-contained file (markup + CSS + logic in one place); **8,357 lines / ~358 KB** at the time of writing.
**Title:** `Savings` · **State key:** `sessionStorage['fdState']` · **Currency:** ETB, `en-US` grouping with 2 decimals (`money`, `whole`).
**Anchors — names, never line numbers.** This spec cites **functions, constants, element ids and CSS classes only**. Line numbers are deliberately absent because `Savings.html` is being rewritten while this document is written (it moved 7,989 → 8,293 → 8,308 → 8,357 lines during a single session, and was rewritten twice more while the anchors were being refreshed). To get a **fresh name → line map** at any time, run this from the project root:

```powershell
Select-String -Path 'Savings.html' -Pattern '^\s*(function\s+[\w$]+|const\s+[A-Z][\w$]*\s*=)' |
  ForEach-Object { '{0,6}: {1}' -f $_.LineNumber, $_.Line.Trim() }
```

Use **§25 Function index** as the reliable way to find any symbol by name.
**Scope note (in-file comment above the state):** *"Locked / Fixed Time Deposit, added to Savings as its own tab. Covers: opt in → plan → amount → review → PIN → account (phase 1); balance inquiry and mini statement (phase 2); maturity withdrawal, rollover and early withdrawal (phase 3); closure (phase 4)."*

---

## 1. What the feature does

M-PESA Savings is the **savings marketplace** inside the M-PESA super-app: one wallet, one M-PESA PIN, four saving products, and the **complete money lifecycle** — activate → open → grow → inquire → mature → collect / roll over / withdraw early → close.

| Product | Locked? | Rate | Minimum | Purpose |
|---|---|---|---|---|
| **Individual Saving** | No — money in and out at any time | **7% p.a.** | none (auto-save min 50 ETB) | A flexible pocket |
| **Target Saving** | No, but goal-driven | **7% p.a.** | target ≥ 500 ETB | Pocket + amount + deadline |
| **Fixed Deposit** | Yes — 3 / 6 / 9 / 12 months | **8 / 9 / 9.5 / 10% p.a.** | 10,000 / 20,000 / 30,000 / 50,000 ETB | Locked with a partner bank, higher rate |
| **Group Saving** | Shared pot | **7% p.a.** | target ≥ 500 ETB | Save together; admin-controlled payout |

Nothing else in the app is needed to use it — the screen ships with its own **seeded demo state**, so every lifecycle state (active, matured, closed, on-track, behind, pending invitation, pending leave request) is reachable on first load.

Two views of the same home, switched by `setTab(name, gate)`:

| View | Reached with | Content |
|---|---|---|
| **Mine** (`paneMine`) | default | All four products aggregated + the full active-accounts list |
| **Fixed Deposit** (`paneFixed`) | `?tab=fixed`, the FIXED tile, or right after activation | The locked product in depth |

There is **no on-screen tab bar**; the second view is a mode of the home, and Back drops to `mine` first (`back`).

---

## 2. Entry points & URL parameters

| From | Mechanism | Result |
|---|---|---|
| `Mini Apps.html` → "M-PESA Saving" feature card, or its Discover tile | `openPocketMoney()` | sets `savingsReturn = 'Mini Apps.html'`, then navigates to `Savings.html` |
| Prototype sidebar → MINI APPS → M-PESA SAVING → **SAVING OPT-IN** | `Savings.html?optin=1` | a brand-new saver: empty state, only the M-PESA wallet |
| Prototype sidebar → **SAVING ACTIVATED** | `Savings.html?activated=1` | `optedIn = true`, the full seeded demo |
| Prototype sidebar → **GROUP SAVING DEMO → YOU – ADMIN** | `Savings.html?demo=me` | Daniel's leave request, seen by the admin |
| **BETH O – MEMBER** / **SARA T – MEMBER** | `Savings.html?demo=c1` / `?demo=c3` | the same request seen by a plain member |
| **DANIEL B – INVITED** | `Savings.html?invite=c4` | the group invitation as Daniel sees it |

The sidebar entries live in the "M-PESA SAVING" group of `assets/prototype-mode.js`; the URL parameters are read in the start-up block at the end of `Savings.html`.
| Back / X on the savings home | `savingsReturn()` | returns to `Mini Apps.html`, otherwise `index.html` |

**Startup sequence** (the script block at the end of the file) 

1. `?optin=1` replaces the whole state with a brand-new saver (only the wallet).
2. `?activated=1` re-seeds only when the saved run is otherwise empty, then forces `optedIn = true`.
3. `S.notes` defaults to `[]`; **other people's** leave requests are stripped unless the group demo is running.
4. `demo` re-attaches the groups after an opt-in emptied them and plants Daniel's request on **Family Trip** (`DEMO_GROUP = 'GS30215547'`).
5. `save()` → `renderHome()` → then one of: `openOptin(true)` (not opted in, no demo, no invite), `setTab('fixed', true)` when `?tab=fixed`, or resuming any of my own pending leave requests via `othersApprove`.
6. `paintBell()`, then `?invite` → `inviteePrompt()` after 700 ms, else a stored `pendingNotice` → `notify()` after 700 ms, else `demo` → `demoLeavePrompt()` after 700 ms.

---

## 3. Architecture

- **Single screen-stack SPA.** Every page is a `<section class="step" id="stepX">`. `show(id)` toggles `.active`; `go(id)` pushes onto the stack; `back()` pops; `resetTo(ids)` lands on a page with fresh history.
- **Green status bar** — `show()` flips the fake status bar to green on steps marked `data-green`: `stepAccount`, `stepGrpCreate`, `stepGrpPocket`, `stepIndCreate`, `stepIndPocket`. While viewing a **closed** account the bar turns muted grey instead.
- **One store.** `S` is loaded from sessionStorage by `loadState()`, written back by `save()`; `assets/prototype-mode.js` clears `fdState` when a new prototype run starts.
- **One keypad, three journeys.** `amountMode = 'fd' | 'ind' | 'grp'` routes the shared amount screen (`paintAmount` / `amountContinue`) to fixed-deposit, pocket and group maths.
- **Interest is derived, never stored.** Every balance and interest figure is recomputed from `opened`, `rate`, `principal` and the transaction list at render time, so the demo stays internally consistent on any date.
- **Receipts are shared.** `receiptHtml(o)` builds the common result card (status chip, M-PESA + partner duo mark inside a progress ring, headline figures, optional copyable transaction ID, detail rows, `stamp()` date/time). `showInfo()` shows a non-terminal receipt; `showDone()` shows a terminal one.
- **One card header everywhere.** `cardHead(kind, right, pct, ringColor, title, chip, pair)` draws the top line of every saving card from the `KIND` map (the colour class, card label and icon per product), optionally wrapping the icon in a progress ring or replacing it with the bank + M-PESA pair (`duoProgress`).
- **One empty state everywhere.** `emptyState(icon, title, text, plus)` backed by the copy map `EMPTY` and `noPocket(kind)` — see §9.

---

## 4. Data model

```js
S = {
  optedIn:  <bool>,      // has the customer activated savings?
  wallet:   75000,       // M-PESA wallet balance (ETB)
  notes:    [ note… ],   // every SMS and in-app notice, newest last
  individual: [ pocket… ],
  accounts:   [ deposit… ],
  groups:     [ group… ]
}
```

**`pocket`** — individual / target saving

```js
{ id: 'IS90212410', name, balance, opened,
  auto:   { amount, freq, start } | null,   // recurring wallet → pocket transfer
  target: { amount, from, by }     | null,  // goal
  txns: [ { type: 'DEPOSIT'|'WITHDRAW', amount, on, by } ] }
```

**`deposit`** — fixed deposit (`account()`)

```js
{ id: 'FD20417731', name: '12 Months Lock', partner: 'awash',
  months, rate, principal, opened,
  closed: { on, paid, how } | null,
  txns: [ { type: 'DEPOSIT'|'INTEREST POSTED'|'INTEREST ACCRUED'|'WITHDRAW'|'ROLLED OVER', amount, on } ] }
```

**`group`**

```js
{ id: 'GS30215547', name, admin: <bool>, balance, closed: null,
  target: { amount, from, by },
  members: [ { id, name, phone, avatar, admin?, pending?, me? } ],
  leave:   { who, approvals: [ memberId… ], on } | null,
  txns:    [ { type, amount, on, by, label } ] }
```

**`note`** — one row in the notifications centre

```js
{ kind: 'sms'|'money'|'accepted'|'declined', text, on, read: <bool> }
```

### Reference data

| Constant | Value |
|---|---|
| `PARTNERS` | `awash → { name: 'AWASH BANK', logo: 'assets/banks logo/awass-bank.png' }` — the only partner |
| `PLANS` | 3 mo / 10,000 / 8% · 6 mo / 20,000 / 9% · 9 mo / 30,000 / 9.5% · 12 mo / 50,000 / 10% |
| `PARTNER` / `PARTNER_ORDER` | `'awash'` / `[PARTNER]` |
| `ME` | `Mikias`, avatar-2, `me: true` |
| `CONTACTS` | Beth Obura (c1), Sara Tesfaye (c3), Daniel Bekele (c4), Hana Girma (c5), Yonas Alemu (c6) |
| `LIST_KINDS` | the one product order used by the tiles, the filter, the list and the new-saving picker: individual, target, fixed, group |
| `KIND` | per-product colour class, card label and icon (target / individual / fixed / group) |
| `EMPTY` | the empty-state copy per kind (`home`, individual, target, fixed, group) — see §9 |
| `WALLET_IC` | inline SVG path: the wallet mark used by the `home` empty state |
| `MENU_IC` | the ⋮ menu glyphs and their tints |
| `NOTE_IC` | the notification-centre row icons, per `note.kind` |
| `IND_RATE` / `IND_MIN_AUTO` | `7` / `50` |
| `TARGET_MIN` | `500` |
| `LEAVE_NEEDED` | `3` |
| `ACT_MONTHS` | `6` |
| `QUESTIONS` | the 7 fixed-deposit FAQs |
| `DEMO_GROUP` / `INVITEE` | `'GS30215547'` (Family Trip) / `'c4'` (Daniel Bekele) |
| Date-picker limits | tomorrow → **+60 months** (`dpRange` / `dpClamp`) |

### Seeded state

`seedState()` is what a fresh run gets:

- **wallet 75,000 ETB**, `optedIn: true`;
- two **unread sample notifications** (interest added to the 3-month deposit; Beth put 2,500 into Family Trip);
- one **active** 12-month / 50,000 deposit whose maturity is **210 days** away;
- one **matured** 3-month / 10,000 deposit whose term ended **8 days ago** — so the matured branch is live on load.

`seedPockets()` — five pockets:

| Name | Balance | Goal | Auto-save |
|---|---|---|---|
| University Tuition | 75,000 | 200,000 | 15,000 monthly |
| Emergency Fund | 7,200 | 15,000 | — |
| Business Startup | 50,000 | 150,000 | 3,500 weekly |
| Rainy Day | 2,410 | — | — |
| Holiday Fund | 0 | — | — (brand-new) |

`seedGroups()` — **Family Trip** (`GS30215547`, I am admin, 4 members, target 60,000) and **Office Fund** (`GS81904412`, admin Hana Girma, 5 members, target 20,000).

`loadState()` falls back to `seedState()` when nothing is stored; then `S.individual` / `S.groups` are seeded if missing, my own member name is refreshed to `ME.name`, and `S.notes` defaults to `[]`.

---

## 5. The money maths

**Fixed deposit**

```js
maturityOf(a)   = opened + months
termDays(a)     = days(opened → maturity)
statusOf(a)     = closed → 'closed'
                  today ≥ maturity → 'matured'
                  otherwise 'active'
elapsed(a)      = clamp(days(opened → today), 0, termDays(a))
accrued(a)      = principal × rate/100 × elapsed / 365   // daily, capped at term
maturedTotal(a) = principal + accrued(a)
```

`projected(plan, amount)` previews interest and the maturity date on the plan and amount screens from the exact day count.
`history(a)` synthesises one **INTEREST ACCRUED** line per month the deposit has run (to maturity, or to closure if sooner) and sorts movements by date — accruals before same-day payouts.

**Pocket — 7% p.a.** `pocketInterest(p)`: each movement earns from *its own day forward*, so a withdrawal stops earning:

```js
Σ  sign × amount × 7/100 × days(txn → today) / 365       // sign = −1 for WITHDRAW
```

**Group** — `memberTotal(g,id)` sums that member's deposits; `memberInterest(g,id)` accrues 7% per member movement; `leavePayout(g,id)` = total + interest.

**Target status** — `targetChip(p)`, the chips used on pocket cards, group cards and the product pages:

| Chip | Colour | Condition |
|---|---|---|
| `REACHED` | green | `balance ≥ target.amount` |
| `NOT STARTED` | grey | `balance ≤ 0` |
| `ON TRACK` | green | `balance ≥` the pro-rata share due so far |
| `BEHIND` | amber | otherwise |

`targetsInOrder()` sorts behind-schedule targets **last**; `targetPct()` caps the progress bar at 100%; `targetDaysLeft()` floors the countdown at 0.

**Planning help:** `periodsUntil()` and `suggested()` produce *"Save X ETB monthly to reach it"*, and the create form pre-fills the auto-deduction that lands exactly on the goal (`paintIndForm`).

---

## 6. Savings home — "Mine" view

`renderHome()` · list in `renderSavingsList()`

- **Pinned balance card** — wrapped in `.home-pin` (CSS `.home-pin` on the wrapper) with `position: sticky; top: 0; z-index: 2` and a white fade (`::after`) so the card stays put while the list scrolls under it and dissolves into the fade.
  - `TOTAL SAVINGS BALANCE`, an **eye** (`toggleMineHidden` — masks to `*****`, drops the slash, flips the `aria-label` between Hide and Show), the total, then **Accrued Interest** and **Active Accounts**.
  - A chart button top-right → **Savings activity** (`openActivity`).
- **Header row** — back arrow (`back()`), the title `SAVINGS` / `FIXED DEPOSIT`, the **notifications bell with an unread badge** (`homeBell`, `paintBell`) and the **⋮ menu** (`openMenu`).
- **Totals** — `Σ pocket balances + Σ my group shares + Σ live fixed principals`; accrued interest = fixed `accrued` **+** pocket interest; active accounts = pockets + open deposits + open groups. `renderHome()` also renders the fixed pane, so both views are always in step.
- **Four product tiles** → `openType('individual' | 'target' | 'fixed' | 'group')`. The **FIXED** tile carries a **NEW** badge (`#tileNew`) until savings are activated.
- **ACTIVE SAVING ACCOUNTS** header with a **FILTER** dropdown (`openListPicker` · `toggleListKind` · `renderListPicker`). The label reads `All`, one kind's name, or "N kinds"; cards render in `LIST_KINDS` order regardless of the order the filter was ticked; matured deposits sort after still-locked ones.
- **Empty state** — `noPocket(kind)` shows the right icon, title and one-liner for the visible filter (§9).
- **Bottom CTA** — `NEW SAVING` → `homeCta()` → `chooseSavingType()`: a sheet offering the four products in their kind colours and icons.

**Card contents**

| Card | Renders |
|---|---|
| `indCard` | compact / full pocket card: kind icon + name, `SAVED`, % of goal and progress bar (amber when **BEHIND**), days left, `AUTO-SAVE` or `INDIVIDUAL` chip, and the auto-save line (e.g. "3,500 ETB weekly · next 1 Nov 2026") |
| `depositCard` | bank + M-PESA pair with the M-PESA mark riding the progress ring, deposit name, `LOCKED` / `MATURED` / `CLOSED` chip, rate, and a footer of `N Days Left` + `x%` · `Matured <date>` + "Ready to collect" · `Closed <date>` + "X ETB PAID"; closed cards read `WAS` instead of `SAVED` and drop the interest line |
| `groupCard` | kind icon + group name, `x%` rate line, chip, `SAVED` / % of target, footer "You manage this group" or "Managed by Hana Girma", or the leave-request progress ("2 of 3 approved") |

---

## 7. Savings home — "Fixed Deposit" view

`renderFixedPane()`

- The header title becomes **FIXED DEPOSIT** and the CTA becomes **NEW FIXED DEPOSIT** → `startNewDeposit()`.
- **Pinned** `TOTAL LOCKED SAVINGS` card  in the `locked` style with the M-PESA pattern, its own eye (`toggleLocked`), **Total Accrued Interest** and **Active Accounts**.
- **Maturity banners**  — one per matured deposit: *"EMERGENCY FUND HAS MATURED · 10,045.20 ETB is ready to withdraw or roll over"* → opens the deposit.
- **MY FIXED DEPOSITS** — the live deposits as full cards .
- **HOW IT WORKS**  — shown only when nothing is locked: choose a period and bank → deposit and accrue daily → collect or roll over at maturity, interest lost if early.
- **Empty state**  — "NO FIXED DEPOSIT YET" with a lock ring: *"Lock your savings with a partner bank and earn a fixed rate of up to 10%."*
- **CLOSED** section  — retired deposits stay listed here.
- **One-shot maturity SMS** — `maybeNotifyMaturity()` fires once per load: *"Your fixed deposit FD… matured on … Open M-PESA Savings to withdraw or roll over."*
- **⋮ menu here** — `FAQS` + `CLOSE ACCOUNT` → `pickToClose()`: one open deposit goes straight to confirmation; several open a picker listing each name, amount and status.

---

## 8. Saving-type first page

`openType(kind)` · `renderType()` · `stepType`

| Product | Title | Card label | CTA |
|---|---|---|---|
| target | TARGET SAVINGS | TOTAL TARGET SAVINGS | NEW TARGET SAVING → `openIndCreate('target')` |
| individual | INDIVIDUAL SAVINGS | TOTAL INDIVIDUAL SAVINGS | NEW INDIVIDUAL SAVING → `openIndCreate()` |
| fixed | FIXED DEPOSIT | TOTAL LOCKED SAVINGS | NEW FIXED DEPOSIT → `startNewDeposit()` |
| group | GROUP SAVINGS | TOTAL GROUP SAVINGS | NEW GROUP → `openGroupCreate()` |

- A big total card with an eye (`toggleTypeHidden`) and an adaptive stat pair: the left figure is **Target Amount** (target), **Total Accrued Interest** (fixed), **Accrued Interest** (individual) or **Members** (group); **Active Accounts** always sits on the right.
- Any live **leave request** surfaces here as a `leaveCard`.
- **ACTIVE ACCOUNTS** — the list in full (`typeRow` → the matching card in full, bar and footer included), or `noPocket(typeKind)` when the product has nothing yet.

---

## 9. Empty states

One shared component keeps every "nothing here yet" screen consistent.

- **`emptyState(icon, title, text, plus)`** (5037, CSS ) renders a green art mark — with a small **+** bubble when `plus` is set — a bold title and one short line of copy, centred.
- **`EMPTY`** (5042) holds the copy per kind:

| Kind | Title | Line |
|---|---|---|
| `home` | No savings yet | Start your first saving below. |
| `individual` | No individual savings yet | Save any amount, any time. |
| `target` | No target savings yet | Set a goal and save toward it. |
| `fixed` | No fixed deposits yet | Lock your money at a fixed rate. |
| `group` | No savings groups yet | Create a group and save together. |

- **`noPocket(kind)`** (5049) picks the icon (`KIND[kind]`, or the wallet mark `WALLET_IC` for `home`) and returns the component with the `+`.

**Where it appears**

| Place | Kind passed | Line |
|---|---|---|
| Savings list, when the visible filter is empty | the single visible kind, else `'home'` | 5032 |
| A product's first page with no accounts | `typeKind` | 5146 |
| Notifications, when nothing has arrived | its own bell art (no `+`) | 8160 |

Two places still use their own blocks on purpose: the **fixed deposit pane** keeps the larger "NO FIXED DEPOSIT YET" card with the lock ring , and **transaction lists** inside accounts use the compact inline "No Transaction" strip (6926 for pockets, 7492 for groups).

---

## 10. Activation (opt-in)

`openOptin(first)` · `stepOptin`

- A **4-slide carousel** (`assets/savings-optin1…4.jpg`) — "Smart saving for bright future!", "Create a separate saving pockets" and two more.
- **Auto-advances every 3.8 s** (`goSlide`), with dot indicators that also work as taps, and **swipe** support (pointer-down/up, 30 px threshold).
- The CTA → `optIn()` → the shared **PIN** sheet titled **M-PESA SAVINGS — ACTIVATE TO ACHIEVE MORE GOAL**.
- `activateSavings()`: `S.optedIn = true`, `save()`, the home is restored, the **Fixed Deposit** view is selected, and the toast **YOU HAVE OPTED IN** appears.
- The gate is enforced by `setTab(name, gate)` only when entering with `?tab=fixed&optin=1`; `?optin=1` re-arms it on every load by replacing the state with an empty saver.
- `first` (passed by `openOptin(true)`) decides whether closing the carousel leaves Savings entirely — which matters because a brand-new saver opens straight onto it.

---

## 11. Fixed deposit — the opening journey

**a) Choose a plan** — `renderPlans()` · `stepPlans`

- Four package cards "N Months Lock + R% Interest", each with **MINIMUM DEPOSIT**, **MATURITY DATE** (`ddmmyyyy`) and **SELECT**.
- A persistent warning: *"If you withdraw before the maturity date, you lose all the interest — only your deposit is returned."*
- In **rollover** mode the title becomes **ROLL OVER** and a lead line shows the amount being reinvested; plans below that amount stay tappable and read "Needs X ETB more from your wallet".
- Choosing a plan (`choosePlan`) opens the shared amount screen.

**b) Amount** — `paintAmount()` · `stepAmount`

- On-screen keypad (max 7 digits, a leading `0` ignored) with `amountPress` / `amountDelete`.
- Live validation: over the wallet → *"Not enough balance. Max X ETB"*; below the plan minimum → *"Minimum deposit is X ETB"*; otherwise the CTA enables and the hint reads *"If you withdraw early, you lose the interest."*
- The earn grid always shows **INTEREST RATE** and **MATURITY DATE** (`projected`).
- `amountContinue()` → review.

**c) Review** — `openReview()` · `stepConfirm`

- A receipt with a `REVIEW YOUR DEPOSIT` / `CONFIRM ROLLOVER` chip, deposit name, amount (on a top-up rollover also "FROM MATURED DEPOSIT" + "ADDED FROM WALLET"), rate, matures on, and **AT MATURITY = amount + interest**.
- `reviewConfirm()` → PIN.

**d) PIN** — `askPin(ctx)` · `stepPin` — shared by every journey

- Title plus context rows, four dots (`paintPin` / `pinPress`), an on-screen keypad, and a **fingerprint** button that fills `1234` (`pinFill`).
- `checkPin()`: **demo rule — `0000` is the wrong PIN, anything else passes.**
  - Wrong → the dots shake, the PIN clears, and a sheet says *"INCORRECT PIN … You have N attempts left before your M-PESA is locked"* with CANCEL / TRY AGAIN.
  - At zero attempts → *"Too many incorrect attempts"*, and OK returns (`pinCancel`).

**e) Processing** — `processing(title, steps, then)`

- A blocking overlay (`procOverlay`) with rotating step labels: **700 ms per step** (label swap, then tick), completing at `700 × steps + 200 ms`.
- Opening uses: Verifying your identity → Checking eligibility → Checking M-PESA balance → Creating your fixed deposit.

**f) Done** — `runOpen()` → `showDone()`

- Creates the deposit (`newId('FD', 8)`), pushes it to `S.accounts`, debits `S.wallet`, and sends the SMS *"You have deposited X ETB to fixed deposit FD… Matures … M-PESA balance … ETB."*
- Receipt: **DEPOSIT CREATED** / *"DEPOSIT CREATED SUCCESSFULLY"*, deposit name, locked amount, rate, matures on, a `CREATED ON` stamp, a **copyable transaction ID** (`copyTxn` → "TRANSACTION ID COPIED"), and **VIEW DEPOSIT** (`viewCurrent`) / **DONE** (`doneClose`).

---

## 12. Fixed deposit — the account page

`openAccount(id)` · `renderAccount()` · `stepAccount` ( `data-green`)

- **Hero card** — partner duo mark, masked ID (`maskId`), the deposit name with an eye (`acctEye` — one shared hide flag), and the headline figure: **principal** while active, **principal + interest** once matured, **0.00 ETB** when closed.
- **Term bar** — `blue` while active, green matured, `grey` closed (filled to full width); the footer pair reads "Opened <date> · N days to <maturity>" / "Matured <date>" / "Closed <date> · X ETB paid".
- **Action grid by state** (`actionBtn`)

| State | Actions |
|---|---|
| **Active** | CHECK BALANCE · MINI STATEMENT · EARLY WITHDRAW |
| **Matured** | WITHDRAW · ROLL OVER · MINI STATEMENT |
| **Closed** | CHECK BALANCE (disabled) · MINI STATEMENT (disabled) · NEW DEPOSIT, plus a note that the ID is retired |

- **Account details accordion** — `accFacts` / `toggleAcc` / `fact`: Account ID, accrued interest (+ "Lost if withdrawn early") or interest earned, total disbursed + closed by, rate, lock period, maturity date.
- **Transactions** — `history(a)` reversed into `txnRow`, each row with a type-specific icon and colour (deposit, interest posted, interest accrued, bonus, withdraw, rolled over).

**Balance check** — `checkBalance()`: PIN → receipt **BALANCE**, "BALANCE AS OF …", current balance = principal + accrued, with principal / accrued interest / maturity rows, and actions MINI STATEMENT / DONE.

**Mini statement** — `miniStatement()`: PIN → receipt **MINI STATEMENT**, "SENT TO YOUR PHONE BY SMS", the last five movements, plus an SMS carrying the same list.

**Maturity choice** — `maturityChoice()`: sheet *"YOUR TERM HAS ENDED · <total> ETB"* → **WITHDRAW** (`startMatureWithdraw`) / **ROLL OVER TO A NEW TERM** (`startRollover`) / **NOT NOW**.

**Maturity withdrawal** — `runMature(dest)`: posts INTEREST POSTED then WITHDRAW, closes the account with `how = 'Maturity withdrawal'` (`closeAccount`), pays the destination, sends an SMS, and shows the receipt **DEPOSIT CLOSED** with deposit + interest earned, a `CLOSED ON` stamp and VIEW WALLET / DONE.

**Payout destination** — `renderPayout()` · `stepPayout`: **M-PESA Wallet** on top plus a dropdown row over all active individual pockets (`destinations`, `destRow`, `destList`, `openDestSheet` / `pickDest`). `payInto(dest, amount)` credits the wallet or the chosen pocket; `payoutContinue()` requires a destination.

**Rollover** — `startRollover()` / `runRollover()`: base = `floor(maturedTotal × 100) / 100`; posts the interest, records ROLLED OVER, closes the old account (`how = 'Rollover to a new term'`), creates the new deposit (topping up any shortfall from the wallet), receipt **DEPOSIT ROLLED OVER — NEW TERM STARTED SUCCESSFULLY**.
Shortfall sheet — `rollShort()` / `rollTopUp()`: when the matured amount is below the chosen plan's minimum, offers **ADD & CONTINUE** (pays the gap from the wallet, refused when the wallet is short) or **CHOOSE ANOTHER**.

**Early withdrawal** — `startEarly()` · `stepEarly`: an alert banner ("Your deposit matures on X, N days from now. Withdrawing now returns your principal only."), a receipt-style breakdown (principal returned, accrued interest **LOST**, maturity date, status → closed after withdrawal) and a **mandatory consent checkbox** (`toggleConsent`) — *"I understand that I will lose X ETB in interest…"* — that unlocks **WITHDRAW**.
- `acceptEarly()` → payout destination → `runEarly(dest)`: guards against a deposit that has since matured (delegates to the maturity path), pays **principal only**, records `how = 'Early withdrawal'`, and the receipt shows **INTEREST LOST X ETB** and **CLOSED BEFORE MATURITY**.
- `declineEarly()`: shows the **WITHDRAWAL CANCELLED — YOUR DEPOSIT STAYS LOCKED** receipt and leaves the account open.

**Closure from the ⋮ menu** — `pickToClose()` → `askClose()`: a dialog stating exactly what is paid and what is lost, then PIN → the correct runner (early, or at maturity). A closed deposit cannot be reopened.

---

## 13. Individual & Target saving

Individual and Target are the **same pocket object**; the mode only decides whether a goal is asked for. Rate 7% p.a. (`IND_RATE`), auto-save minimum 50 ETB (`IND_MIN_AUTO`), target minimum 500 ETB (`TARGET_MIN`).

**Create** — `openIndCreate(mode)` · `paintIndForm()` · `indCreate()` · `stepIndCreate` ( `data-green`)

- Fields: **name** (required for target, optional for individual — it then takes the next free "Individual Saving N" via `autoName()`, capped at 10 characters with a live counter), an **automatic-deduction switch** (`toggleIndAuto`) with amount and Daily / Weekly / Monthly (`startLine`, `nextDeduction`), and in target mode a **goal** (≥ 500 ETB) and a **target date**.
- **Date picker** — `openDatePicker` · `renderDatePicker` · `dpSync` / `dpTap` / `dpScrolled` / `dpConfirm`: a three-wheel day / month / year sheet (row height 44, 140 ms snap settle); impossible days clamp to the month's last day (`dpClamp`), the range runs **tomorrow → +60 months** (`dpRange`), quick chips 3 MONTHS / 6 MONTHS / 1 YEAR (`dpQuick`, `quickDate`) sit above a live "N days from today" hint (`byHint`).
- **Validation & hints:** name required in target mode; goal ≥ 500; date required; auto amount ≥ 50 and ≤ wallet — because **the first deduction is taken today** (`deductNow`). `periodsUntil` / `suggested` compute the deduction that reaches the goal on time and say "Reaches your target on time" or "Save X ETB monthly to reach it on time".
- With auto-save the flow routes through a **CONFIRM DEPOSIT** receipt first (`openAutoConfirm` — SAVING NAME, DEPOSIT AMOUNT, FROM M-PESA WALLET, AUTOMATIC DEDUCTION, START DATE, NEXT DEDUCTION, TARGET, RATE) before the PIN; without it, straight to PIN.
- `runIndCreate()`: CREATING YOUR SAVING → creates the pocket, `deductNow()` when auto (charges the wallet, records the deposit, sets the next start date), then either the deposit result or a **"SAVING CREATED SUCCESSFULLY · Make your first deposit to start saving."** sheet with ADD LATER / ADD MONEY, plus an SMS.

**Pocket page** — `openIndPocket(id)` · `renderIndPocket()` · `stepIndPocket` ( `data-green`)

- Hero card with name + eye and balance, "of X ETB target" with the status chip and progress bar for targets, a days-left footer, and an auto-save line when recurring is on.
- Actions: **DEPOSIT** (`openIndAmount('deposit')`), **WITHDRAW** (`openIndAmount('withdraw')`, disabled at zero balance), **RECURRING TRANSFER** (`openRecurring`).
- A **target card** either shows "TARGET · 20,000 ETB / By 12 Mar 2027. Tap to change it." or invites *"IT'S EASIER WITH A TARGET"*.
- **TRANSACTIONS** with a compact "No Transaction" empty state (6926), and the ⋮ menu (`FAQS` + `CLOSE ACCOUNT`).

**Deposit / Withdraw** — `openIndAmount(kind)` · `paintIndAmount()` · `indAmountContinue()` → shares `stepAmount`

- Shows the wallet or saving balance, blocks anything over the limit (*"Not enough balance. Max X ETB."*), and hints *"Earns 7% interest. Withdraw any time."* or *"Paid to your M-PESA wallet."*
- PIN → `runIndMove(n)`: moves the balance, adjusts the wallet, records the transaction, then the result screen and an SMS. **Withdrawals always go to the M-PESA wallet.**

**Result screen** — `showIndResult(dep, g)` · `stepIndResult` · `indResultView` / `indResultDone`: a partner ring filled to the target progress (or a fixed accent), the account balance, the target line when set, contextual text ("You have reached your target!" / "Money added to your account with success" / "Money withdrawn to your M-PESA wallet with success"), and VIEW ACCOUNT / VIEW SAVING.

**Target: set / change / remove** — `openTargetSet()` · `paintTargetSet()` · `stepTgtSet`

- Goal + date with hints: minimum 500, "Already saved X ETB. Pick a higher target." or "Save X ETB monthly to reach it". **SAVE** stays disabled until valid (`saveTarget`).
- **REMOVE** (`removeTarget`, shown when a goal exists) confirms *"Your money stays in <name>. Only the goal is removed."*

**Recurring transfer** — `openRecurring(g)` · `paintRecurring()` · `saveRecurring()` · `stepIndRecurring`

- Works for a pocket **or** a group (`recHolder`, `walletLine`).
- Amount ≥ 50. A **new** transfer must fit today's wallet because the first deduction is taken immediately; an **existing** one keeps its schedule when updated (the CTA becomes UPDATE); **STOP** (`stopRecurring`) clears it after a confirmation dialog.
- Each change sends an SMS, and `recBackToAccount()` returns to whichever account page opened it.

**Close a pocket** — `askCloseInd()` / `runCloseInd(p, total)`

- A dialog shows `balance + interest` and warns that auto-save stops; then PIN, then **CLOSING ACCOUNT** processing.
- The money goes to the M-PESA wallet and the pocket is **removed** from `S.individual` (unlike a fixed deposit, which is kept as CLOSED). The home returns to the Mine view, toasts ACCOUNT CLOSED and sends an SMS.

---

## 14. Group saving

**Create** — `openGroupCreate()` · `paintGrpForm()` · `grpCreate()` · `runGrpCreate()` · `stepGrpCreate` ( `data-green`)

- Fields: **name** (max 15 characters with a live `n/15` counter), **target** (≥ 500), **target date**, and **at least one member**. I am added automatically as **admin**.
- **Member picker** — `openMemberSheet` · `renderMemberSheet`, two sections:
  - **ADD BY M-PESA NUMBER** — `addByNumber()` accepts any 9-digit number starting with `7` (`/^7\d{8}$/`), rejects a bad number with *"M-PESA numbers have 9 digits and start with 7"* and a duplicate with *"X is already added"*, and stores unknown numbers as name = formatted phone (`fmtPhone`) with an initials avatar.
  - **CONTACTS** — the five seeded people; anyone already in the group renders locked and non-tappable (`toggleMember`).
  - Chips on the create form remove a draft member (`removeDraft`); the sheet button reads `DONE (n)` / `ADD TO GROUP (n)` (`memberDone`).
- PIN context rows — **GROUP NAME, TARGET, BY, MEMBERS N including you** → CREATING YOUR GROUP (create account, send invitations) → the group page plus a **"GROUP CREATED SUCCESSFULLY"** sheet with ADD LATER / CONTRIBUTE, and an SMS listing the invitees.

**Group page** — `openGroup(id)` · `renderGrpPocket()` · `stepGrpPocket` ( `data-green`)

- Hero card: name + eye, balance, "of X ETB target", status chip, progress bar, "N days to <date> · percent", *"N members · you put in X ETB"*, and the recurring-transfer line when set.
- Actions: **CONTRIBUTE**; **WITHDRAW** for the admin (muted while locked); **RECURRING**; **MEMBERS** for non-admins (`showGrpMembers` — scrolls to the list).
- A state card explains who may take money out and when: **READY TO WITHDRAW** ("The group reached its target." / "The target date has come.") or "**YOU MANAGE THIS GROUP** / MANAGED BY HANA GIRMA" with the rule *"can withdraw once the target is reached or on <date>"*.
- **Withdrawal rule** — `grpCanWithdraw(g)`: `admin && !closed && balance > 0 && (balance ≥ target || today ≥ target date)`.
- **MEMBERS** — sorted by contribution with pending invitations last, each with their % of the group and `YOU` / `ADMIN` / `LEAVING` / `PENDING` chips.
- **TRANSACTIONS** with per-member attribution (`nameOf`) and a compact empty state (7492), plus the leave card whenever a request is live.

**Contribute** — `openGrpContribute()` · `paintGrpAmount()` · `grpAmountContinue()` → the shared keypad with the wallet limit → PIN → `runGrpMove(true, n)`: credits the group, debits the wallet, records a DEPOSIT by `me`, then the result screen and an SMS with the group balance against the target.

**Group withdrawal** — `grpWithdraw()`: blocked with a toast *"WITHDRAW OPENS AT THE TARGET OR ON <date>"* until eligible; otherwise a **CONFIRM WITHDRAWAL** receipt (opening balance, FROM GROUP SAVINGS, SEND TO M-PESA WALLET, MEMBERS, "AFTER THIS: GROUP CLOSES"), PIN, then `runGrpMove(false, n)` — the admin takes the whole pot and the group closes.

**Admin tools** — `openManageGroup()`: **EDIT GROUP** (`openGrpEdit` / `paintGrpEdit` / `saveGrpEdit` — name, target and date, validated, with an SMS to members), **ADD MEMBERS** (`openMemberSheet(g)`), and **MEMBERS** where tapping one opens `memberActions()` → `askRemoveMember()`, which warns *"What they already put in stays in the group."* before removing them.

**Close group** — `askCloseGroup()` / `runCloseGroup(g)`: every member is paid back their own share, my share comes to my wallet, the group is marked closed with `paid` recorded and the balance zeroed; the result screen reads *"<name> is closed. Every member got back what they put in."* and an SMS goes out.

---

## 15. Group invitations

- New members are stored with **`pending: true`** (`memberDone`; `runGrpCreate`). `joined(g)` counts accepted members, `invitedCount(g)` counts pending ones, and `membersLine(g)` reads e.g. "3 members · 1 invited".
- The member list shows a `PENDING` chip and the line "Pending invitation" for them, and they sort after everyone who has joined.
- **As the invitee** — `?invite=c4` (sidebar: *"Daniel B – Invited"*) → `inviteePrompt()` after 700 ms:
  - an SMS arrives (*"M-PESA: Mikias invited you to join Family Trip. Open M-PESA Saving to accept."*, marked `forOther` so it stays out of my notifications);
  - then a **GROUP INVITATION** sheet with the inviter, the member count, *"Save together toward 60,000 ETB by <date>. Your money earns 7% interest from the day you put it in."* and **DECLINE** / **ACCEPT**;
  - if no invitation exists: toast **"NO INVITATION FOR DANIEL BEKELE YET"**.
- `answerInvite(id, yes)`: ACCEPT clears `pending` (toast **JOINED AS DANIEL BEKELE**); DECLINE removes the member (toast **DECLINED AS DANIEL BEKELE**). Either way it stores `S.pendingNotice`, so the **next time the admin opens Savings** an in-app notice reports *"Daniel Bekele accepted/declined your invitation to Family Trip."*

---

## 16. Leaving a group — the approval flow

`LEAVE_NEEDED = 3`. A member cannot simply walk away: **three other members must approve**, and they are paid back everything they put in plus interest.

| Step | Function | Behaviour |
|---|---|---|
| Ask | `askLeaveGroup()` | a dialog explaining the mechanics, then PIN, then the request is recorded as `leave = { who: 'me', approvals: [] }`, toast **LEAVE REQUEST SENT**, an SMS to the other members, and the simulated approvals begin |
| Approvals tick in | `othersApprove(g)` | walks the other members (admin first) and approves one every **3.6 s**, so the demo completes itself |
| The card | `leaveCard(g, withGroup)` | **REQUEST SENT** with an approval-dots gauge (`approvalDots`) for the requester; **ACTION REQUIRED** with **APPROVE** for approvers (and **DECLINE**, admin only); hidden while the demo sheet is up |
| Who has approved | `showApprovers(id)` | the **APPROVALS** sheet: everyone listed as APPROVED or WAITING, approved first then admins |
| Approve | `confirmApprove()` → `approveLeave(id, g)` | PIN (MEMBER, GROUP, PAID BACK) → the approval is recorded and reported by SMS; completing at 3 |
| Complete | `completeLeave(g)` | for **me**: the wallet is credited my share and the group is removed from `S.groups`, with a **LEAVE APPROVED** sheet and an SMS; for **another member**: `balance -= paid`, a WITHDRAW transaction labelled *"<name> left the group"*, the member is removed, a toast and an SMS |
| Decline | `declineLeave()` | only the admin can — the request is dropped, the money stays, and the member is told by SMS |

**Group Saving Demo** — `demoLeavePrompt` · `demoReview` · `demoDeclines`

`DEMO_GROUP = 'GS30215547'` (Family Trip). `?demo=me|c1|c3` sets the viewer, opens the **group first page**, sends *"M-PESA: Daniel Bekele asked to leave Family Trip. Open M-PESA Saving to approve or decline."*, and after **1.4 s** raises the **LEAVE REQUEST** sheet — Daniel's avatar, *"X ETB goes back to them, with interest"*, *"N of 3 members have approved."* and **DECIDE LATER** / **CONTINUE**.

- CONTINUE → `demoReview`: a **LEAVE REQUEST / REVIEW REQUEST** receipt (MEMBER, PAID BACK, SAVED, INTEREST EARNED, GROUP, APPROVALS), then the APPROVE confirm page and PIN → `approveLeave(viewerId, g)`; a non-admin viewer also sees the toast **YOU APPROVED**.
- DECLINE as the admin runs the real `declineLeave()`; a non-admin viewer just gets **YOU DECLINED**, because only the admin's decision is binding.

---

## 17. Savings activity

`openActivity()` · `actSeries()` · `renderActivity()` · `actSelect()` · `stepActivity` — opened from the chart button on the balance card, or **ACTIVITY** in the ⋮ menu of the Mine view.

- **Six months** (`ACT_MONTHS = 6`), one point per month end: `savedAt(when)` reconstructs the total held at that instant across pockets, fixed deposits (opened ≤ t, not closed by t) and **my own** group contributions; `movedIn(from, to)` totals the money in and out inside each month.
- A smooth powder-green **area chart** (`smoothPath` — Catmull-Rom converted to cubic Béziers) with a value tooltip, a dotted drop-line, a month label row (the last point reads **THIS MONTH**) and wide invisible tap targets per month.
- A month **carousel** with dimmed neighbours showing the picked month's total, then **SAVED IN / TAKEN OUT / CHANGE** for that month.

---

## 18. Notifications centre, SMS and notices

Every message the customer receives is kept in one place.

| Piece | Function | Behaviour |
|---|---|---|
| **Bell** | `#homeBell` · `paintBell()` | sits in the header next to the ⋮ menu; shows an unread count badge (capped at `99`) and hides the badge when nothing is unread |
| **SMS heads-up** | `sms(text, forOther)` · `hideSms()` | the green M-PESA SMS bubble that slides in and auto-hides after **5.2 s**; when `forOther` is set the message belongs to someone else's phone and is **not** logged to my notifications |
| **In-app notice** | `notify(kind, text)` · `hideNotice()` | the dark green banner for in-app events (money in, invitation answers); also 5.2 s, and it logs itself too |
| **Log** | `logNote(kind, text)` | pushes `{ kind, text, on, read:false }` onto `S.notes`, saves and repaints the badge |
| **Toast** | `showToast(message)` | a 1.6 s confirmation pill for small things (MEMBER ADDED, JOINED AS…, ACCOUNT CLOSED, YOU HAVE OPTED IN) |

**The Notifications screen** — `renderNotes()` · `openNotes()` · `markAllRead()` · `stepNotes`

- Grouped under a **month heading** ("October 2026"), newest first, each row carrying a kind icon (`NOTE_IC`), the text, the channel ("SMS ·") and the date + time. Unread rows carry a **dot**.
- A **Mark all as read** button sits on the first month heading and is disabled when nothing is unread (`markAllRead` clears the flag, repaints the badge and re-renders).
- Opening the screen does **not** auto-clear the badge any more — reading is now explicit.
- Empty state: the bell art, **"No notifications yet"**, *"Updates on your savings show here."*
- Notification kinds: `sms` (incoming M-PESA message), `money` (money moved), `accepted` / `declined` (an invitation answer). The seeded run starts with two **unread** samples so the badge is populated.

---

## 19. FAQs

`openFaq()` · `setFaqTab(t)` · `renderFaq()` · `stepFaq` — reached from the ⋮ menu on every account page and on both home views.

**Tab 1 — FIXED DEPOSIT INFO** (`faqTab = 'info'`): a two-column table headed **FIXED DEPOSIT TERMS** / **MY SAVINGS**, with the right column computed from live state:

| Term | My savings |
|---|---|
| LOCK PERIOD — how long the money stays locked | 3 – 12 Months |
| MINIMUM DEPOSIT — smallest amount, by period | From 10,000 ETB |
| INTEREST RATE — fixed yearly rate, longer earns more | 8% – 10% per year |
| TOTAL LOCKED — sum of active fixed deposits | `whole(locked) + ' ETB'` |
| ACCRUED INTEREST — built up so far, paid at maturity | `money(interest) + ' ETB'` |
| NEXT MATURITY — when the next deposit ends | the earliest active maturity, or `—` |
| EARLY WITHDRAWAL — returns only the deposit | Interest lost |

**Tab 2 — FREQUENT QUESTIONS** (`faqTab = 'qs'`): seven accordions (`QUESTIONS`) covering what a fixed deposit is, how much interest, the minimums, early withdrawal, what happens at maturity, whether money can be added (no), and how to close one (⋮ → Close account → confirm → PIN).

---

## 20. Shared UI components

| Component | Reference | Behaviour |
|---|---|---|
| **Bottom sheet** | `openSheet(o)` · `closeSheet()` | one reusable sheet (`#sheetBody`): grab handle, label, hero (logo/icon/title/text), optional raw html, note, then actions in a row or stacked; tapping the scrim closes it |
| **Confirm dialog** | `openDialog(title, html, onConfirm, label)` · `closeDialog()` | centred modal with an overridable confirm label — `CLOSE`, `REMOVE`, `STOP`, `REQUEST`, `DECLINE` — and a CANCEL that dismisses |
| **PIN** | `askPin(ctx)` → `checkPin()` | title + context rows, four dots, keypad, fingerprint; 3 attempts, shake on failure, "locked" sheet at zero |
| **Processing** | `processing(title, steps, then)` | blocking overlay with rotating labelled steps, 700 ms each, then the callback |
| **Receipts** | `receiptHtml(o)` · `showInfo()` · `showDone()` | chip, M-PESA + partner duo mark inside a progress ring, headline figures, copyable transaction ID, detail rows and a `stamp()` date/time; `showDone` also fires the SMS and the exit step |
| **⋮ menu** | `openMenu(where)` · `closeMenu()` | context-aware: ACTIVITY + FAQS on the Mine view; FAQS + CLOSE ACCOUNT on the fixed view and on a deposit; FAQS + CLOSE ACCOUNT on a pocket; FAQS + MANAGE GROUP + CLOSE GROUP (admin) or FAQS + LEAVE GROUP / LEAVE REQUESTED (member) on a group. Disabled items render greyed |
| **Status bar** | `show(id)` | white on light screens, green on `data-green` screens, muted grey while viewing a closed account |
| **Hide-balance eyes** | `toggleMineHidden` · `toggleLocked` · `toggleTypeHidden` · `acctEye` | mask figures to `*****`; the account-page flag is shared across the deposit, pocket and group pages |
| **Date picker** | `openDatePicker` → `dpConfirm` | three-wheel day / month / year sheet with quick chips and a live day count |
| **Keypads** | `amountPress` · `pinPress` | shared digit pads; `digitsOnly` strips non-digits and leading zeros from typed fields |
| **Number inputs** | `moneyInput` · `fmtInput` · `numVal` | thousands-grouped entry fields that are read back as plain numbers |
| **Physical keyboard** | 8236 | digits type, Backspace deletes, **Enter** continues on the amount screen, **Esc** goes back; ignored inside inputs, sheets, dialogs and while processing |

---

## 21. States, roles and statuses

**Fixed deposit** — derived from the date, never stored: `active` (chip `LOCKED`, blue) → `matured` (chip `MATURED`, green, "Ready to collect") → `closed` (chip `CLOSED`, grey, kept in the CLOSED section with `closed.paid` and `closed.how`). The seeded 3-month deposit sits in the matured state on load, so that branch is demonstrable immediately.

**Pocket** — `REACHED` / `ON TRACK` (green), `NOT STARTED` (grey), `BEHIND` (amber, sorted last); the card chip is `AUTO-SAVE` when a recurring transfer is set, `INDIVIDUAL` otherwise.

**Group** — the same target chips, plus:

- **role** — `admin` (manage group, add or remove members, edit, close, withdraw the pot once eligible) vs **member** (contribute, recurring, request to leave, approve or decline others' requests). `adminOf(g)` returns the admin member or `ME` as a fallback.
- **membership** — joined vs `pending` (invited, not yet accepted).
- **leave request** — none, pending (`leave.approvals.length` of 3), or completed.

**Persistence** — the whole state lives in `sessionStorage['fdState']` and survives moving between screens; `assets/prototype-mode.js` clears it when a new prototype run starts. `savingsReturn` (set by `Mini Apps.html`) remembers where Back should go.

---

## 22. Assets used

| Asset | Used for |
|---|---|
| `assets/M-PESA-pattern.svg` | the pattern inside the green total cards |
| `assets/M-PESA-money-icon.svg` | the M-PESA mark in the bank + M-PESA pair (`duoProgress`) |
| `assets/banks logo/awass-bank.png` | the partner bank mark (AWASH BANK) |
| `assets/avatars/avatar-1…6.png` | group members (initials are drawn when a member has no avatar, `avatar()`) |
| `assets/savings-optin1…4.jpg` | the four activation slides |
| `assets/savings-optin.jpg` | the M-PESA Saving feature card on `Mini Apps.html` |
| `assets/prototype-mode.js` | the prototype rail, run reset and the Savings quick links |

---

## 23. Demo rules and limitations

Anyone reading or demoing the code should know these are deliberate:

1. **PIN** — `0000` is the only rejected PIN; anything else passes, and the fingerprint button types `1234` (`checkPin`). There is no verification.
2. **No backend** — every balance, interest figure and transaction is arithmetic over `sessionStorage`; nothing is sent anywhere, and a new prototype run resets the data.
3. **Simulated participants** — other members' leave approvals arrive on a 3.6 s timer (`othersApprove`), and invitations and payouts to other people are state changes plus text only.
4. **One partner bank** — `PARTNER_ORDER` has a single entry (`awash`), which is why a new deposit goes straight from the Fixed view to the plan list with no partner step.
5. **Pocket withdrawals always land in the M-PESA wallet**; fixed-deposit payouts may go to the wallet or to any active individual pocket.
6. **Closing differs by product** — closing an individual or target pocket **deletes** it from `S.individual`, while a closed fixed deposit is **retained** and listed under CLOSED. Intentional, not an inconsistency to change casually.
7. **Group withdrawal is all-or-nothing** — the admin takes the whole pot and the group closes; there is no partial payout.
8. **Rates are constants** — `PLANS` and `IND_RATE` drive the cards, the FAQs, the projections and the interest maths, so changing a rate updates the whole demo consistently.
9. **"Today" is captured once at load** (`TODAY`), so interest and statuses will not tick over midnight in a long-running session.
10. **Reading notifications is explicit** — opening the screen no longer clears the badge; **Mark all as read** does.

---

## 24. Screen index (24 steps)

| Step | Line | Screen | Green bar |
|---|---|---|---|
| `stepHome` | 4030 | Savings home (`paneMine` + `paneFixed`) | — |
| `stepOptin` | 4101 | Activation carousel | — |
| `stepPlans` | 4148 | Choose a lock period | — |
| `stepAmount` | 4161 | Amount (shared: deposit / pocket / group) | — |
| `stepPin` | 4204 | PIN (shared by every journey) | — |
| `stepProcessing` | 4237 | Processing overlay | — |
| `stepConfirm` | 4247 | Review / confirm (also the approve-leave review) | — |
| `stepInfo` | 4263 | Non-terminal receipt | — |
| `stepDone` | 4275 | Terminal receipt | — |
| `stepAccount` | 4288 | Fixed deposit account | ✅ |
| `stepEarly` | 4305 | Early withdrawal (consent) | — |
| `stepPayout` | 4317 | Payout destination | — |
| `stepType` | 4332 | A product's first page | — |
| `stepGrpCreate` | 4355 | Create a group | ✅ |
| `stepGrpEdit` | 4395 | Edit a group (admin) | — |
| `stepGrpPocket` | 4422 | Group account | ✅ |
| `stepIndCreate` | 4435 | Create an individual / target saving | ✅ |
| `stepIndPocket` | 4492 | Pocket account | ✅ |
| `stepIndResult` | 4509 | Deposit / withdraw result | — |
| `stepTgtSet` | 4532 | Set, change or remove a target | — |
| `stepIndRecurring` | 4557 | Recurring transfer (pocket or group) | — |
| `stepActivity` | 4582 | Savings activity chart | — |
| `stepNotes` | 4593 | Notifications | — |
| `stepFaq` | 4605 | FAQs | — |

**Journey orders**

- **Fixed deposit:** `stepHome → stepPlans → stepAmount → stepConfirm → stepPin → (processing) → stepDone → stepAccount`.
- **Balance / statement:** `stepAccount → stepPin → stepInfo`.
- **At maturity:** `stepAccount → (sheet) → stepPayout → stepPin → (processing) → stepDone`; rollover instead goes `→ stepPlans → stepAmount → stepConfirm → stepPin → stepDone`.
- **Early withdrawal:** `stepAccount → stepEarly → stepPayout → stepPin → stepDone`.
- **Pocket:** `stepHome → stepIndCreate → stepConfirm → stepPin → stepIndResult → stepIndPocket`, then `stepIndPocket → stepAmount → stepPin → stepIndResult`.
- **Group:** `stepHome → stepGrpCreate → stepPin → stepGrpPocket`; contribute `→ stepAmount → stepPin → stepIndResult`; withdraw `→ stepConfirm → stepPin → stepIndResult`; leave `→ stepPin → (approvals) → sheet`.

---

## 25. Function index

Every function in `Savings.html`, by line. Use this to relocate anything if the file moves on.

**Infrastructure & state**

| Function | Line | Function | Line |
|---|---|---|---|
| `startOfDay` / `addDays` / `addMonths` |  | `maturityOf` / `termDays` / `statusOf` |  |
| `daysBetween` | 4723 | `elapsed` / `accrued` / `projected` |  |
| `fmtDate` / `ddmmyyyy` / `fmtShort` |  | `maskId` | 4851 |
| `money` / `whole` / `newId` |  | `show` / `go` / `resetTo` / `back` |  |
| `seedPockets` / `seedState` / `account` |  | `savingsReturn` / `setTab` / `homeCta` |  |
| `loadState` / `save` | 4809 / 4824 | `findAccount` / `startNewDeposit` / `planName` |  |

**Savings home**

| Function | Line | Function | Line |
|---|---|---|---|
| `pocketInterest` | 4933 | `openType` / `toggleTypeHidden` | 5061 / 5068 |
| `toggleMineHidden` / `renderHome` | 4940 / 4945 | `duoProgress` / `typeRow` / `renderType` |  |
| `setListFilter` / `toggleListKind` | 4975 / 4980 | `statusChip` | 5149 |
| `openListPicker` / `renderListPicker` | 4990 / 4996 | `cardHead` / `cv` / `depositCard` |  |
| `renderSavingsList` | 5006 | `toggleLocked` / `renderFixedPane` | 5211 / 5216 |
| `emptyState` / `EMPTY` / `noPocket` |  | `maybeNotifyMaturity` | 5277 |

**Opt-in, plans, amount, review, PIN, processing, receipts**

| Function | Line | Function | Line |
|---|---|---|---|
| `openOptin` / `goSlide` | 5290 / 5301 | `askPin` / `paintPin` / `pinPress` |  |
| `optIn` / `activateSavings` | 5322 / 5331 | `pinFill` / `checkPin` / `pinCancel` |  |
| `renderPlans` / `planById` / `choosePlan` |  | `processing` | 5634 |
| `rollShort` / `rollTopUp` | 5392 / 5411 | `stamp` / `newTxnId` / `duo` |  |
| `accFacts` / `toggleAcc` / `fact` |  | `receiptHtml` / `showInfo` / `showDone` |  |
| `amountPress` / `amountDelete` | 5452 / 5459 | `copyTxn` / `doneClose` | 5743 / 5748 |
| `paintAmount` / `amountContinue` | 5464 / 5509 | `runOpen` / `viewCurrent` | 5758 / 5792 |
| `openReview` / `openConfirmStep` / `reviewConfirm` |  | | |

**Account page, maturity, rollover, early withdrawal, closing**

| Function | Line | Function | Line |
|---|---|---|---|
| `openAccount` / `actionBtn` | 5797 / 5811 | `destinations` / `renderPayout` | 6025 / 6030 |
| `history` / `txnRow` / `acctEye` / `renderAccount` |  | `payInto` / `destRow` / `destList` |  |
| `checkBalance` / `miniStatement` | 5943 / 5972 | `openDestSheet` / `pickDestSheet` / `pickDest` |  |
| `maturedTotal` / `maturityChoice` / `startMatureWithdraw` |  | `payoutContinue` / `closeAccount` / `runMature` |  |
| `startRollover` / `runRollover` | 6179 / 6186 | `openMenu` / `closeMenu` | 6345 / 6371 |
| `startEarly` / `toggleConsent` / `declineEarly` |  | `openDialog` / `closeDialog` / `pickToClose` / `askClose` |  |
| `acceptEarly` / `runEarly` | 6293 / 6298 | `openFaq` / `setFaqTab` / `renderFaq` |  |

**Individual & target saving**

| Function | Line | Function | Line |
|---|---|---|---|
| `quickDate` / `nextDeduction` / `deductNow` |  | `openIndPocket` / `indCard` / `renderIndPocket` |  |
| `startLine` / `setupBy` / `byValue` / `byHint` |  | `openIndAmount` / `paintIndAmount` / `indAmountContinue` |  |
| `ordinal` / `dpRange` / `dpClamp` |  | `runIndMove` | 6975 |
| `openDatePicker` / `dpQuick` / `renderDatePicker` |  | `showIndResult` | 6995 |
| `dpSync` / `dpTap` / `dpScrolled` / `dpConfirm` |  | `indResultView` / `indResultDone` | 7018 / 7032 |
| `periodsUntil` / `suggested` | 6665 / 6672 | `openTargetSet` / `paintTargetSet` / `saveTarget` / `removeTarget` |  |
| `targetsInOrder` / `targetPct` / `targetDaysLeft` / `targetChip` |  | `askCloseInd` / `runCloseInd` | 7084 / 7104 |
| `findInd` / `moneyInput` / `fmtInput` / `numVal` / `digitsOnly` |  | `recHolder` / `openRecurring` / `recBackToAccount` / `walletLine` |  |
| `freqLine` / `chooseSavingType` / `autoName` / `openIndCreate` |  | `paintRecurring` / `saveRecurring` / `stopRecurring` |  |
| `toggleIndAuto` / `paintIndForm` / `indCreate` / `openAutoConfirm` / `runIndCreate` |  | | |

**Group saving**

| Function | Line | Function | Line |
|---|---|---|---|
| `seedGroups` / `findGrp` / `memberById` |  | `openGroup` / `renderGrpPocket` | 7431 / 7437 |
| `memberTotal` / `myShare` / `joined` / `invitedCount` / `membersLine` |  | `showGrpMembers` / `openManageGroup` | 7499 / 7504 |
| `memberInterest` / `leavePayout` / `adminOf` / `fmtPhone` / `grpCanWithdraw` / `avatar` |  | `memberActions` / `askRemoveMember` | 7520 / 7532 |
| `groupCard` | 7275 | `openGrpEdit` / `paintGrpEdit` / `saveGrpEdit` |  |
| `openGroupCreate` / `paintGrpForm` / `removeDraft` |  | `askCloseGroup` / `runCloseGroup` | 7579 / 7594 |
| `openMemberSheet` / `renderMemberSheet` | 7330 / 7337 | `nameOf` / `approvalDots` / `leaveCard` / `showApprovers` |  |
| `toggleMember` / `addByNumber` / `memberDone` |  | `askLeaveGroup` / `othersApprove` / `approveLeave` |  |
| `grpCreate` / `runGrpCreate` | 7393 / 7404 | `confirmApprove` / `declineLeave` / `completeLeave` |  |
| `demoLeavePrompt` / `demoReview` / `demoDeclines` |  | `openGrpContribute` / `paintGrpAmount` / `grpAmountContinue` / `grpWithdraw` / `runGrpMove` |  |

**Activity, sheets, notifications, start-up**

| Function | Line | Function | Line |
|---|---|---|---|
| `savedAt` / `movedIn` / `actSeries` |  | `sms` / `hideSms` | 8100 / 8108 |
| `openActivity` / `actSelect` / `smoothPath` / `renderActivity` |  | `logNote` / `paintBell` / `notify` / `hideNotice` |  |
| `openSheet` / `closeSheet` | 8068 / 8085 | `renderNotes` / `openNotes` / `markAllRead` |  |
| `inviteePrompt` / `answerInvite` | 8180 / 8199 | `showToast` | 8217 |
| Keyboard handler | 8236 | Start-up block |  |

---

## 26. Quick answers

- **How many saving products?** Four — Individual, Target, Fixed Deposit and Group — on one home with two views (Mine, Fixed Deposit).
- **What are the rates?** 7% p.a. for individual, target and group; 8 / 9 / 9.5 / 10% p.a. for 3 / 6 / 9 / 12-month fixed deposits.
- **Where does interest come from?** It is computed on every render from `opened`, `rate` and the transaction list — fixed deposits accrue daily (`principal × rate × elapsed / 365`), pockets accrue per movement at 7%.
- **What can I do on a fixed deposit?** Check balance, see a mini statement, withdraw at maturity, roll over into a new term (with an optional top-up), withdraw early (interest lost, gated by a consent checkbox), or close it from the ⋮ menu.
- **What can I do on a pocket?** Deposit, withdraw, set or change a target, set / update / stop a recurring transfer, and close it.
- **What can I do in a group?** Contribute, set a recurring transfer, see members and their shares, and — as admin — edit the group, add or remove members, withdraw the pot once eligible, and close the group. As a member: contribute, and request to leave (three approvals).
- **Where do notifications live?** The bell in the header, backed by `S.notes`, fed by every SMS and in-app notice, with a month-grouped history and an explicit **Mark all as read**.

---

*Generated from `Savings.html` — 8,293 lines, 24 steps, ~230 functions. All line numbers refer to the revision described above; the function index in §25 is the reliable way to relocate anything if the file changes.*