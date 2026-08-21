# Build notes

Append one entry per site: date, slug, Lighthouse scores, design signature, what to reuse or avoid.

---

## 2026-08-21 — p2-auto-loan

**Lighthouse (mobile, default Slow-4G simulation):** Performance 99 · SEO 100 · Accessibility 100 · Best Practices 100. LCP 1.3s, CLS 0, TBT 120ms; interactive 0.4s on regular 4G (10 Mbps / 40 ms RTT, 4× CPU). Page weight 48KB before ads.

**Design signature:** "night dashboard" — deep indigo instrument-cluster result panel, amber needle-tick under the hero payment, road center-line divider (`hr.road`, repeating amber dashes on navy), tabular-numeral odometer digits. System font stack only (zero font requests).

**What worked, reuse:**
- Engine/DOM split (`calculator.js` pure math + `app.js` wiring) with a UMD-ish tail (`module.exports` when present) lets the *shipped* file run under Node — `test-cases.js` runs 54 assertions against the exact bytes deployed, no build step.
- Independent verification trick: solve for the payment by bisection on the raw balance recursion and compare to the closed form (matched to 6 decimals on 8 cases). Worth repeating on every finance site where the incumbent can't be fetched from the build environment.
- Building the state `<select>` from the data object at runtime keeps dropdown and tax table from drifting.
- Amortization as `<details>` per year (12-row tables in an `overflow-x:auto` scroller) is genuinely usable at 360px.
- Rounding convention: bill the cents-rounded payment, absorb the remainder in the final payment, cap the row loop at `months`. First draft produced a 61st payment on a 60-month loan — the reconciliation asserts (Σprincipal = P, Σinterest = total) caught it. Keep those asserts in every loan tool.

**What bit, avoid:**
- A generic `.prose p { color }` rule silently overrode the formula block's light-on-dark text → the only Lighthouse a11y failure (contrast 1.23). Scope prose color rules or they'll eat any dark inset block.
- calculator.net (and google.com) are blocked by the build proxy — live incumbent comparison must happen from the owner's machine; the numeric-solver check above is the in-session substitute.
- og-image as PNG of a gradient was 211KB; same frame as JPEG q82 is 44KB.

**Deployed:** merged to main (PR #3) and live on Vercel (own project, Root Directory `sites/p2-auto-loan`, no build command).

**Domain:** autoloanpayment.com purchased 2026-08-21 (Hostinger); canonical/OG/robots/sitemap swapped to .com.

**Open items for owner:** attach autoloanpayment.com in the Vercel project (Settings → Domains) + Hostinger DNS, GSC + sitemap submit, affiliate URL for the "Compare current auto loan rates" block, AdSense units into the three `.ad-slot` divs. Sibling sites' footers not yet updated to link back here (do together with next interlink pass).
