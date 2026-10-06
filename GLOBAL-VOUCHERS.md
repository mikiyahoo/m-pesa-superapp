# M-PESA Global Vouchers — Design Specification

**Screen:** [`Global Vouchers.html`](./Global%20Vouchers.html) — one self-contained file, same conventions as `Savings.html`.
**Entry:** Mini Apps → *Discover more* → **Global Vouchers**, or the sidebar → *Mini Apps → Global Vouchers*.
**State key:** `sessionStorage['gvState']` · **Currency:** ETB · **Sources:** *Global Vouchers Mini App — Flow*, *User Journey* and *UI Screen* documents (each an analysis of the BRD and the original User Journey; the raw BRD was not supplied).

Every exception path can be opened straight from the sidebar:

| Sidebar link | `?gv=` | What it shows |
|---|---|---|
| Buy a voucher | `normal` | Happy path, seeded history (1 active, 1 redeemed, 1 expired voucher; 1 failed, 1 refunded payment) |
| First visit | `empty` | No vouchers, no transactions — empty states |
| Low balance | `lowbal` | Wallet 1,200 ETB — insufficient balance on Review |
| Payment fails | `payfail` | M-PESA payment fails, nothing taken |
| Issue fails – refund | `issuefail` | Payment taken, Pincoon issuance fails, automatic reversal |
| SMS fails | `smsfail` | Voucher issued, SMS not delivered; first resend also fails |

A PIN of **0000** is always rejected (incorrect-PIN state). Any other 4 digits pays.

---

## 1. Audit of the source documents

### 1.1 Contradictions — and the decision taken

| # | Conflict | Decision in this design | Status |
|---|---|---|---|
| C1 | BRD initial catalogue is **Netflix, Google Play, PUBG Mobile**; the User Journey also shows **Spotify**. | **Spotify included** (product decision, 6 Oct 2026). The BRD's catalogue needs updating to match. | Decided — update BRD |
| C2 | Journey names values **Bundle A / B / C** and also **$10 / $20 / $30**; the BRD speaks of *denominations*. | Values are shown as **$10 / $20 / $30** with the ETB price under each. "Bundle" is not used. | Recommend, confirm |
| C3 | $10 Netflix = **1,645 ETB**, but the journey's transaction examples show Google Play $10 = **1,000 ETB** and PUBG $10 = **1,200 ETB**. | Prototype uses one sample rate (164.5 ETB per $1) for every product. Real prices are per product/denomination from pricing config. | Needs pricing data |
| C4 | Journey review shows **"Price 1,645"** next to **"10 $"** with no label — reads as if $10 = 1,650 ETB. | Review separates **Voucher value ($10) · Voucher price (1,645 ETB) · Service fee (5 ETB) · Total to pay (1,650 ETB)**, with a one-line explanation under *Voucher price*. | Done |
| C5 | Journey treats **payment success** as **purchase success**; BRD says a voucher is bought only once **issued**, and a debit without issuance is **reversed**. | Three visible stages — **Payment → Voucher → Delivery** — and three distinct outcomes (payment failed / refunded / ready). | Done |
| C6 | Journey's **Transactions** list shows voucher codes, duplicating **My Vouchers**. | Codes live only in My Vouchers (and the success screen). Transactions shows money: amount, status, reference. | Done |
| C7 | **Voucher Payment Report** (totals, by type, redeemed) appears in the journey, but the BRD's reporting requirements are operational (volume, revenue, fees, failure rate, reconciliation). | Not designed as a customer screen. | Needs product decision |
| C8 | Bottom nav **Home \| Transaction \| My Vouchers \| Info**. | Changed — see §3.2. | Proposed change |

### 1.2 Requirements missing from the documents — designed here

