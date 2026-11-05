# Spec: reading-speed-test — Paywall (Free / Plus / Lifetime)

Status: DRAFT — awaiting owner approval · TARGET_SITE=sites/reading-speed-test · Created 2026-11-05
Depends on: specs/reading-speed-test.md (the free tool, shipped on branch claude/reading-speed-test)

## 0. Stack exception required (approve before build)

PROJECT-RULES.md forbids servers, build steps and required cookies/localStorage.
A paywall cannot exist without identity and payments, so this spec asks for a
scoped exception, limited to:

- Vercel serverless functions in `sites/reading-speed-test/api/` (Node runtime,
  no bundler, no framework). Framework Preset stays "Other"; static files are
  still served as-is.
- One key-value store (Upstash Redis via the Vercel Marketplace) for
  entitlements, monthly usage counters and paid-user history.
- One payment provider acting as merchant of record (Lemon Squeezy recommended;
  Paddle is the fallback). Checkout runs on their hosted overlay, never on our
  pages, so no card data touches the site.
- `localStorage` for the licence key, the cached entitlement token and the
  free-tier counter. The free test itself must still work with storage disabled
  (fail open: no storage = no cap, no ads suppression).

Secrets (provider API key, webhook secret, KV credentials) live only in the
Vercel project's environment variables. Nothing secret enters the repo.

## 1. Principles

1. The viral loop stays free. A challenge link (`?p=&wpm=&c=`) always opens and
   always runs, cap or no cap, because that visit is the acquisition channel.
2. Count is the secondary limit. People do not pay for "more reads" of a
   90-second test; they pay for no ads, progress over time, more material and
   their own text. The read caps exist to nudge, not to fence.
3. Fail open. API down, provider down, storage blocked: the free tier keeps
   working and paid users keep their cached entitlement for 72 hours.
4. No accounts. A licence key is the identity. No passwords, no email login.
5. Everything indexable stays free: the tool, the explainer, the FAQ, guides,
   pricing. No cloaking, no content behind the wall that search sees.

## 2. Tiers

| | Free | Plus (monthly or yearly) | Lifetime |
|---|---|---|---|
| Ads | AdSense slots active | None | None |
| Completed tests | 3 per UTC day (soft, client-side) | 100 per calendar month (server-counted) | Unlimited |
| Passages | Standard set (6) | Standard + Easy + Hard packs (6 each) | All packs, plus new packs as added |
| Your own text | No | Yes: paste up to 2,000 words, auto-generated quiz off, timer + WPM only | Yes |
| History and progress chart | No | Last 200 results, synced by key across devices | Same |
| Printable certificate (PDF) | No | Yes | Yes |
| Challenge links | Yes | Yes | Yes |
| Devices (key activations) | n/a | 3 | 5 |

A "completed test" is a shown result. Starting and abandoning never burns a read.
Invalid results (under 5 seconds) never count.

Suggested prices, owner decides: Plus $2.99/month or $19/year; Lifetime $29.
Rationale: this is an impulse-tier product; lifetime must be under two years of
monthly to feel obviously fair, and the yearly must undercut 12 months by ~45%
so it becomes the default choice.

## 3. Payments: Lemon Squeezy as merchant of record

Why MoR: it collects and remits VAT/GST/US sales tax worldwide, handles
subscriptions, refunds and chargebacks, issues and validates licence keys, and
needs zero tax setup from the owner. Cost ~5% + $0.50 per transaction. Stripe
direct is cheaper per sale but makes the owner the tax filer in every
jurisdiction; not worth it at this scale.

Products (created by the owner in the provider dashboard, IDs placed in a
single `PLANS` object in `api/_config.js`):
- `plus-monthly` (subscription), `plus-yearly` (subscription), `lifetime`
  (one-time). Licence keys enabled on all three; activation limit 3 / 3 / 5.

Checkout: provider overlay opened from the pricing card
(`https://<store>.lemonsqueezy.com/checkout/buy/<variant>?embed=1`). Success
redirect: `/activate/?key=<licence>` so the key lands in the site without the
buyer retyping it. The provider also emails the key, which is the "restore
purchase" path on another device.

## 4. Architecture

