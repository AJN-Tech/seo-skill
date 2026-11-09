# SEO audit checklist

Use this when you cannot run the bundled script, or as the acceptance list after a
fix pass. Every item is evidence-based: capture the URL/response/tag, not an opinion.
Mark each as PASS, FAIL, WARN or NOT VERIFIABLE (with reason).

## 1. Crawl and status

- [ ] `robots.txt` returns 200, is valid, and does not block public paths.
- [ ] `robots.txt` declares the sitemap with an absolute URL.
- [ ] XML sitemap returns 200, parses as XML, and lists only canonical 200 URLs.
- [ ] No 5xx responses on pages linked from navigation or the sitemap.
- [ ] No redirect chains; permanent redirects use 301 and preserve path/query.
- [ ] One preferred host: `www` and non-`www` do not both serve 200; one 301s to the other.
- [ ] HTTP → HTTPS redirects to the final URL in one hop.
- [ ] `/index.html` and `/dir` canonicalise to `/` and `/dir/` (no duplicates).
- [ ] 404s return 404 (not 200 with "not found" content).
- [ ] `noindex`/`Disallow` appear only where intended.

## 2. Indexing and URL design

- [ ] Every indexable page has a self-referencing absolute `<link rel="canonical">`.
- [ ] Canonical and sitemap URL match exactly (scheme, host, path, trailing slash).
- [ ] Pagination, filters and sort parameters do not create indexable duplicates.
- [ ] One URL per language/version; localized URLs are not served only through JavaScript.
- [ ] Password-protected, staging and API paths are blocked (robots or auth) and not indexed.

## 3. Metadata

- [ ] `<title>` unique and accurate; not stuffed; brand added consistently.
- [ ] Meta description present where useful, unique, and honest (not a character-limit exercise).
- [ ] `<html lang>` present and correct; `dir` for RTL locales.
- [ ] Exactly one `<h1>` that matches the page's purpose; logical H2/H3 order.
- [ ] Open Graph: `og:title`, `og:description`, `og:url`, `og:type`, `og:image`
      (real asset, 1200×630 / 1.91:1), `og:locale` (+ alternates for localized pages).
- [ ] Twitter/X: `twitter:card` = `summary_large_image` where an image exists.

## 4. Content

- [ ] Each page has a clear audience, outcome and next action.
- [ ] No near-duplicate pages across services/locations/languages (compare n-grams).
- [ ] Thin pages (< ~150 words of main content) either earn their place or are merged.
- [ ] Claims are verifiable; no invented statistics, clients, guarantees or certifications.
- [ ] FAQs answer real questions; visible text matches FAQ schema where used.
- [ ] Images have alt text that describes the image; decorative images use `alt=""`.
- [ ] Internal links use descriptive anchors and relevant destinations.

## 5. Internationalization

- [ ] Every localized page links to all language versions + `x-default`, reciprocally.
- [ ] Hreflang uses valid codes (`en`, `pt-BR`), absolute URLs, and same-content sets.
- [ ] Canonical is self-referential on every language page (not the default language).
- [ ] Sitemap includes `xhtml:link` alternates (or a dedicated hreflang sitemap).
- [ ] `<html lang>` matches the URL language; localized title/description/OG exist.
- [ ] Search-relevant terminology is translated, not just navigation labels.
- [ ] The language switcher navigates to the localized URL; legacy `?lang=` links redirect.
- [ ] No automatic device-language redirect that hides the canonical page.

## 6. Structured data

- [ ] JSON-LD parses (`JSON.parse`), is served in the HTML, and is not duplicated.
- [ ] Types match the page (`Organization`, `WebSite`, `WebPage`, `Service`,
      `BreadcrumbList`, `FAQPage`, `Article`, `Product`, `LocalBusiness` as relevant).
- [ ] Required properties present; URLs/ids resolve; `inLanguage` on localized pages.
- [ ] Schema text matches the visible page (especially FAQs, ratings, prices).
- [ ] No fabricated ratings, reviews, aggregate counts or availability.

## 7. Performance and rendering

- [ ] Measure with PageSpeed Insights (mobile + desktop) and record LCP, INP, CLS,
      TTFB, FCP; note tool and date.
- [ ] No render-blocking stylesheet/script on the critical path (or documented tradeoff).
- [ ] LCP image: real `<img>`, responsive `srcset`/`sizes`, `width`/`height`,
      `fetchpriority="high"` on that image only.
- [ ] Images not larger than needed; modern formats (AVIF/WebP); lazy loading below fold.
- [ ] Fonts do not block first render; no invisible-text flash.
- [ ] Text compression (brotli/gzip) enabled on HTML/CSS/JS/JSON/SVG.
- [ ] Long cache TTLs for versioned assets; HTML revalidates.
- [ ] JS-rendered primary content is present in raw HTML (or documented as unavoidable).

## 8. Sharing and AI surface

- [ ] Social preview images exist and render correctly (test with a debugger).
- [ ] `robots.txt` AI policy is intentional: search/answer crawlers vs training crawlers.
- [ ] `llms.txt` (if used) is short, accurate, maintained, and links real pages.
- [ ] `noimageindex`/snippet directives are intentional.

## 9. Measurement

- [ ] Search Console domain property verified; sitemap submitted; no coverage spikes.
- [ ] URL Inspection run on homepage, top services, and each language home.
- [ ] Core Web Vitals report monitored; field data preferred over lab estimates.
- [ ] Baseline captured (indexed URLs, impressions, clicks, positions) before changes.
- [ ] Post-change verification scheduled (2–4 weeks) with a defined success metric.

## Acceptance rule

An audit is complete only when: (a) every FAIL has evidence + fix + owner, (b) the
top three fixes are implementable now, and (c) the verification method for each is
written down. Anything requiring credentials or DNS is marked `external` with the
exact steps.
