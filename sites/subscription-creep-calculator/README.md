# Subscription Creep Calculator

Free single-page tool that totals a list of subscriptions (weekly / monthly / quarterly / yearly billing) into monthly, yearly, daily and five-year costs.

- **Domain:** [subscriptioncreepcalculator.com](https://subscriptioncreepcalculator.com/)
- **Stack:** plain HTML/CSS/vanilla JS, no build step, no framework
- **Logic:** `calculator.js` exposes `SubscriptionCreep.summarize(items)` — pure functions, testable in Node
- **Pages:** `/` (calculator + guide + FAQ), `/about/`, `/privacy/`, `/terms/`, `/contact/`
- **SEO:** JSON-LD (WebApplication + FAQPage), Open Graph, canonical tags, `sitemap.xml`, `robots.txt`
- **Monetization:** Google AdSense (`ads.txt` in place); affiliate slot marked in `index.html` for subscription-management apps

## Local preview

```sh
python3 -m http.server 8080 --directory subscription-creep-calculator
```

## Test the calculation logic

```sh
node -e "const c = require('./subscription-creep-calculator/calculator.js'); console.log(c.summarize([{name:'Netflix', price: 17.99, cycle: 'monthly'}]))"
```
