# Spec: speedflex — Internet Speed Test

Status: BUILDING · Target path: `sites/speedflex/`

Production URL: `https://www.speedflex.app/` — ASSUMED placeholder. Domain is not purchased or attached. Replace in canonical, OG, sitemap and robots before deploy.

## Goal

A free internet speed test that is leaner than speedtest.net (no ads before or during the result, no app nags, no account, no third-party trackers, page under 200KB) and built to be shared. It measures download, upload, idle latency, jitter and loaded latency (bufferbloat), then turns the numbers into something people want to post or send to a friend.

## Positioning

"Test it. Flex it." The speed test that tells you what your connection can actually do, and lets you challenge friends to beat it.

## Measurement backend

Static site with no server of its own. Measurements run in the browser against Cloudflare's public speed-test endpoints:

- `GET https://speed.cloudflare.com/__down?bytes=N` returns N bytes
- `POST https://speed.cloudflare.com/__up` accepts a request body
- `GET https://speed.cloudflare.com/meta` returns connection metadata (ISP, city, colo) when the browser can read it

OWNER APPROVAL REQUIRED: this is a third-party network dependency, and Cloudflare's terms for third-party use of these endpoints must be reviewed before launch. The base URL is a single constant in `engine.js`. A `?endpoint=` override is honoured only on localhost, for development against a mock server.

## Method

1. Meta: best-effort fetch of `/meta`. Failure is silent.
2. Idle latency: about 20 sequential zero-byte requests. Use Resource Timing where available (requestStart→responseStart, minus Server-Timing duration) and fall back to wall-clock. Report the median; jitter is the mean absolute difference between consecutive samples.
3. Download: parallel streams (up to 6) with request sizes that ramp up. Count bytes from the ReadableStream as they arrive. Throughput is sampled in rolling windows and the reported figure is the 90th percentile of stable windows. Time-capped at about 8s, and it can end early once stable.
4. Upload: parallel POSTs that ramp in size, with live progress through XHR `upload.onprogress`. Same aggregation and cap.
5. Loaded latency: pings run during download and upload. Bufferbloat grade comes from the latency increase under load: A+ <5ms, A <30, B <60, C <200, D <400, F otherwise.

The whole test should finish in about 12–25s. The UI states roughly how much data the test uses.

## Viral / differentiating features

1. Autostart on load (as fast.com does) with an obvious Stop/Restart control. A one-tap restart.
2. Speed persona: tier titles from download speed (e.g. "Dial-up Dinosaur" up to "Fiber Overlord"), shown with the result.
3. "What your connection can do": number of simultaneous 4K streams, HD video calls, gaming readiness (from latency and jitter), time to download a 50GB game and a 4K movie.
4. "Are you getting what you pay for?": optional plan-speed input that shows the % of plan delivered, plus a pre-written message to the ISP the user can copy.
5. Share card: a canvas-rendered PNG (1080×1350) with the numbers, persona and grade. Shared through the Web Share API (with the file) where supported, with a download fallback.
6. Challenge link: results are encoded in the URL hash (`#c=` base64url JSON with download, upload, ping, optional first name and timestamp). Nothing goes to a server. The recipient sees "Sam got 412 Mbps — can you beat it?", runs the test, and gets a head-to-head comparison that they can share back.
7. Local history of recent tests in localStorage, as a convenience only and wrapped in try/catch. Core function never depends on it.

## Content / SEO

- Head term: "internet speed test" · secondary: "wifi speed test", "speed test"
- Long-tails (H2s/FAQ): "what is a good internet speed", "what is ping / latency", "what is bufferbloat", "why is my internet slower than what I pay for", "how much speed do I need for 4K streaming / gaming / working from home", "upload vs download speed"
- Title: `Internet Speed Test — Fast, Free, No Ads | SpeedFlex`
- Explainer content below the tool covering method, assumptions and limitations (results depend on the device, Wi-Fi, browser and the Cloudflare edge; this is not a certified measurement).
- JSON-LD: WebApplication + FAQPage, with the FAQ text matching the visible copy.
- About, Privacy and Terms pages. Sitemap and robots.

## Constraints

Static HTML, CSS and vanilla JS. No dependencies, no external fonts, no tracking. Mobile-first, usable at 360px, keyboard-operable, `prefers-reduced-motion` respected. Ad placeholders only below the result, never between the start control and the numbers.
