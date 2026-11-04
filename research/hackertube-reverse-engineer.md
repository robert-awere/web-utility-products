# HackerTube (hackertube.org) — Reverse-Engineering Brief + Build Prompt

Status: RESEARCH · Date: 2026-11-04 · Branch: claude/hackertube-reverse-engineer-xnoqa9
Purpose: understand exactly what hackertube.org is, why it worked, where it is weak, and produce a single high-signal prompt that builds an independent, better-differentiated version inside this monorepo's rules (static HTML + vanilla JS, `sites/<slug>/`, own Vercel project).

Sourcing note: hackertube.org, Karpathy's blog, X and HN were all blocked by this session's network policy. Everything below is triangulated from search snippets, three YouTube walkthrough transcripts (dreadjordan, Hyperautomation Labs, 三少科技), AlternativeTo, and press coverage. Items marked (unverified) came from a single secondary source.

---

## 1. What it is

- Launched Saturday 2026-10-31 by Andrej Karpathy. Built in ~2 hours by talking to Claude Code (Opus 5.5, medium effort). He did three things by hand: created a YouTube Data API key in Google Cloud Console, rented a VPS, bought the domain and set DNS. Claude did server hardening, deploy and the app.
- Positioning line (his): "YouTube built from videos recommended by HN." Discovery layer only. Videos play from YouTube embeds; nothing is hosted.
- Scale: 6,454 videos, 150 topics, 39,834 labeled comments, 2007–2026. Average video ~39 min, average age ~8 years. Conference talks dominate.
- Reception: #2 on HN, ~2,500 points, ~560 comments; ~3M views on the X post. Dozens of clones within 72 hours (hackertube.app, hackertube.video, hacker-tube.net, OpenTube, an Apple TV app, books/Wikipedia/repos variants).

## 2. The data pipeline (the real product)

Funnel, in order:

1. Ingest every HN comment, 2007–2026 (~43M). Cheap, no LLM.
2. Keep comments containing a YouTube link AND at least 100 characters of actual text. Kills drive-by link drops.
3. Keep a video only if ≥3 distinct users mentioned it across ≥3 distinct calendar months. One fan cannot game it; one-day virality cannot game it. Output: ~40k comments.
4. LLM labeling (Sonnet, orchestrated by Opus via Claude Code workflow): each comment is classified as recommendation / neutral mention / joke / criticism, and each video is assigned one of ~150 topics (math, compilers, ML, etc.). Only ~40% of mentions were real recommendations. ~1,658 of the final 6,454 videos (25.7%) have no positive label and survived on mention count alone.
5. Enrich via YouTube Data API: title, channel, duration, publish date, availability.
6. Rank by number of distinct months a video was recommended. Not views, not likes, not upvotes. This is the whole thesis: durability of recommendation over time.