| Gap | Where it is handled |
|---|---|
| Insufficient balance (BRD requires validation, journey has no screen) | Inline on **Review & Pay**, before the PIN — available / required / short by, with recovery actions |
| Unavailable / out-of-stock values (BRD: not purchasable) | Shown, greyed, dashed, labelled **Unavailable**, not selectable; product card shows *Some values unavailable* |
| Incorrect PIN | Shake + red dots + "Incorrect PIN. Please try again." |
| Debit but no voucher | **Voucher not issued** screen with a 3-step refund timeline and the new balance |
| SMS not delivered | Warning on the success screen; **Resend SMS** with confirm → sending → sent / failed + retry |
| Transaction reference (BRD: unique per transaction) | On every result, transaction details and voucher details, with **Copy** |
| Support path from failures | "Contact M-PESA support with your transaction ID" on every failure and refund |
| Loading while the catalogue/availability comes from Pincoon | "Checking availability…" with skeleton cards |
| Empty states | My Vouchers, Transactions, and filtered-to-nothing |
| Voucher status (Redeemed appears only in reporting) | Every voucher carries **Active / Redeemed / Expired** |

---

## 2. End-to-end flow

```
Mini Apps → Global Vouchers (Vouchers tab)
  → Product (details + choose a value)            [unavailable values disabled]
  → Review & Pay                                  [balance check here]
      ├─ insufficient → "Choose $X instead" / Back to vouchers
      └─ Pay → M-PESA PIN
                 ├─ incorrect → retry
                 └─ Processing
                      1 Payment ──✗── Payment failed (not charged) → Try again
                      2 Voucher ──✗── Refund ── Voucher not issued (money returned)
                      3 Delivery
                      → Voucher ready: code + Copy, expiry, how to redeem,
                        SMS + app notification, transaction ID
                          └─ SMS failed → Resend SMS
My Vouchers → Voucher → Show code → Copy · How to redeem · Resend SMS
Transactions → All | Successful | Failed → Transaction → View voucher / Try again
```

**Merged:** the documents list *Select Voucher*, *Voucher Details*, *Select Denomination* and *Redemption Guide* as separate screens. Here, **product details and the value picker are one screen** (with the redemption guide folded below). This removes two taps from the purchase and keeps the price in view while choosing. *Payment Success* and *Voucher Issued* are also one screen, because the purchase isn't a success until the voucher exists (C5).

---

## 3. Information architecture

### 3.1 Screens (final list)

| Area | Screen (`step id`) | States |
|---|---|---|
| Vouchers | Home (`stepHome`) | loading · catalogue · per-product availability |
| | Product + value (`stepProduct`) | value selected · value unavailable · *How to redeem* folded |
| Purchase | Review & Pay (`stepReview`) | ready to pay · insufficient balance |
| | M-PESA PIN (`stepPin`) | entry · incorrect PIN |
| | Processing (`stepProc`) | payment · voucher · delivery · voucher failed + refund |
| | Result (`stepResult`) | **Voucher ready** (SMS sent / SMS failed) · **Payment failed** · **Voucher not issued (refunded)** |
| My Vouchers | List (`stepMine`) | product filter · *Ready to use* / *Used & expired* · empty |
| | Voucher (`stepVoucher`) | code masked / shown · active / redeemed / expired · SMS failed · resend sheet (confirm, sending, failed) |
| Transactions | List (`stepTx`) | All / Successful / Failed · grouped by month · empty · filter empty |
| | Transaction (`stepTxDetail`) | successful · failed (not charged) · refunded |
| Help | Help (`stepHelp`) | how to redeem per product · FAQs · contact |

### 3.2 Navigation — proposed change

The journey's four tabs are **Home · Transaction · My Vouchers · Info**. This design uses **three tabs** and moves Help to the header:

**Vouchers · My Vouchers · Transactions**, inside the standard **mini-app container**: every screen carries the super-app capsule top-right, **••• | ◎**. ••• opens the mini app's menu (Help & support, Add to favourites, Share, Back to M-PESA home); ◎ closes the mini app. Tab roots have no back arrow; the capsule is the way out.

