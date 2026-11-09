# Structured data, Open Graph and social previews

JSON-LD is how search engines understand entities and page types. Open Graph is how
links look when shared. Both are generated from the same page data; both must stay
honest and localized.

## Baseline graph (every site)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#organization",
      "name": "Example Co",
      "url": "https://example.com/",
      "sameAs": ["https://github.com/example"]
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#website",
      "url": "https://example.com/",
      "name": "Example Co",
      "inLanguage": "en"
    },
    {
      "@type": "WebPage",
      "@id": "https://example.com/page/#webpage",
      "url": "https://example.com/page/",
      "name": "Page title",
      "description": "Page description",
      "isPartOf": { "@id": "https://example.com/#website" },
      "about": { "@id": "https://example.com/#organization" }
    }
  ]
}
```

Rules:
- One JSON-LD block per page is easiest to validate; multiple are allowed but avoid
  duplicate entity ids.
- Use absolute URLs and stable `@id` values. Keep ids consistent across pages.
- Only add properties you can support from visible content.
- Localized pages: translate `name`, `description`, `caption`, FAQ text; set
  `inLanguage` to the page language.

## Page-type patterns

- **Service**: `name`, `description`, `url`, `provider` (`@id` of Organization),
  `serviceType`, `inLanguage`, optional `areaServed`.
- **FAQPage**: `mainEntity` array of `Question` → `acceptedAnswer` (`Answer.text`).
  Every Q/A must appear on the visible page.
- **BreadcrumbList**: `itemListElement` with `position`, `name`, `item` (absolute).
- **Article/BlogPosting**: `headline`, `datePublished`, `dateModified`, `author`
  (Person/Organization), `image`.
- **Product**: `name`, `image`, `description`, `offers` (real price/currency/
  availability), `brand`, `sku`; add `AggregateRating` only with real reviews.
- **LocalBusiness**: real address, phone, opening hours, `geo` only if accurate.
- **Event**: real dates/location/offers; remove after the event.

## Common structured-data mistakes

| Mistake | Why it hurts |
| --- | --- |
| FAQ schema text differs from visible FAQ | Rich-result eligibility loss / policy risk |
| Fabricated ratings or reviews | Manual action risk, dishonest |
| `@id` collisions across unrelated entities | Merged/incoherent graph |
| Canonical URL in schema differs from canonical tag | Conflicting signals |
| English schema text on localized pages | Wrong-language rich results |
| `</script>` inside a JSON string | Page breaks; escape as `\u003c` |
| Markup for content not visible to users | Policy violation |

## Validation

- Parse strictly: `JSON.parse` the block content; catch and report invalid JSON as
  `high`.
- Check required fields per type and that referenced `@id`s exist on the page.
- Compare FAQ/schema text with the visible HTML (the auditor normalizes entities and
  whitespace).
- Use Google's Rich Results Test and Schema Markup Validator for the final human check;
  they require a live URL or code sample.

## Open Graph and Twitter cards

```html
<meta property="og:type" content="website">
<meta property="og:site_name" content="Example Co">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="fr_FR">
<meta property="og:title" content="Page title">
<meta property="og:description" content="Accurate summary, not keyword stuffing">
<meta property="og:url" content="https://example.com/page/">
<meta property="og:image" content="https://example.com/assets/og/page.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Short description of the image">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Page title">
<meta name="twitter:description" content="Accurate summary">
<meta name="twitter:image" content="https://example.com/assets/og/page.png">
```

- `og:image` should be a real, crawlable 1200×630 (or 1.91:1) asset; per-template
  variants beat one generic image for large sites.
- Build the image at deploy time from the page title, or maintain a small set by page
  type (home, service group, article) — do not hand-edit 150 files.
- `og:url` equals the canonical URL. Keep locale metadata localized.
- Test previews with the sharing debuggers of the platforms you actually use; cached
  previews may need a re-scrape.

## Localized pages

- `og:locale` + `og:locale:alternate` for every language.
- Localized `og:title`/`og:description`/`og:image:alt` and schema text.
- `inLanguage` in JSON-LD matches `<html lang>`.
- Do not ship English social previews for French pages; it signals the wrong content.

## Implementation pattern for generated sites

Generate a `seoHead(page, lang)` function that returns title, description, canonical,
hreflang links, OG/Twitter tags and the JSON-LD graph. Feed it the same localized
strings used by the HTML. Validate in CI that:
- every page has exactly one canonical and the expected alternate set;
- JSON parses and required types exist;
- FAQ schema text equals visible FAQ text;
- og:image files exist and have the expected dimensions.