Cost (from Karpathy's own bill posted in the HN thread): >500M input tokens (excluding cache hits), 7.6M output tokens; >90% spent on Sonnet labeling; Opus used ~1M tokens total for pipeline, site and deploy. Rebuilding the site from his released data costs ~$0.60 and ~2 minutes per run.

Data release: one 17.8 MB zip, permissive open-data license requiring attribution, containing videos, comments, labels and an instructions file written for AI agents ("point your Claude at it and build your own"). The data file itself warns that a few percent of labels will be wrong. Server code was not released (he called it a mess).

## 3. UI and features (observed)

- YouTube-shaped grid. Familiar on purpose; zero learning curve.
- Thumbnails are the mid-video auto frame, not the creator's uploaded thumbnail. This single decision removes clickbait from the whole surface. Technical mechanism: YouTube serves auto-generated frames at `https://i.ytimg.com/vi/{id}/1.jpg|2.jpg|3.jpg` (≈25/50/75%), with `mq2.jpg`, `hq2.jpg`, `sd2.jpg` as larger variants. `hqdefault.jpg`/`maxresdefault.jpg` are the creator's choice. Clones that forget this reintroduce clickbait instantly (all three of Hyperautomation Labs' one-prompt rebuilds did).
- No accounts. Like and Watch Later live in the browser (localStorage). "For You" is computed client-side from those likes. Nothing is sent to a server.
- Video page: embedded player + the HN comments that recommended it, with dates and links back to the threads. This is the trust layer and the most defensible part of the UX.
- Tabs/sections: topics (150), "Longs" (talks over one hour), playlists such as "HN Canon" (the ~10 videos recommended most, year after year) and "learn deep learning from zero".
- Added after launch feedback: "Recently recommended" sort, duration filter, upload-date filter. Launch complaint was that the newest video was months old.
- Dark mode, share links, search. (unverified) "HackerTube Plus $5.99/mo" appeared in comments; treat as a joke.
- Badge-worthy fact: #1 overall is 3Blue1Brown's linear algebra series: 17 users, 18 distinct months.

## 4. Why it hit (strategist read)

- Named founder + a thesis people already believed ("YouTube's feed is slop") + a number that proves effort (43M → 6,454).
- The product is a mirror of the audience: HN users saw their own taste reflected back. Distribution and content source were the same community.
- Zero friction: no signup, no app, no ads, loads instantly, plays in place.
- Open data release turned critics into contributors and spawned a clone ecosystem that kept the name trending for days.
- The thumbnail decision is a visible, explainable design choice that every reviewer repeated. Give people one thing to say.

## 5. Weaknesses to exploit

- HN-shaped bias: conference talks, older content, thin coverage outside tech. "How does the economy work" returned one Dalio talk then drifted.
- Single source. Nothing from Lobsters, specific subreddits, Discords, newsletters, podcasts.
- Freshness: static snapshot; no scheduled re-ingest, no RSS/newsletter of newly-qualified videos.
- SEO: appears to be an app-shell SPA. Topic and video pages are not obviously indexable or shareable with rich previews. A static-rendered version with one page per video and per topic can own the long tail ("best videos to learn X recommended by engineers").
- No curricula. Playlists exist but there is no ordered "watch this, then this" path per topic.
- Label quality: a quarter of videos have no positive label; no confidence shown to the user.
- Prior art ignored (Skipvids.com, a 2025 HN post with 12 upvotes). Credit sources; it is cheap goodwill.
- Code closed, server-dependent. A fully static build is cheaper, faster, and survives the founder losing interest.

## 6. Differentiation options for "my own version"

Pick ONE axis; do not ship a generic clone.

- Source axis: a different community (Lobsters, r/netsec, r/MachineLearning, a Discord export, a newsletter archive) or multi-source fusion with per-source weighting.
- Vertical axis: literal "hacker" tube (security/CTF/reverse engineering), or finance-engineering, or hardware.
- Format axis: curricula (ordered learning paths with prerequisites) instead of a feed.
- Freshness axis: weekly re-ingest + "newly qualified this week" + RSS + email.
- Trust axis: show confidence, show the recommending quotes on the card, show months-recommended as the primary number.

---

## 7. THE PROMPT

Fill the four placeholders, paste the whole block into Claude Code (Opus-class model), and do not add anything else in the first message.

```text
ROLE
You are three people in one session: a senior prompt/systems engineer who writes specs that leave no decision to chance; a full-stack engineer who ships fully static, zero-server, zero-dependency sites that cannot be taken down or surveilled; and a YouTube growth strategist who knows exactly why hackertube.org went viral and what it failed to do. You build the complete product in this session. You do not ask clarifying questions; you state assumptions inline and keep going.

PLACEHOLDERS (resolve before any work)
SLUG        = {slug}                 e.g. signaltube
NICHE       = {niche}                e.g. "security engineering, reverse engineering, CTF, exploit dev"
SOURCES     = {sources}              e.g. "Hacker News (bigquery-public-data.hacker_news.full), Lobsters API, r/netsec via Pushshift/Arctic Shift dump"
DOMAIN      = {domain or 'TBD'}      do not buy, configure or assume it exists

MISSION
Build an independent, better-differentiated version of hackertube.org: a no-login, no-algorithm video discovery site whose entire catalog is YouTube videos that real people in SOURCES kept recommending to each other over years. Rank by durability of recommendation, not popularity. Differentiate on NICHE, freshness, SEO-indexable pages and ordered learning paths. Attribute Karpathy's HackerTube as prior art in the footer and README.

NON-NEGOTIABLE CONSTRAINTS (repo: robert-awere/web-utility-products)
1. All site files live in sites/SLUG/. Never touch any other sites/* folder. Spec goes to specs/SLUG.md. Build log entry goes to logs/build-notes.md.
2. Static HTML + vanilla JS + CSS. No framework, no bundler, no server, no runtime npm dependencies. The offline pipeline may be Python (stdlib + requests; sqlite3 allowed). Pipeline lives in sites/SLUG/pipeline/ and emits static JSON into sites/SLUG/data/. The site reads JSON; it never calls an API at runtime except YouTube's embed iframe.
3. No cookies, no tracking, no analytics, no third-party scripts except the YouTube iframe embed. User state (likes, watch-later, watched, progress) is localStorage only, with an export/import JSON button. Core browsing must work with localStorage blocked.
4. No YouTube creator thumbnails anywhere. Use the mid-video auto frame: https://i.ytimg.com/vi/{id}/mq2.jpg (fallback hq2.jpg, then 2.jpg). Add a comment in the code explaining why. This is a product decision, not a style choice.
5. Lighthouse mobile ≥95 on all four categories; zero console errors; fully usable at 360px; keyboard-operable; visible focus states; prefers-reduced-motion respected; initial page weight <200KB excluding the YouTube iframe and thumbnails; thumbnails lazy-loaded with width/height set.
6. Each utility gets its own Vercel project with Root Directory sites/SLUG, Framework Preset "Other", no build command. Do not create, modify or assume any Vercel project, domain or DNS. Produce a DEPLOY.md with the exact settings instead.
7. Do not insert ad code or publisher IDs. Reserve two empty, clearly commented ad slots: below the player on video pages and above the footer on index pages. Never between a thumbnail grid and its filters.
8. Licensing: the data output is CC BY 4.0 with attribution to the source communities and to Karpathy's HackerTube dataset if any of it is used. Comply with YouTube API ToS: refresh cached metadata at least every 30 days via the pipeline, link every embed to youtube.com, do not strip YouTube branding from the player.

PIPELINE SPEC (sites/SLUG/pipeline/, runnable end to end with `python3 -I run.py --since 2007-01-01`)
Stage A — ingest: pull every comment from SOURCES that contains a YouTube URL (youtube.com/watch, youtu.be, /shorts/, /live/, /embed/, with t= stripped and ids normalized to 11 chars). Store raw rows in sqlite: source, comment_id, thread_id, thread_title, author, created_at, text, video_id.
Stage B — hard filters, no LLM: drop comments with <100 characters of non-URL text; drop deleted/dead; drop authors with >40% of their video mentions pointing at one channel (self-promo). Keep a video only if ≥3 distinct authors mentioned it in ≥3 distinct calendar months. Report funnel counts at every stage.
Stage C — LLM labeling: for every surviving comment, one call returning strict JSON {stance: recommend|neutral|joke|criticize, confidence: 0-1, why: ≤140 chars quote-or-paraphrase, topic: one of TOPICS}. TOPICS is a fixed list of 60–150 slugs you generate from NICHE first and freeze before labeling. Use the cheapest model that passes a 50-item hand-labeled calibration set at ≥90% stance accuracy; batch 20 comments per call; cache by comment_id; total cost estimate printed before running; hard stop at a configurable dollar cap. Record the calibration set and its score in the README.
Stage D — enrich via YouTube Data API v3 videos.list (id, snippet, contentDetails, status), 50 ids per call: title, channel, channelId, publishedAt, duration (ISO8601→seconds), privacyStatus, embeddable, regionRestriction. Drop non-embeddable or removed videos but keep them in a tombstones.json for later revival.
Stage E — score: primary = distinct months with stance=recommend; tiebreak = distinct recommending authors; then recency of last recommendation. Compute per-video: months_recommended, recommenders, first_seen, last_seen, confidence = share of positive labels among mentions. Videos with zero positive labels are kept but flagged low_confidence and demoted below any positively labeled video.
Stage F — emit: data/videos.json (array, ≤1.5 MB; if larger, shard by topic into data/topics/{slug}.json plus data/index.json with id, title, channel, topic, months, duration, published, thumb); data/comments/{video_id}.json (the recommending quotes with date, author, source, thread URL); data/topics.json (slug, name, count, description); data/playlists.json; data/stats.json (funnel counts, generated_at). Deterministic ordering and stable ids so diffs are reviewable.
Stage G — freshness: `--since` incremental runs; a data/new.json of videos that crossed the 3-author/3-month threshold in the last 30 days; an RSS feed feed.xml of those. Document a cron suggestion; do not configure it.

SITE SPEC (sites/SLUG/)
Routes, all static files (pre-render with a Python script in pipeline/render.py, no client-side routing required for first paint):
- /                      grid, default sort "Most durable" (months_recommended), chips for sort: Most durable | Recently recommended | Newest upload | Longest. Filters: topic, duration (<20m / 20–60m / >60m), year. Search box with instant client-side search over a prebuilt data/search.json (title + channel + topic + why-quotes), ≤300 KB, loaded on first keystroke.
- /topic/{slug}/         same grid scoped to topic; H1 = topic name; 60–120 word topic description generated from the why-quotes; related topics.
- /video/{id}/           H1 = title; embed via youtube-nocookie.com iframe with loading=lazy and a click-to-load poster (the mid-frame) so no YouTube JS runs until the user clicks; below: months_recommended badge, recommender count, "Why people recommend it" list of quotes with date, source and link to the thread; next-in-path link if the video belongs to a playlist; share button (copies URL); Like / Watch later / Mark watched (localStorage).
- /longs/                videos >60 min.
- /paths/{slug}/         ordered learning paths (6–12 videos) for the top 8 topics in NICHE, each with a one-line "watch this because" and prerequisites; generate from scores + durations + publish order; mark completed items from localStorage.
- /new/                  newly qualified this month + link to feed.xml.
- /canon/                the 25 most durably recommended videos across all topics, one page, the shareable artifact.
- /for-you/              client-side only: topics weighted by likes and watched; empty-state copy explains it is computed in the browser and never leaves it.
- /about/                how it works (the funnel with real numbers from stats.json), the thumbnail decision, the ranking rule, data license, prior art credit, download link to data/.
- Every page: canonical, title <60 chars, meta description <155 chars, one H1, OG + Twitter card with the mid-frame image for video pages and a generated 1200×630 og-image for others, JSON-LD (VideoObject on video pages, ItemList on topic and canon pages, WebSite with SearchAction on home), sitemap.xml listing every route, robots.txt.
- Design: own identity; do not copy hackertube.org's look or YouTube's. Dark by default with a light toggle, system-font stack, 4px grid, one accent color. Card shows: mid-frame, duration pill, title (2-line clamp), channel, "recommended in N months" as the only number. No view counts anywhere. Buttons say what they do ("Save for later", not "Submit").
- Performance: inline critical CSS; one deferred app.js ≤25 KB; IntersectionObserver lazy images; no web fonts.

GROWTH SPEC (ship these, do not describe them)
- /canon/ and each /paths/ page must render a social-ready OG image and a copyable text summary ("25 videos engineers kept recommending for 18 years") for posting to the source communities on launch.
- feed.xml + a "new this month" page gives returning-visit reason; mention it in the footer.
- An embeddable badge snippet (static HTML, no JS) creators can paste: "Recommended on SLUG in N months".
- A data/ download page with license text, so clones cite you.
- Launch checklist in LAUNCH.md: post to the source communities with the canon page first; lead with the funnel number; name the thumbnail decision in the first sentence; credit prior art in the post body.

VALIDATION (must pass before you say done)
- Pipeline unit tests: URL normalization (8 cases incl. youtu.be, shorts, t=, playlist param), 3-author/3-month gate, duration parse, score tiebreaks, self-promo filter.
- Golden check: run the pipeline on a fixture of 200 comments and assert exact funnel counts.
- Site: Lighthouse mobile ≥95 ×4 on /, a topic page and a video page; zero console errors; all internal links resolve (write a link checker); sitemap matches rendered routes; JSON-LD validates; 360px screenshot of each route type; keyboard-only walkthrough from search to playing a video.
- Content: 5 spot-checks where you read the quotes on a video page and confirm the stance labels are right; list any wrong ones in build-notes.
- Repo: `git status`, `git diff --name-only` and `git diff --cached --name-only` show only sites/SLUG/**, specs/SLUG.md and logs/build-notes.md. Commit as "SLUG: <imperative summary>". Do not push to any other branch. Do not create a PR.

DELIVERABLES
specs/SLUG.md (the resolved spec with assumptions), sites/SLUG/** (site + pipeline + data + DEPLOY.md + LAUNCH.md + README.md with funnel numbers, calibration score, cost and license), logs/build-notes.md entry (date, slug, validation results, design notes, lessons, known limitations).

THINGS CLONES GOT WRONG (do not repeat)
Creator thumbnails crept back in. Mentions counted as recommendations (a books clone showed a hated book as "recommended by 651 people"). No recency sort at launch. App-shell SPA with no indexable pages. Dependence on a server one person pays for. No credit to prior art. Shipping a generic HN feed instead of a sharp niche.

Begin by printing the resolved placeholders, the frozen TOPICS list, the cost estimate for Stage C, and the funnel you expect. Then build.
```

---

## 8. Sources

- Karpathy blog post (blocked; title "HackerTube", karpathy.bearblog.dev/hacker-tube/) and X post 2116957135661945283, as quoted by coverage.
- HN thread 50319510 (blocked), as summarized by trendoday, infrasity, mastodon.social/@h4ckernews.
- Transcripts: youtube.com/watch?v=m1zidOdZdE4 (dreadjordan), JXDEuBa_yeg (Hyperautomation Labs: funnel, 3-author/3-month gate, 40% real recommendations, rebuild timing and cost, thumbnail regression), 2ZMe6d5s0z8 (三少科技: token bill, Opus/Sonnet split, 17.8 MB data zip, manual steps, video-page comments, criticisms).
- alternativeto.net/software/hackertube/about (feature list), startupfortune.com, cellcog.ai, explainx.ai, dev.to/jamilxt, dev.to/vishalmysore (OpenTube), github.com/Jnaina/hackertube-tvos, hackertube.app, hackertube.video, hacker-tube.net.
