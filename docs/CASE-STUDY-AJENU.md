# Case study: a four-language static site audit and implementation

This skill was extracted from a real engagement: a Haitian digital-services company with
a static site (custom Node build, four languages: Haitian Creole default at `/`, French,
English, Spanish). The starting point was an SEO audit; the work became a build-system
rewrite plus content expansion. The numbers below are from that project.

## Starting state (audit)

- 38 URLs checked (home + 37 service pages), all 200, unique titles/descriptions,
  self-canonicals and one H1 each — so the site looked "SEO healthy" at first glance.
- `robots.txt` returned 404 on both hosts.
- `www` and non-`www` both served 200; canonical/sitemap used the apex.
- All 38 pages declared `lang="ht"`; the French/English/Spanish versions existed only as
  a **client-side text swap** at the same URL, with no hreflang. Search engines could
  not see localized content.
- Service pages were thin: ~120 words in the English source; many lacked concrete
  deliverables, setup detail and FAQs.
- No Open Graph image anywhere.
- No Search Console baseline in the repo; performance unmeasured.

## What was implemented

1. **Real localized URLs**: 4 home pages + 148 service pages = 152 crawlable pages,
   server-rendered per language, with localized `<title>`, description, canonical,
   Open Graph, JSON-LD, and 5 hreflang links (4 languages + `x-default`).
2. **Crawl files generated from the same data**: sitemap with reciprocal
   `xhtml:link` alternates, robots.txt with AI search/training policy, llms.txt.
3. **Content depth**: every service gained "who it is for", deliverables, 3 setup
   steps and 2 FAQs in all four languages (~150–240 added English words/page).
   Deliberately **no invented client examples, prices, statistics or guarantees**.
4. **Social/structured data**: 32 branded 1200×630 OG previews (language × page type),
   Organization/WebSite/WebPage/Service/BreadcrumbList/FAQPage JSON-LD, localized
   `inLanguage` and FAQ text.
5. **Performance**: minified + inlined CSS/JS/i18n (no render-blocking request), responsive
   hero image (800w/1000w/1400w), per-language bundles, and a small production static
   server with brotli/gzip, ETag/304 and cache headers.
6. **Regression harness**: 161 checks covering every page (titles, canonicals, hreflang,
   OG, JSON-LD, links, assets), crawl files, deploy config and accessibility.

## What the verification caught

An independent read-only audit found that the **FAQPage JSON-LD was still English on 111
non-English pages** while the visible FAQ was translated — a real bug the first harness
missed because it only counted FAQ items. Fixing it and adding a text-match assertion
took minutes; without the second reviewer it would have shipped.

Lesson: a green test suite proves what it asserts, not what you meant. Compare rendered
text with structured data, not just presence.

## Numbers

| Metric | Before | After |
| --- | --- | --- |
| Crawlable localized URLs | 38 (one language) | 152 (four languages) |
| Service page English words | ~120 | ~314–508 visible |
| Hreflang | none | reciprocity checked on 152 pages |
| OG images | 0 | 32 |
| Build/verification | no verifier | 161 automated checks |
| First-load home (uncompressed) | 5 requests, 143 KB, 1 blocking | 2 requests, 94 KB, 0 blocking |
| First-load home (brotli) | — | ~32 KB |

## What remained a server task

The production host (nginx) did not send `Content-Encoding`, `Cache-Control` or a
`www` → apex 301. Those cannot be fixed from a repository that ships no server config.
The deliverable documented the exact directives and marked them `server`-owned instead of
claiming they were done.

## Reusable takeaways

- Audit the rendered URL set, not only the source templates.
- A language is a URL. Fix localization before writing more copy.
- Generate crawl files from the catalog; never hand-maintain them.
- Content depth is about intent and proof, not word count.
- Separate repo fixes from hosting fixes, with an owner per finding.
- Verify with a second, adversarial pass.
