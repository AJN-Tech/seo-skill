# Measurement: Search Console, KPIs and honest reporting

Measurement turns an SEO opinion into a verifiable claim. Establish a baseline before
changes and a re-check date after them. If access is missing, mark the metric
`not verifiable` and explain what access would unlock it.

## Search Console setup

1. Add a **Domain property** for the apex domain. Verify with a DNS TXT record; this
   covers all protocols, subdomains and the `www` variant.
   (Alternative: URL-prefix property for `https://example.com/` with an HTML file or
   DNS record.)
2. **Sitemaps** → submit `https://example.com/sitemap.xml`. A sitemap reference in
   robots.txt helps discovery but submission is separate.
3. **URL Inspection** → inspect and request indexing for: homepage, top service/
   product pages, and one page per language. Confirm the canonical Google selected and
   that hreflang is detected.
4. **Pages** (indexing) → watch excluded reasons. Distinguish "not indexed yet" from
   "duplicate/soft 404/crawled – not indexed".
5. **Performance** → segment queries/pages/countries/devices. Track impressions,
   clicks, CTR, average position. Compare periods only with comparable seasonality.
6. **Core Web Vitals** → field data after traffic; use URL groups, not a single
   average.
7. **Settings → Crawl stats** → verify sitemap/robots responses are not 4xx/5xx.

Bing Webmaster Tools is a cheap second source; submit the same sitemap. IndexNow is an
option for instant URL notification where supported.

## What to baseline (before changes)

- Indexed URL count (by report/page group).
- Organic clicks/impressions for priority query clusters (90 days).
- Sitemap submitted/discovered counts and errors.
- Crawl stats response codes.
- Field CWV (p75 LCP/INP/CLS) if available.
- Current titles/descriptions/canonicals for priority pages (evidence snapshot).

## Success metrics by goal

| Goal | Metric | Caution |
| --- | --- | --- |
| Fix indexing | indexed valid pages, coverage errors | index counts include low-value pages |
| Win search demand | impressions + clicks for query cluster | seasonality; brand vs non-brand |
| Improve snippets | CTR at stable position | Google rewrites snippets |
| Localization | impressions/clicks per language | low volume early; allow weeks |
| Performance | field CWV p75 | lab scores are diagnostics only |
| AI visibility | sampled citations + AI referrer traffic | not a ranking metric |

## Reporting rules

- Always state the date range, property, and device/country filters.
- Use absolute numbers plus the delta; avoid percentages alone on tiny bases.
- Separate correlation from causation; algorithm updates and seasonality confound.
- When a check could not be run (no access, no quota, no Chrome), say so.
- Do not promise rankings, traffic, revenue or AI citations.

## Re-check cadence

- Technical fixes: verify same day (status codes, canonicals, hreflang, crawl files).
- Indexing changes: 1–4 weeks depending on site size.
- Content/CTR changes: 4–8 weeks.
- CWV: field data needs ~28 days of traffic; lab data immediately after deploy.

## Useful commands

```bash
# Confirm Google can see the canonical/hreflang you shipped
curl -sL https://example.com/fr/page/ | grep -E 'canonical|hreflang' | head

# Confirm the sitemap is reachable and complete
curl -sS https://example.com/sitemap.xml | grep -c '<loc>'

# Confirm host consolidation
curl -sSI https://www.example.com/ | head -6

# PSI API (optional; quota limited) for repeatable mobile measurements
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https%3A%2F%2Fexample.com%2F&strategy=mobile"
```

If the PSI API returns 429/quota errors, report that measurement was unavailable and use
Search Console's CWV report once field data exists.