- The capsule makes Global Vouchers look and behave like every other mini app in the super-app, and gives Help a home without a header icon. During payment processing, ◎ is held with "Please wait, your payment is in progress".
- The bottom bar should carry the frequent jobs: *buy*, *find my code*, *check a payment*. Help is occasional; a header icon keeps it one tap away without taking a quarter of the bar.
- "Info" was vague and "Transaction" singular; the tab names now say what's inside.
- **My Vouchers** sits in the middle, the easiest thumb reach, and shows a count of active vouchers.
- The bar is **hidden inside the purchase flow** (product → result), so no tap mid-payment drops the customer out.
- Header rule, as in the rest of the app: **←** on screens you browse into, **✕** on task screens (review, PIN, results).

### 3.3 My Vouchers vs Transactions

| | My Vouchers — *what I own* | Transactions — *what I paid for* |
|---|---|---|
| Unit | A voucher | A payment attempt |
| Shows | Code (masked in lists), expiry, status, how to redeem, resend SMS | Amount, fee, total, date/time, status, transaction ID, refund |
| Statuses | Active · Redeemed · Expired | Successful · Failed (not charged) · Refunded |
| Includes failures? | No — a failed purchase never becomes a voucher | Yes |
| Cross-link | *View payment details* | *View voucher* (successful only) |

---

## 4. Component system

All components are in `Global Vouchers.html`; class names below.

| Component | Class | Notes |
|---|---|---|
| Mini-app capsule | `.capsule` (`.light` on the green hero) | ••• menu + ◎ close, on every screen |
| App header | `.bar` | Centred uppercase light title; ← / ✕ left; capsule right |
| Home hero | `.hero` / `.panel` | Green gradient hero with the header inside it, stacked voucher cards, M-PESA balance; white panel overlaps it with a 22px radius |
| Voucher card | `.gc.gc-<key>` via `giftCard(key, label)` | The product as a card: brand wordmark, value, M-PESA seal, watermark. Scales to any width (container units): store tile, featured tile, product hero, success screen, thumbnails |
| Store grid | `.store` / `.tile` (`.wide` = featured) | 2 columns; odd counts lead with a full-width featured card |
| Ready-to-use strip | `.strip` / `.mini` | Active vouchers, one tap from the home |
| Buy bar | `.buybar` | Product page footer: total on the left, **Buy now** on the right |
| Bottom navigation | `.tabs` / `.tab` | 3 items, active count on My Vouchers, tab roots only |
| Brand mark | `.mark.m-<key>` | **Placeholder** marks; swap for partners' official logo files |
| Denomination selector | `.denoms` / `.denom` | 3-up grid; value large, ETB price under; selected = green ring + tick; unavailable = dashed, greyed, disabled |
| Price breakdown | `.rows` / `.row` / `.row.total` | Value → price → fee → dashed rule → total |
| Info list | `.info-list` / `.info` | Icon + bold label + one line (payment source, delivery, expiry) |
| Banner | `.banner.err / .warn / .ok` | Insufficient balance (with `.short` breakdown), SMS failed |
| PIN | `.pin-dots` / `.keypad` | 4 dots, shake on error, delete key |
| Stage tracker | `.stages` / `.stage.active / .done / .fail / .undo` | Payment → Voucher → Delivery; refund shown on the payment step |
| Result | `.result` + `.badge.ok / .err / .warn` | Icon, headline, one-paragraph explanation |
| Facts | `.facts` / `.fact` | Label/value pairs; transaction ID with Copy |
| Refund timeline | `.tl` / `.tl-row.g / .r` | Paid → not issued → refunded (+ new balance) |
| Voucher code | `.ticket` + `.code-line` | Code on its own line, never truncated; **Copy code** or **Show code**; expiry with clock icon |
| Delivery chips | `.deliv` | SMS sent / not delivered · kept in the app |
| Status badge | `.st.active / .redeemed / .expired / .success / .failed / .refunded` | |
| Filter chips / segmented | `.chips` / `.seg` | Product filter (My Vouchers) / status (Transactions) |
| List item | `.item` (`.dim` for used/expired) | Voucher or transaction row |
| Empty state | `.empty` | Green icon circle, title, one line, CTA |
| Confirmation sheet | `.sheet-overlay` / `.sheet` | Resend SMS confirm → sending → failed/retry |
| Notification | `.notice` | App notification / SMS heads-up (dark green) |
| Buttons | `.btn`, `.btn.ghost`, `.btn.text` | One primary per screen; pill, 48px |

