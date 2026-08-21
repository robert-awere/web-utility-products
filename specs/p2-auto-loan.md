# Spec: p2-auto-loan — Auto Loan / Car Payment Calculator

Status: READY TO BUILD · Priority: Site 1 · Composite score 4.7 (research: /research/aug2026-utility-list.md)

## Goal
Single-page auto loan calculator that beats calculator.net/bankrate/nerdwallet on the specifics they under-serve: trade-in handling, sales-tax-by-state, and a mobile-usable amortization schedule. Instant results, no signup, no server.

## Incumbents (validate outputs against)
- calculator.net/auto-loan-calculator.html (primary reference — match its math)
- bankrate.com auto loan calculator
- nerdwallet.com auto loan calculator

## Core math
Monthly payment: `M = P × r(1+r)^n / ((1+r)^n − 1)` where P = amount financed, r = APR/12, n = months. Handle r = 0 (M = P/n).

Amount financed pipeline:
```
taxable = vehiclePrice − tradeInValue*   (*most states tax price minus trade-in; some tax full price — flag per state)
salesTax = taxable × stateRate
P = vehiclePrice + salesTax + fees − tradeInValue − downPayment + tradeInPayoff(if rolling negative equity)
```
Outputs: monthly payment (hero number), total loan cost, total interest, payoff date, full amortization schedule (month, payment, principal, interest, balance).

State sales-tax data: one JS object `STATE_TAX_2026 = {AL: {...}, ...}` with rate + `taxesTradeIn: bool`, labeled "2026 rates" in UI, sourced/cited in a comment. Include "no state tax" entries (AK, DE, MT, NH, OR).

## Inputs
Vehicle price · down payment · trade-in value · amount owed on trade-in · state (dropdown → auto tax rate, editable override) · fees · APR · term (12–96 months, common presets 36/48/60/72/84) · optional: monthly extra payment (recompute payoff date + interest saved — differentiator, incumbents bury this).

Compute live on input change. No submit button.

## Differentiators (the 3 wins)
1. Trade-in with negative-equity rollover, done correctly per state tax treatment.
2. Tax-by-state built in (incumbents make users look it up).
3. Amortization schedule that works at 360px: collapsible year groups, not a giant table.

## Keyword map
- Head (title/H1): "auto loan calculator" · secondary: "car payment calculator"
- Long-tails (H2s/FAQ, verbatim): "auto loan calculator with trade in and tax" · "car payment calculator with extra payments" · "how much car can I afford" (link-out teaser only) · "auto loan calculator with negative equity" · "72 month car loan calculator"
- Title: "Auto Loan Calculator — Payment with Trade-In & Tax (2026)" · Meta desc: instant monthly payment incl. trade-in, state sales tax, fees; free, no signup.

## Content (below tool, 400–700 words)
How the payment formula works (show it) · worked example ($32,000 car, $4,000 trade-in, TX, 60mo @ 6.9%) · how trade-ins reduce (or don't reduce) taxable amount by state · why total interest matters more than monthly payment · assumptions/limitations + "estimate, not financial advice" disclaimer. FAQ (5): the long-tails above phrased as questions + "is it better to put money down or trade in?"

## Schema
WebApplication + FAQPage JSON-LD. Canonical, OG tags, og-image.

## Monetization
- Ad slots (empty divs): below result card · mid-explainer · above footer. Never between inputs and result.
- Affiliate fallback at launch: one "Compare current auto loan rates" outbound link block below result (owner supplies affiliate URL; placeholder `#` until then, clearly commented).

## Domain
**SECURED (2026-08-21): autoloanpayment.com** — owner purchased the .com (registrar: Hostinger; better trust/recall for a mainstream US finance audience than the researched .io candidates). Original candidates: autoloanpayment.io · carpaymentcalc.io.

## Test cases (document in code comment, verify vs calculator.net)
1. $30,000, $0 down, 0% tax, 6% APR, 60mo → M ≈ $579.98
2. $30,000, 60mo, 0% APR → M = $500.00 exactly (r=0 branch)
3. $32,000, $4,000 trade-in, TX 6.25% (taxes price minus trade-in), $2,000 down, 6.9%, 60mo
4. Negative equity: trade-in $5,000, owed $8,000 → $3,000 rolled into P
5. Extra $100/mo on case 1 → payoff month and interest saved both shrink; schedule sums reconcile with totals

## Definition of done
All CLAUDE.md quality gates pass · 5 test cases verified · deployed to Vercel · build-notes entry logged.
