# PROJECT-RULES.md — Web Utility Products

Shared build standard for every agent working in:

robert-awere/web-utility-products

This repository is a monorepo of single-purpose web utility sites.

Repository safety, site isolation, Git checks, Vercel root-directory rules
and domain safety are defined in AGENTS.md.

Read and obey AGENTS.md before making repository changes.

## Repository structure

/sites/<slug>/          one folder per utility, self-contained and independently deployable
  index.html            main tool page
  /assets/              images, favicon, og-image
  sitemap.xml
  robots.txt

/specs/<slug>.md        specification for the utility
/research/              market and keyword research
/shared/                reusable boilerplate/snippets
/logs/build-notes.md    record build results and lessons

All utilities MUST live under:

sites/<slug>/

Never create a utility at repository root.

## Stack

- Static HTML + vanilla JavaScript + CSS.
- No framework, bundler, server or build step unless explicitly approved.
- Core calculations run client-side.
- One index.html per main utility page.
- No unnecessary external JavaScript dependencies.
- Core functionality must not require cookies or localStorage.
- No tracking unless explicitly approved.

## Per-site workflow

1. SPEC
Read /specs/<slug>.md.
If missing or materially unclear, stop and ask.

2. BUILD
Create the utility only inside:

sites/<slug>/

3. VALIDATE
Pass all applicable quality checks below.

4. DEPLOY
Each utility gets its own Vercel project.

Required Vercel Root Directory:

sites/<slug>

Framework Preset:

Other

For static utilities:
- no build command
- no output-directory override unless required

5. DOMAIN
Do not assume a domain is available, purchased or attached.
Domain and DNS changes require explicit approval.

6. INDEX
Generate sitemap.xml and robots.txt.
Search Console actions remain owner-controlled unless explicitly delegated.

7. MONETIZE
Include AdSense placeholders only where appropriate.
Do not insert publisher credentials without approval.

8. LOG
Record:
- date
- slug
- validation results
- design notes
- useful lessons
- known limitations

## Quality gates

Before production deployment:

- Lighthouse mobile target >=95:
  - Performance
  - SEO
  - Accessibility
  - Best Practices

- Validate formulas with at least 5 test cases.
- Zero console errors.
- No broken internal links.
- Fully usable at 360px width.
- Keyboard-operable.
- Visible focus states.
- Respect prefers-reduced-motion where motion exists.
- Target page weight below 200KB before ads where practical.
- Use valid structured data where relevant.

## SEO requirements

Every production utility should include where applicable:

- title under 60 characters
- useful meta description under 155 characters
- one H1
- relevant H2s
- useful explainer content below the tool
- worked example
- assumptions and limitations
- FAQ where search intent supports it
- canonical URL
- Open Graph metadata
- appropriate OG image
- internal links to relevant sibling utilities

For finance, health or legal utilities:

- cite formula/data sources
- display an appropriate disclaimer
- show assumptions openly
- show the data/rate year
- isolate time-sensitive rates/rules in one clearly marked data section

## Design rules

- Every utility gets its own visual identity.
- Do not copy another site's design wholesale.
- Tool should appear above the fold where practical.
- Results should be prominent.
- Compute on input when appropriate.
- Do not place ads between input and result.
- Mobile-first.
- Use plain language.
- Buttons should state the action, e.g. "Calculate payment", not "Submit".

## General conventions

- One utility per commit/push batch.
- Preferred commit format:

<slug>: <imperative summary>

- Do not add dependencies, tracking scripts or third-party embeds without approval.
- Keep each utility self-contained.
- Preserve existing production behavior unless the task explicitly requires a change.
- Shared files may be copied into a utility, but production utilities should not depend on runtime imports from /shared.

## Conflict handling

If PROJECT-RULES.md conflicts with AGENTS.md:

AGENTS.md wins for repository safety, deployment isolation and domain protection.

If a requested task cannot comply with these rules, stop and explain the conflict before proceeding.
