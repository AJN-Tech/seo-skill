---
name: seo
description: "Audit, fix and verify SEO for real websites, especially multilingual and statically generated sites. Use for technical SEO (crawlability, indexability, canonicals, redirects, status codes, sitemaps, robots.txt), international SEO (localized URLs, reciprocal hreflang, x-default), on-page and content quality, structured data, Open Graph, llms.txt, Core Web Vitals and PageSpeed fixes, AI-crawler policy, and Search Console measurement. Trigger on: SEO audit, why isn't this page ranking, hreflang, sitemap, robots.txt, llms.txt, meta tags, og:image, schema markup, JSON-LD, canonical, redirects, indexing, crawl budget, Core Web Vitals, page speed, E-E-A-T, AI search, GEO. Not for paid ads, buying links, cloaking, doorway pages, keyword stuffing, or fabricated reviews and statistics."
license: MIT
compatibility: "Agent Skills clients that read SKILL.md: Claude Code, OpenAI Codex, OpenCode, DeepSeek Harness, Cursor, Gemini CLI, and any tool that scans .agents/skills. Scripts need Node.js 18+; the audit works offline on a build directory or against a live URL."
metadata:
  author: AJN-Tech
  version: "1.0.0"
  repository: https://github.com/AJN-Tech/seo-skill
  category: seo
---

# SEO: audit, fix, verify

This is an engineering skill, not a checklist generator. It turns an SEO request into
evidence, a prioritised fix list, implemented changes, and a verification pass. It was
built from a real multilingual audit and implementation (see `docs/CASE-STUDY-AJENU.md`).

## When to use

Use it when the user asks to audit a site, explain why pages are not ranking or
indexing, fix crawlability or metadata, add localized versions and hreflang, add
structured data or social previews, improve Core Web Vitals, write robots.txt /
sitemap / llms.txt, decide how AI crawlers should be treated, or set up Search Console
measurement.

Do **not** use it to promise rankings, buy links, cloak content, mass-publish
near-duplicate pages, invent reviews/statistics, or advise on paid ads. Say so plainly
and stop at the boundary.

## Prime directives

1. **Evidence first.** Every finding needs a URL, a status code, a header, a tag, or a
   quoted snippet. Never report "probably slow" or "likely duplicate" without a check.
2. **Never fabricate.** No invented client names, testimonials, prices, statistics,
   certifications, integrations or examples. If the audit asks for real customer proof,
   state that only the site owner can supply it.
3. **Separate what the repo can fix from what only the host can fix.** Compression,
   cache TTLs, CDN redirects and DNS are hosting tasks. Do not claim them as done when
   you only wrote code. Record the owner per finding: `code`, `content`, `server`,
   `external` (Search Console, DNS, third-party).
4. **Do not write meta tags to a character limit.** Titles must be accurate and unique;
   descriptions useful. Google rewrites snippets, so length is a craft guideline, not a
   publish gate.
5. **robots.txt controls crawling, not indexing.** To remove a page from search use
   `noindex` (or remove the page). `Disallow` alone can leave URL-only listings.
6. **Measure, then state caveats.** Lab tools (PageSpeed Insights, Lighthouse) and field
   data (CrUX, Search Console) disagree. Never invent a CWV score. If you could not
   measure, say which tool or credential was missing.
7. **Verify the finished work.** A fix list is not done until the rebuilt site passes a
   repeatable check (crawl all URLs, validate crawl files, re-run headers).

## Quick start

From this skill's directory (resolve it from the SKILL.md path your harness gave you):

```bash
# Audit a live site, a sitemap, or a local build directory.
node scripts/seo-audit.mjs audit https://example.com --json --out seo-report.json
node scripts/seo-audit.mjs audit ./dist --base https://example.com
node scripts/seo-audit.mjs page https://example.com/pricing
node scripts/seo-audit.mjs crawl-files https://example.com

# CI gate: exit non-zero if a critical or high finding exists.
node scripts/seo-audit.mjs audit ./dist --base https://example.com --fail-on high
```

The audit is dependency-free and read-only. It fetches politely (one page at a time,
bounded by `--max-pages`), accepts an input limit, and never submits forms or changes
state. If Node is unavailable, follow `references/audit-checklist.md` manually.

## Workflow

### Phase 0 — Scope and baseline

- Confirm the canonical host, the languages/markets that matter, and the business goal.
- Record the starting state: sitemap URL count, robots status, indexing tools
  available, analytics/Search Console access, last known Core Web Vitals.
- Ask for credentials or access only when the task genuinely needs them (Search
  Console, analytics, DNS). Otherwise mark the check as `not verifiable` and move on.

### Phase 1 — Inventory and crawl

- Find every public URL: sitemap(s), internal links, and a crawl of the homepage.
- For each page capture: status, indexability, title, description, canonical, `lang`,
  H1 count, structured data, Open Graph, hreflang, internal links, main-content word
  count, and rendered vs raw content differences.
- Flag duplicates by title, description, and normalized main-content n-grams.

### Phase 2 — Technical foundations

Fix in this order because everything else depends on it:

1. Status codes and redirects: no 5xx, no chains, no redirect loops; one canonical host
   (apex vs `www`) with a permanent 301 to the other.
2. Indexability: no accidental `noindex`, no `Disallow` on public paths, no soft 404s.
3. Canonicalisation: self-referencing absolute canonical on every indexable page; one
   URL per piece of content.
4. Sitemap: XML-valid, only canonical 200 URLs, hreflang alternates when localized,
   listed in robots.txt.
5. robots.txt: valid groups, explicit sitemap, a documented AI-crawler policy.
6. URL hygiene: trailing slashes consistent, `index.html` redirects, lowercase slugs,
   no parameters that duplicate content.