```
browser (static site)                    Vercel functions                 external
----------------------                   ----------------------            ----------------
Start/Done/Result flow  ──none──>        (free tier never calls the API)
Enter key / success URL ──POST──>        /api/activate   ──validate+activate──> provider licence API
                                            └─ KV: entitlement{key} = {tier, status, renews_at, activations}
                                            └─ returns signed token {tier, exp: +24h, kid}
Result shown (paid)     ──POST──>        /api/complete   ──> KV INCR usage:{key}:{YYYY-MM}; returns remaining
                                            └─ 429 when Plus cap reached (Lifetime never)
History load/save       ──GET/POST──>    /api/history    ──> KV list history:{key} (cap 200, oldest trimmed)
Premium passages        ──GET──>         /api/passages?pack=hard  (token required; packs are NOT shipped in static JS)
Own-text test           ──none──>        runs client-side; UI gated by token (soft gate, acknowledged)
Certificate             ──none──>        drawn client-side on canvas/PDF; UI gated by token (soft gate)
provider webhook        ──POST──>        /api/webhook    ──HMAC verify──> KV update: cancelled/expired/refunded/resumed
```

Token: HMAC-SHA256 over `{key_hash, tier, exp}` with a server secret; 24-hour
expiry; the client refreshes silently on load when under 12 hours remain and
keeps using an expired token for up to 72 hours if the API is unreachable
(fail open). The token never contains the raw key; the key itself is sent only
to `/api/activate` and `/api/complete`.

What is truly enforced server-side: ad-free (ads load only when no valid
token; a forged token merely removes ads, which costs us nothing), premium
passage packs, history, the Plus monthly cap. What is soft: the free daily cap,
own-text mode, certificate. Document this honestly in code comments; do not
add obfuscation.

Storage keys (client): `rst-license` (string), `rst-token` (JSON),
`rst-free` (`{day:"YYYY-MM-DD", count:n}`), existing `rst-best` unchanged.

## 5. Flows

**Free user hits the cap.** Third result of the day shows normally. On the
fourth Start, the passage card is replaced by an upgrade card: what you get,
the two prices, "Continue free tomorrow", and a line that challenge links still
work. The explainer and everything below remain visible. Storage unavailable →
no cap.

**Upgrade.** Pricing card → provider overlay → pay → redirect to
`/activate/?key=…` → `/api/activate` → "You're on Plus. Ads are off on this
device." → return to `/`. Key is saved; ad slots are removed from the DOM
before the AdSense loader would run (the loader is injected by JS only when no
valid token exists, so no ad request is ever made for paid users).

**Another device.** `/activate/` has a key field; paste the emailed key.
Activation count enforced by the provider; friendly error on the 4th device
with a link to the provider's customer portal to deactivate an old one.

**Subscription lapses.** Webhook marks the key `expired`; the next token
refresh returns tier Free; cached token survives at most 72 hours, then the
device is Free again. 3-day grace is handled by the provider's own dunning.
Refund or chargeback: same path, immediately.

**Plus monthly cap reached.** Result still shows (never swallow a finished
test). Banner: "That's 100 this month, resets on the 1st; Lifetime removes the
cap." Counter is calendar month, UTC.

**Manage / cancel.** Link to the provider customer portal from `/activate/`
and from the footer when a key is present. We never build billing UI.

## 6. Pages and UI changes (all within TARGET_SITE)

- `/pricing/index.html`: three cards, FAQ (billing questions), links to terms
  and refund policy. Indexable. Also a compact pricing strip at the bottom of
  the result card on `/` for free users (never between quiz and result).
- `/activate/index.html`: key entry, status, device list link, portal link.
- `/terms/index.html` (new; the site has none) and a refund policy section:
  the provider requires both. 14-day no-questions refund on Lifetime and the
  first subscription charge is the recommended default.
- `/privacy/index.html` update: licence key and usage counters stored
  server-side; history stored only for paid users and deletable from
  `/activate/`; retention 24 months after expiry then purged; still no cookies.
- `index.html` / `app.js`: entitlement bootstrap, ad loader gating, free
  counter, upgrade card, pack selector, own-text mode, history panel,
  certificate button. Keep `engine.js` pure; add `entitlement.js` (client)
  with its own node-runnable tests.
- Ad slots: unchanged positions; rendered only when `tier === 'free'`.

## 7. Compliance and policy

