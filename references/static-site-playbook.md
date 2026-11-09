# Static-site / build-time SEO playbook

For sites generated from templates and content files (SSG, custom Node/Python builds,
Eleventy/Astro/Hugo/Next static export), SEO correctness should be enforced by the
build, not by memory. This playbook is the pattern used in the case study.

## Architecture

```
content/                 # single source of truth per language
  languages.json         # codes, names, og:locale, default
  services.json          # English source records
  services.<lang>.json   # translations with identical structure
templates/               # Home/Service/Page templates with i18n hooks
scripts/build.js         # validate -> render localized pages -> crawl files
scripts/verify.js        # regression harness; rebuild + assert invariants
scripts/seo-audit.mjs    # optional: audit the built dist/ before deploy
```

Principles:
1. **One source of truth per string.** Templates carry keys (`data-i18n`), not copy.
2. **Render each language as its own URL** at build time (default at `/`, others at
   `/<lang>/`), with localized head tags and canonical/hreflang.
3. **Generate crawl files from the same data** as the pages: sitemap with alternates,
   robots.txt, llms.txt.
4. **Fail the build** on missing/empty translations, mismatched structure, duplicate
   slugs, invalid URLs, missing OG assets.
5. **Verify after build, not instead of it.** A verification script rebuilds from
   scratch and checks all pages, crawl files, headers assumptions, a11y and asset
   references.

## URL matrix

| Page type | Default | fr | en | es |
| --- | --- | --- | --- | --- |
| Home | `/` | `/fr/` | `/en/` | `/es/` |
| Service | `/services/<slug>/` | `/fr/services/<slug>/` | ... | ... |
| Catalog | `/services/` | `/fr/services/` | ... | ... |

- Localized page canonical = itself; hreflang = all versions + `x-default` → default.
- Sitemap contains every URL and repeats the alternate set per `<url>`.
- Language switcher links to the alternate URL; legacy `?lang=` redirects to it.

## Template head contract

Generate a single head builder used by every template:

- `<title>`, meta description, meta robots
- canonical (absolute, self)
- hreflang alternates + x-default
- Open Graph (`og:type`, `og:site_name`, `og:locale` + alternates, title,
  description, url, image + dimensions/alt)
- Twitter card
- JSON-LD graph (Organization, WebSite, WebPage; page-type additions)
- theme-color, favicon, preconnect/preload only where measured

## Validation harness (CI gate)

`npm run verify` should rebuild and assert, at minimum:

- build exits 0 and expected file count exists;
- every page: exactly one H1, title/description present and unique per language,
  self canonical, correct `lang`, alternate set (4 + x-default) reciprocal;
- internal links resolve on disk (including localized prefixes);
- no unreplaced template tokens;
- structured data parses and matches visible FAQ text;
- sitemap XML parses, URL count, alternates; robots/llms content;
- assets referenced by pages exist (images, CSS/JS/i18n);
- JSON i18n bundles/strings parse and cover every `data-i18n` key;
- optional: HTML size/asset budgets to catch accidental bloat.

Run the auditor on `dist/` in CI if the harness is not enough:

```bash
node scripts/seo-audit.mjs audit dist --base https://example.com --fail-on critical --json
```

## Localization workflow

1. Change the English source record.
2. Update every translation with identical structure/counts.
3. Run the translation checker per language (`check-service-translations`).
4. Build; inspect one page per language with `curl`/view-source.
5. Run the verifier; then the auditor.
6. Only then deploy.

## Content expansion without near-duplicates

When thin pages need depth, use a small, honest schema per record:

```json
{
  "audience": "who it is for and when it helps",
  "deliverables": ["concrete output", "concrete output"],
  "setup": ["step 1", "step 2", "step 3"],
  "faqs": [{ "q": "real question", "a": "plain answer" }],
  "llmsSummary": "one sentence for llms.txt"
}
```

Guidelines: 3–4 deliverables, exactly 3 setup steps, 2 FAQs per service, translated
with identical structure. Validate lengths and detect duplicate sentences across
records. No invented proof; leave space for real client stories.

## Performance built into the build

- Minify CSS/JS and inline the critical set (or a one-request page) when the stack
  allows; measure before/after.
- Responsive images generated at build time (`800w/1000w/1400w`), `srcset`+`sizes`.
- Preload the LCP image; `fetchpriority="high"` only on it.
- Per-page i18n bundles or reduced inline strings (do not ship all languages).
- Cache-busting hashes in filenames/queries; long TTLs require versioned URLs.
- Compression/cache headers remain a deploy/edge configuration; document them.

## Deploy checklist

- Build + verify green.
- Crawl files present at the root and correct.
- Redirects (host, http→https, trailing slash, index.html) verified with `curl -I`.
- Compression and cache headers verified with `curl -I -H 'Accept-Encoding: br'`.
- Sitemap submitted; URL inspection done for key pages.
- Rollback: previous `dist/` artifact or image retained.
