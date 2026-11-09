# SEO audit report template

Keep the report short enough to act on. Every finding needs evidence, a fix, an owner
and a validation method. Use this structure for written reports and for the final
message in a coding session.

```md
# SEO audit — <site> (<date>)

## Scope
- Audited: <URL count / languages / build>; crawler/script version: <...>
- Access: Search Console <yes/no>, analytics <yes/no>, PSI <available/quota>
- Not verifiable: <list with reasons>

## Executive summary
- <1–2 sentences: state of the site and the three highest-impact fixes>
- Overall: <critical/high counts>; crawl files: <valid/invalid>; hreflang: <reciprocal/missing>

## Findings (sorted by severity)

| # | Sev | Area | Page | Evidence | Why it matters | Fix | Owner |
|---|-----|------|------|----------|----------------|-----|-------|
| 1 | critical | indexability | /page/ | `<meta name="robots" content="noindex">`; `X-Robots-Tag: noindex` absent | cannot rank | remove noindex + resubmit | code |
| 2 | high | international | /fr/ | hreflang missing `x-default`; FR↔EN not reciprocal | wrong language shown | generate reciprocal set + sitemap alternates | code |
| 3 | high | server | / | `curl -I` shows no `content-encoding`, no `cache-control` | slow repeat views; PSI flags | enable brotli/gzip + cache headers at CDN/vhost | server |

## Fix order
1. <critical item — concrete change + verification command>
2. <next>
3. <next>

## Implemented in this pass
- <file/route>: <what changed>; validation: <test/command passed>

## Verification
- `node scripts/seo-audit.mjs audit <target>`: <X> pages, <Y> findings (was <Z>)
- All sitemap URLs return 200; hreflang reciprocal on <N> pages; robots/sitemap valid.
- Headers: <compression/cache/redirect results>.

## External follow-ups (owner: client/host)
- Search Console: verify domain (DNS TXT), submit sitemap, inspect <URLs>.
- Hosting: enable compression + cache TTLs + www→apex 301.
- Content: supply real customer proof/examples, native-speaker review for <languages>.
- Re-check on <date>.

## Caveats
- Lab vs field metrics; samples; access limitations; claims that need client data.
```

## Severity definitions

- **critical**: prevents indexing/ranking or breaks the site (5xx, accidental
  `noindex`, host duplication, sitemap invalid, primary content absent from HTML).
- **high**: materially reduces discovery, trust or conversion (missing canonicals,
  broken hreflang, duplicate titles across key pages, no compression on a large site,
  fabricated/mismatched structured data).
- **medium**: meaningful but non-blocking (missing descriptions, OG image, thin content,
  missing FAQ schema, cache TTLs on small assets).
- **low**: polish (long titles, missing `lastmod`, minor unused bytes).

## Finding quality bar

A finding is acceptable only if it includes:
- a URL (or file) and exact evidence (header, tag, count, snippet);
- the user impact in plain language;
- one concrete fix (code path or server directive);
- an owner (`code`, `content`, `server`, `external`);
- a way to prove it is fixed.

Do not list a finding you have not observed. Do not include "best practice" items as
failures; put them under advisory improvements instead.