- AdSense: showing no ads to paying users is allowed; do not show ads on
  `/activate/` or `/pricing/`. Keep the "nothing sent" header claim accurate:
  change to "nothing sent unless you upgrade".
- Tax, invoices, VAT IDs, EU consumer withdrawal rights: provider handles.
- Consumer protection: price, renewal terms and cancel path visible on the
  pricing card before checkout; yearly renewal reminder is the provider's.
- GDPR: lawful basis is contract; data subject deletion = delete `history:{key}`
  and `entitlement:{key}` on request via the support email; document it.
- Accessibility and performance gates from PROJECT-RULES still apply to every
  new page; the API adds zero weight to the free first paint (bootstrap runs
  after the result flow is interactive and only if a key is present).

## 8. Risks and honest limits

- Soft gates are soft. Anyone can bypass the free cap in a private window.
  Accepted: the free tier's job is conversion, not containment.
- Key sharing is bounded by activation limits, not prevented.
- Serverless cold starts add ~200–500ms to activation and history calls; the
  test flow itself never waits on the API (completion is fire-and-forget with
  the 429 handled after the result is already on screen).
- Provider lock-in is mild: entitlements are mirrored in our KV, so switching
  means re-issuing keys, not losing customers.
- Willingness to pay is unproven. Ship Phase 1 and watch conversion before
  building Phases 2–3.

## 9. Build phases

1. **Phase 1 — sell it:** pricing page, provider checkout, `/activate/`,
   `/api/activate`, `/api/webhook`, token, ad gating, terms and privacy
   updates, Lifetime = unlimited, Plus = unlimited for now. Measurable in a
   week: visits → pricing views → purchases (provider dashboard only).
2. **Phase 2 — meter and retain:** `/api/complete`, monthly cap, free daily
   cap and upgrade card, history + progress chart, certificate.
3. **Phase 3 — more to read:** Easy and Hard packs via `/api/passages`,
   own-text mode. Content agent writes 12 new passages with quizzes.

## 10. Test cases (node-runnable where pure, Playwright for flows)

1. Token sign/verify round trip; tampered tier → invalid; expired → invalid;
   expired within 72h with API unreachable → accepted by client only.
2. Free counter: 3 results allowed, 4th Start shows upgrade card; counter
   resets at UTC midnight; challenge-link visit bypasses the cap; storage
   throwing → cap disabled, no console errors.
3. `/api/complete`: 100th Plus call returns remaining 0, 101st returns 429 and
   the result still renders; Lifetime never 429s; month key rolls over.
4. Webhook: valid HMAC + `subscription_expired` → entitlement expired → next
   activate returns Free; invalid HMAC → 401 and no state change.
5. Ads: free tier injects the loader once; paid tier never requests
   `pagead2.googlesyndication.com` (assert zero such requests in Playwright).
6. Activation limit: 4th device → friendly error with portal link.
7. Lighthouse mobile ≥95 ×4 on `/`, `/pricing/`, `/activate/` with the
   entitlement script present and no key stored.

## 11. Owner decisions and setup checklist

Decisions: provider (Lemon Squeezy vs Paddle) · prices · free cap (3/day
proposed) · Plus cap (100/month proposed) · refund window (14 days proposed) ·
support email for the terms page · approve the stack exception in §0.

Setup (owner, ~1 hour): create provider store + 3 products with licence keys ·
add Upstash Redis to the Vercel project · set env vars
`LS_API_KEY`, `LS_WEBHOOK_SECRET`, `LS_STORE_ID`, `TOKEN_SECRET`,
`KV_REST_API_URL`, `KV_REST_API_TOKEN` · point the provider webhook at
`https://<domain>/api/webhook` · domain must exist first (currently the
placeholder `readingspeedtest.example`).

## 12. Out of scope (for now)

User accounts, teams or classroom licences (a real B2B angle for later:
teachers tracking a class), gifting, coupons beyond what the provider UI
offers, native apps, A/B pricing tests, analytics beyond the provider
dashboard and anonymous KV counters of cap-hits and pricing views.

## Definition of done (per phase)

All quality gates in PROJECT-RULES.md on every new page · phase test cases
pass · no secrets in the repo · privacy and terms updated · build-notes entry ·
owner has completed the checklist in §11 before Phase 1 goes to production.
