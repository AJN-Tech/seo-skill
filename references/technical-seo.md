# Technical SEO: crawl, index, canonicalise

Technical SEO is the set of conditions that let a crawler fetch the right URL, see
the intended content, and store it as the canonical page. Fix these first; content
and performance work is wasted on URLs that cannot be indexed correctly.

## How to inspect without a browser

```bash
# Status, headers, redirect chain (follow up to 5 hops)
curl -sSIL https://example.com/page | grep -Ei 'HTTP/|location|content-encoding|cache-control|x-robots-tag'

# Raw HTML (what a crawler sees without JavaScript)
curl -sL https://example.com/page | head -80

# robots and sitemap
curl -sS https://example.com/robots.txt
curl -sS https://example.com/sitemap.xml | head -40

# www / host consolidation
curl -sSIL https://www.example.com/ | head -12
curl -sSIL http://example.com/ | head -12
```

For a static build, audit `dist/` directly; the same checks work on files.

## Status codes and redirects

- 200: indexable candidate. 301: permanent move, preserve path and query, one hop.
- 302/307: temporary; do not use for host consolidation or URL migrations.
- 304: normal for conditional requests; not a crawl error.
- 404: keep for actually missing content; do not serve "soft 404" (200 + error copy).
- 410: removed permanently; acceptable alternative to 404 for deleted content.
- 5xx: fix before anything else; repeated 5xx damages crawl scheduling.

Common fixes:
- `www` → apex (or reverse) with a single 301 on the server/CDN, preserving
  `$request_uri`.
- `http` → `https` at the edge; never chain http→www→https.
- Trailing slash policy: choose one and redirect the other. For directory-style sites,
  `/dir/` is canonical and `/dir` 301s to `/dir/`.
- `/index.html` → `/` and `/dir/index.html` → `/dir/` (301).

## robots.txt semantics (do not confuse with noindex)

- `Disallow` stops crawling of matching paths; a URL can still be indexed if linked,
  because search engines may index the URL without content. Use `noindex` if the goal
  is removal from search results.
- Wildcards and `$` are supported by major crawlers; groups are matched to the most
  specific user-agent.
- Different crawlers have different rules for AI search vs training; write explicit
  groups (see `crawl-files.md`).
- robots.txt at a subdirectory is ignored by most crawlers; keep it at the host root.
- Never use robots.txt as security. Sensitive paths need auth, not `Disallow`.

## Canonicalisation

- Every indexable page needs an absolute, self-referencing canonical on the final URL.
- Canonical is a hint, not a directive; corroborate with sitemap, internal links,
  hreflang and 301s.
- Do not point many distinct pages at a page with different content; that is a signal
  to merge or differentiate, not to hide duplicates.
- Canonical must not conflict with hreflang: each localized page canonicalises to
  itself, not to the default language.
- Parameters (`?ref=`, `?sort=`, `?page=`) that produce identical content should be
  canonicalised, redirected, or blocked from crawling — choose one policy.

## Sitemaps

- One canonical URL per line (`<loc>`), absolute, 200 status, no redirects.
- Add `<lastmod>` only when it changes meaningfully; fake freshness erodes trust.
- For multilingual sites, include `<xhtml:link rel="alternate" hreflang="...">` per
  URL and an `x-default`.
- Split large sites into sitemap indexes; keep under 50k URLs / 50 MB uncompressed.
- Reference sitemap(s) in robots.txt and submit in Search Console.

## Indexability signals

- `<meta name="robots" content="noindex">` and `X-Robots-Tag` both work; use one.
- `noindex,follow` still allows link discovery but removes the page from results.
- Canonical to another URL plus `noindex` sends conflicting signals; pick one.
- Pagination: use crawlable links; do not rely on infinite scroll only.
- JavaScript-rendered content: confirm primary content appears in raw HTML. If it
  cannot, document the rendering dependency and test with the URL Inspection rendered
  HTML view.

## Crawl budget and architecture

Crawl budget matters mostly for large or frequently changing sites; small sites
should focus on eliminating errors and duplicates first.
- Keep important pages within 3 clicks of the homepage.
- Use descriptive internal links; avoid orphan pages.
- Remove or `noindex` empty tag/archive pages that add no value.
- Make sure navigation is crawlable HTML links, not only JS handlers.
- Check for parameter explosion (filters, calendars, session ids).

## Common failure patterns

| Symptom | Likely cause | Check |
| --- | --- | --- |
| Only one language indexed | client-side-only switch, missing localized URLs/hreflang | raw HTML per URL, hreflang reciprocity |
| Homepage indexed under two hosts | no host consolidation | `curl -I` both hosts |
| Pages "Discovered – currently not indexed" | thin/duplicate content or weak internal links | content n-grams, internal links |
| Canonical overrides everything | wrong canonical/hreflang target | canonical per page |
| Sitemap full of redirects/404s | generated before routing changes | validate every `<loc>` |
| New pages never crawled | orphan pages, blocked paths, no sitemap entry | crawl + robots + sitemap |