See `references/technical-seo.md` and `references/crawl-files.md`.

### Phase 3 — Internationalisation

A language must be a real URL, not a client-side text swap:

- Default language at the root, others under `/<lang>/` (or a consistent subdomain
  scheme). Server-render the translated text, title, description and canonical.
- Every localized page carries reciprocal `hreflang` for every version **plus
  `x-default`**, each pointing at the same content set.
- The sitemap repeats the alternates; the canonical stays self-referencing.
- `lang` matches the page language; `og:locale` and alternates are set.
- Translate search-relevant terms, not only navigation; keep terminology consistent.
- Legacy `?lang=` links should 301/redirect to the localized path; do not rely on
  `localStorage` or device-language redirects for crawlers.

See `references/internationalization.md`.

### Phase 4 — Content quality

Word count is not a ranking target; intent satisfaction is. For each priority page make
sure the reader can answer: who is this for, what exactly do I get, what does setup
involve, what happens next, what does it cost or depend on, and what proof exists.
Add FAQs only when they are real questions. Never publish 37 near-identical pages to
target keywords. See `references/content-quality.md`.

### Phase 5 — Structured data and social previews

- JSON-LD: `Organization` + `WebSite` + `WebPage` site-wide; add `Service`,
  `BreadcrumbList`, `FAQPage`, `Article`, `Product` only where they describe the page.
- Validate JSON parses and that visible content matches the schema (for example FAQ
  questions and answers). Localized pages must declare `inLanguage` and localized
  text.
- `og:image` must be a real 1200×630 (or 1.91:1) asset per page type; set
  `og:title`, `og:description`, `og:url`, `og:locale` (+ alternates), and a
  `twitter:card`. Missing images are a sharing loss, not a ranking penalty.

See `references/structured-data.md`.

### Phase 6 — Performance and Core Web Vitals

Work from measurements, not guesses:

- Remove render-blocking CSS/JS from the critical path (inline critical CSS, defer
  scripts, avoid chained requests). Prefer minified, self-hosted or inlined assets.
- Serve responsive images with `srcset`/`sizes`, correct `width`/`height`, modern
  formats, and `fetchpriority="high"` only on the LCP image.
- Enable compression (brotli/gzip) and long cache lifetimes for versioned assets on the
  server/CDN; HTML should revalidate.
- Set fonts to not block first render (`preload` + `noscript` or self-host).
- Measure mobile and desktop separately; report LCP, INP, CLS with tool and date.

Server headers and cache TTLs are `server`-owned findings. Document the exact
directives (nginx/Apache/Caddy/CDN) instead of pretending a repo change fixed them.
See `references/performance.md`.

### Phase 7 — AI search and crawler policy

Decide **separately** whether AI search/answer crawlers may crawl (usually yes, so the
site can be cited) and whether model-training crawlers may crawl (a publishing
decision). Encode the decision in robots.txt with explicit user-agent groups; explain in
the report that this is not access control and does not remove pages from search.

`llms.txt` is a small, maintained summary for AI tools: what the site does, who it
serves, and links to accurate public pages. It is not a replacement for the HTML, the
sitemap, or structured data. See `references/ai-search.md` and
`references/crawl-files.md`.

### Phase 8 — Measurement and reporting

Deliver a report with:

1. Scope, date, and what could not be measured.
2. A findings table sorted by severity (`critical`, `high`, `medium`, `low`) with
   evidence, why it matters, fix, owner, and how to validate.
3. A prioritised implementation plan (the first three fixes, not fifty).
4. Verification results after implementation: crawl counts, status codes, hreflang
   reciprocity, crawl-file validity, headers.
5. External follow-ups: Search Console property + sitemap submission, URL inspection,
   PageSpeed/CrUX, DNS, content only the client can supply.

Use `references/report-template.md`.

## Guardrails

- No cloaking, doorway pages, paid links, link farms, PBNs, snippet manipulation.
- No fake reviews, ratings, statistics, certifications, or "trusted by" logos.
- No keyword stuffing in titles, headings, alt text, or schema.
- No auto-redirect based on the visitor's device language that hides the canonical
  localized page from crawlers; offer a switcher instead.
- No `Disallow` for pages that must stay indexable; no `noindex` on pages you need.
- Do not present Lighthouse lab estimates as field Core Web Vitals.
- If a requested tactic would harm users or violate search policies, refuse that tactic
  and offer the compliant alternative.

## References

Load only what the task needs:

- `references/audit-checklist.md` — full pass/fail checklist by area.
- `references/technical-seo.md` — crawl, index, redirects, canonicals, status codes.
- `references/crawl-files.md` — robots.txt policies, sitemaps, llms.txt templates.
- `references/internationalization.md` — URL schemes, hreflang rules, pitfalls.
- `references/content-quality.md` — page purpose, sections, duplicate detection,
  reviewed translations, honest proof.
- `references/structured-data.md` — JSON-LD graph patterns and validation.
- `references/performance.md` — CWV, PSI, render path, images, server headers.
- `references/ai-search.md` — AI search vs training, llms.txt, measurement limits.
- `references/measurement.md` — Search Console, sitemap submission, KPIs, reporting.
- `references/report-template.md` — the deliverable format.
- `references/static-site-playbook.md` — build-time SEO architecture and regression
  harness for static/SSG sites.

## Scripts

`scripts/seo-audit.mjs` — read-only auditor. Supports live URLs and local build
directories. `--json` for agents/CI, `--out` to write a report, `--fail-on` for CI.
Findings include `severity`, `area`, `page`, `evidence`, `fix`, `owner`, and a
`validation` hint. Use `node scripts/seo-audit.mjs --help` for all options.

If a required check depends on credentials or a browser you do not have, say so in the
report instead of skipping silently.