**Mini app ID:** green ticket logo, "Global Vouchers · M-PESA mini app", shown at the top of the ••• menu.

**Tokens:** green `#2FC56D` (action), dark green `#1E9E4F` (text/icons), red `#F0335F` (error), amber `#F08A12` (warning/refund), ink `#1c1c1c`, muted `#8a8a8a`, surface `#F6F8F7`, card radius 14px (up from 6–8px elsewhere), Barlow throughout.

---

## 5. Assumptions (labelled — not BRD rules)

| # | Assumption | Why |
|---|---|---|
| A1 | **Prices, fee, expiry are sample values**: 164.5 ETB/$1, 5 ETB fee per voucher, 12-month expiry. | The documents give one example only ($10 → 1,645 + 5) and an expiry placeholder `XXYYZZZZ`. |
| A2 | Expiry is shown **when the provider supplies one** — on Review, on the code, in My Vouchers. | Documents don't say whether every voucher expires. |
| A3 | The SMS goes to the **registered M-PESA number**, not editable; buying for someone else is out of scope. | The BRD/journey show a phone number but no entry step. |
| A4 | Balance is validated **on Review**, before the PIN (the flow document puts it between Review and PIN). | Same rule, earlier feedback, one less screen. |
| A5 | **Redeemed** status comes from the provider. | It appears only in the journey's reporting; how it's known isn't specified. |
| A6 | Codes are **masked in lists** and shown on tap in Voucher details, without re-entering the PIN. | BRD: codes only accessible to the purchaser. Masking is a UX safeguard, not a new rule. |
| A7 | Redemption steps, links and taglines for **Google Play**, **PUBG Mobile** and **Spotify** are placeholders; only Netflix's guide comes from the journey. | Need provider-approved copy and the official Ethiopia redeem URLs. |
| A8 | Help's contact options are labels only (no numbers/email). | The journey names *M-PESA Call Center* and *support email* without details. |

## 6. Open questions for product / business

1. **Spotify** — now included; update the BRD catalogue and confirm its denominations. (C1)
2. **Prices per product and denomination**, and is the 5 ETB fee flat or tiered? (C3, A1)
3. **PIN retry/lock** — how many attempts, what happens after? (Documents say: needs confirmation.)
4. **Code security** — should *Show code* in My Vouchers require the M-PESA PIN? (A6)
5. **Refund timing** — is the reversal instant (as shown) or can it be *pending*? If pending, add a *Refund in progress* state with an expected time.
6. **Redeemed status** — does Pincoon report redemption? If not, drop *Redeemed* and keep *Active / Expired*.
7. **Voucher Payment Report** — customer-facing or internal? (C7)
8. **Resend SMS limits** — any cap per voucher or per day?
9. **Official logos and product descriptions** from each partner.

## 7. Final UX audit — still open

- **Brand assets:** marks are placeholders; replace before any external review.
- **Accessibility:** decorative marks are hidden from screen readers; touch targets ≥ 40px; status is never colour-only (always a word). Colour contrast of the light-green *How it works* numerals should be checked in Figma.
- **Pending refund state** (Q5) and **PIN lock state** (Q3) aren't designed until the rules are confirmed.
- **Long product lists:** the home is a single list. Beyond about 8 products, add category chips (the card already carries a category).
- **Small screens:** tested at 360×760; the code line fits a 14-character code at 22px. Longer provider codes would need the font to step down.
