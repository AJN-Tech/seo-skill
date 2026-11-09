# Performance and Core Web Vitals

Performance work starts and ends with measurement. There are two kinds of data:

- **Field data** (CrUX, Search Console Core Web Vitals): real users, 28-day rolling.
  This is what "Core Web Vitals" means for ranking.
- **Lab data** (Lighthouse, PageSpeed Insights analysis): synthetic, reproducible,
  useful for diagnosis. Never present it as the field score.

Record the tool, strategy (mobile/desktop), URL, date, and the four metrics: LCP, INP,
CLS, plus TTFB. If a metric cannot be measured (no Chrome, no CrUX, no PSI quota), say
so explicitly.

## Interpreting PageSpeed Insights / Lighthouse findings

| Audit | Meaning | Usual fix |
| --- | --- | --- |
| Render-blocking requests | CSS/JS in the critical path delays first paint | inline critical CSS, defer scripts, remove unused requests |
| Unused CSS/JS | bytes downloaded but not needed at load | split per page/route, drop dead code, inline only what is used |
| Efficient cache lifetimes | assets cached too briefly for repeat visits | `Cache-Control: public, max-age=31536000, immutable` for versioned assets |
| No compression | text shipped uncompressed | brotli/gzip at server/CDN (HTML/CSS/JS/JSON/SVG) |
| Network dependency tree | long chain of dependent requests | flatten chains; preload the LCP image; inline small critical assets |
| Improve image delivery | image larger than displayed, or legacy format | `srcset`/`sizes`, AVIF/WebP, correct dimensions |
| Minify CSS/JS | whitespace/comments shipped | minify at build |
| LCP image not preloaded | slow start for the largest paint | `<link rel="preload" as="image" imagesrcset=... imagesizes=...>` |
| Font display / render blocking | invisible text or blocked text | `font-display: swap`, preload woff2, self-host |
| CLS from images/ads | layout shift | `width`/`height`, reserved ad slots, no injected banners above content |

Savings shown by Lighthouse are estimates; implement, then re-measure under the same
conditions. Some audits (compression, cache TTL) are **server/CDN-owned** — document the
exact directives for the hosting stack rather than claiming a repository change fixed
them.

## Critical path strategy (static/SSG sites)

1. Inline the CSS/JS that the first screen needs, or serve one small critical
   stylesheet; defer the rest.
2. Avoid chained requests: HTML → CSS → font; HTML → JS → API. Flatten what you can.
3. Preload the LCP image with responsive attributes; mark only that image
   `fetchpriority="high"`.
4. Serve responsive images (`srcset` + `sizes`) and modern formats; never scale a
   1400 px file into a 796 px slot.
5. Minify and cache-bust versioned assets; set long TTLs only when the URL changes with
   the content (hash in filename or query).
6. Compress at the edge. A 80 KB HTML page is ~20 KB with brotli; without compression
   every byte is paid on every request.
7. Keep third-party scripts out of the critical path; load analytics deferred and
   measure their cost.

## Server header examples (owner: server)

nginx:

```nginx
gzip on;
gzip_types text/css application/javascript application/json application/xml image/svg+xml;
location ~* \.(?:webp|png|svg|ico|woff2)$ {
  add_header Cache-Control "public, max-age=31536000";
}
location ~* \.(?:css|js)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
```

Apache:

```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/webp "access plus 1 year"
  ExpiresByType text/css "access plus 1 year"
</IfModule>
```

Caddy:

```caddy
encode gzip zstd
header /assets/* Cache-Control "public, max-age=31536000"
```

Cloudflare/CDN: enable Brotli, set a cache rule for `/assets/*` (long TTL) and a
revalidation rule for HTML. Verify with `curl -sI` that `content-encoding` and
`cache-control` actually appear.

## Verification commands

```bash
curl -sI -H 'Accept-Encoding: br, gzip' https://example.com/ | grep -i 'content-encoding\|cache-control'
curl -sI https://example.com/style.css | grep -i 'cache-control'
node scripts/seo-audit.mjs page https://example.com --json | jq '.findings[] | select(.area=="performance")'
```

After changes, re-run PageSpeed Insights on the same URL/strategy and compare LCP, INP,
CLS and the audit flags. Do not promise a score; report measured deltas with dates.

## What not to do

- Do not inline a 40 KB image as base64 to "remove a request"; it usually makes the
  document bigger and uncacheable.
- Do not lazy-load the LCP image.
- Do not add `preload` for every asset; it competes with the real critical request.
- Do not set `immutable` on unversioned filenames.
- Do not claim CWV compliance from a single Lighthouse run.
