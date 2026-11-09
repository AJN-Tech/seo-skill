# Internationalisation and hreflang

The goal: every language/market version is a crawlable URL with fully rendered
content, self canonicals, reciprocal hreflang and `x-default`. Client-side language
swapping alone is not a localized version for search.

## URL strategy

Pick one pattern and keep it consistent:

| Pattern | Example | Notes |
| --- | --- | --- |
| Subdirectory | `example.com/fr/` | Simplest; inherit domain authority; default language at `/` |
| Subdomain | `fr.example.com` | Separate host; needs separate Search Console properties |
| ccTLD | `example.fr` | Strongest geo signal; highest cost and fragmentation |
| Parameter only (`?lang=fr`) | — | Not recommended for indexing; redirect to a real URL |

The default language normally lives at the root (`/`), others under `/<lang>/`.
**Render the translated text on the server**, not only in JavaScript. Verify with
`curl -sL https://example.com/fr/ | grep '<title>'` and inspect the H1/body.

## Hreflang rules

On **every** page in the set, in `<head>`:

```html
<link rel="alternate" hreflang="en" href="https://example.com/services/x/">
<link rel="alternate" hreflang="fr" href="https://example.com/fr/services/x/">
<link rel="alternate" hreflang="es" href="https://example.com/es/services/x/">
<link rel="alternate" hreflang="x-default" href="https://example.com/services/x/">
```

Rules that catch most errors:
1. **Reciprocal**: if FR lists EN, EN must list FR with the exact final URL.
2. **Absolute URLs**, final canonical URL, trailing-slash consistent.
3. **Self-referencing** alternate included.
4. **One `x-default`** per set, pointing at the default/region-selector page.
5. **Valid codes**: ISO 639-1 (`fr`), optionally with region (`pt-BR`); never `en-UK`.
6. **Same content set**: each language URL links all others that exist. Do not link a
   language page that lacks the corresponding content type.
7. **Canonical self**: localized pages canonicalise to themselves, not to `/`.
8. **Sitemap mirrors the head**: `xhtml:link` alternates per URL.

`hreflang` is a hint for locale selection; it is not a ranking boost and does not
override canonical. Broken reciprocity is worse than no hreflang.

## `lang` and metadata

- `<html lang="fr">` matches the URL language; `dir="rtl"` for Arabic/Hebrew/Urdu.
- Localized `<title>`, meta description, H1, OG tags and `og:locale`
  (`fr_FR`, `en_US`, …) plus `og:locale:alternate` for the others.
- Structured data: `inLanguage` on `WebPage`, `Service`, `FAQPage`; localized text
  inside the schema, matching the visible page.
- Language names in the switcher use their own language (`Français`, not `French`).

## Language switching

- The switcher navigates to the localized URL (a normal link or a client-side
  navigation that ends on a distinct URL) and keeps the `#hash`/anchor context.
- Legacy `?lang=xx` URLs should redirect to the localized path (301 or a client
  redirect that preserves the page). Do not leave `?lang=` as the only address.
- Do **not** automatically redirect `example.com/` to `example.com/fr/` based on the
  device language for crawlers. It hides the default version and creates
  content/redirect mismatches. Offer the switcher and let hreflang do the work.
- `Accept-Language` negotiation is acceptable for marketing pages only if the
  canonical default remains reachable and crawlable; document the behavior.

## Translation quality

- Localize search-relevant terms (service names, problems, tools, regions), not just
  the navigation. Literal translations of English keywords often miss local demand.
- Reuse the site's established terminology; keep one term per concept per language.
- Have a native speaker review the highest-traffic pages; AI-assisted translation is a
  draft, not a publish gate.
- Keep legal/regulatory wording accurate; do not localize claims you cannot support.

## Audit procedure

For each language version of a page:

1. Fetch the raw HTML; confirm `lang`, `<title>`, H1, and body text are in that language.
2. Extract all `hreflang` pairs; ensure every listed URL exists and is 200.
3. Fetch each target and confirm it links back (reciprocity), includes `x-default`,
   and canonicalises to itself.
4. Compare the sitemap alternates with the head block; they must match.
5. Check the language switcher resolves to the same content and is not JS-only.
6. Search Console: inspect one URL per language; verify users see the localized snippet.

The bundled auditor performs steps 1–4 for a crawled set and prints a reciprocity
matrix when it finds mismatches.
