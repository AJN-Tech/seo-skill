# seo-skill — a portable SEO skill for AI coding agents

A production-minded **Agent Skill** for auditing, fixing and verifying SEO on real
websites — especially **multilingual** and **statically generated** sites. One
`SKILL.md`, a reference library, and a dependency-free read-only auditor that works with
Claude Code, OpenAI Codex, OpenCode, DeepSeek Harness, Cursor, Gemini CLI and any other
harness that follows the [Agent Skills](https://agentskills.io) standard.

[![CI](https://github.com/AJN-Tech/seo-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/AJN-Tech/seo-skill/actions/workflows/ci.yml)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-SKILL.md-0F3D3A)](https://agentskills.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Built from a real audit + implementation: 38 pages → 152 crawlable pages in four
languages, reciprocal hreflang, generated crawl files, honest content expansion, and a
verification harness that caught a structured-data bug an independent reviewer found.
See [docs/CASE-STUDY-AJENU.md](docs/CASE-STUDY-AJENU.md).

## Why this skill is different

- **Evidence, not vibes.** Every finding needs a URL, header, tag or quoted snippet. The
  bundled auditor produces those findings itself, with a severity, owner and validation
  hint.
- **Honest about ownership.** Compression, cache TTLs, `www` redirects and DNS are
  server/CDN tasks. The skill will not pretend a repo change fixed them.
- **Anti-fabrication rules.** No invented testimonials, statistics, prices, clients,
  certifications or integrations — ever.
- **Multilingual by default.** Localized URLs, reciprocal hreflang + `x-default`,
  self-canonicals, localized JSON-LD/OG, sitemap alternates.
- **Static-build aware.** Generate crawl files from the same data as the pages, fail the
  build on missing translations, verify all URLs before deploy.
- **Zero dependencies.** The auditor is one Node.js file; the skill works offline.

## Install

```bash
git clone https://github.com/AJN-Tech/seo-skill.git
cd seo-skill
./install.sh          # universal target + Claude Code if detected
```

`./install.sh --all` forces the universal target **and** Claude Code. The universal
target is enough for Codex, OpenCode, DeepSeek Harness, Cursor and Gemini CLI:

| Harness | Installed path | Invoke |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/seo/` | `/seo` |
| OpenAI Codex | `~/.agents/skills/seo/` | `/skills` or `$seo` |
| OpenCode | `~/.agents/skills/seo/` | ask / skill tool |
| DeepSeek Harness | `~/.agents/skills/seo/` | new session, skill list shows `seo` |
| Cursor | `~/.agents/skills/seo/` | `/seo` or `@seo` |
| Gemini CLI | `~/.agents/skills/seo/` | `/skills list` |

Native directories (`~/.config/opencode/skills`, `~/.dsh/skills`, `~/.cursor/skills`,
`~/.gemini/skills`) are supported with `--harness <name> --native`. Project-scoped
installs: `./install.sh --project ../my-site` (writes `.agents/skills/seo` and
`.claude/skills/seo`). Harnesses without native skill support can use
`./install.sh --agents-md ../my-site` to append a pointer block to `AGENTS.md`.

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
powershell -ExecutionPolicy Bypass -File install.ps1 -All
```

Verify: `./install.sh --check`. Remove: `./uninstall.sh` or `./uninstall.sh --all`.

Full path matrix and source links: [docs/INSTALL-MATRIX.md](docs/INSTALL-MATRIX.md).

## Use

Ask naturally — "audit https://example.com for SEO", "why is the French version not
ranking?", "add hreflang for our four languages", "fix the PageSpeed issues" — or invoke
the skill directly (`/seo` in Claude Code/Cursor/Codex-style harnesses).

The skill runs a short discovery pass, then uses the bundled auditor:

```bash
# Live site (bounded, read-only)
node scripts/seo-audit.mjs audit https://example.com --json --out seo-report.json

# Local build, full URL-aware checks
node scripts/seo-audit.mjs audit ./dist --base https://example.com

# Crawl files only
node scripts/seo-audit.mjs crawl-files https://example.com

# CI gate: fail on critical/high findings
node scripts/seo-audit.mjs audit ./dist --base https://example.com --fail-on high
```

Output: Markdown by default, JSON with `--json`. Each finding carries `severity`
(`critical|high|medium|low|info`), `area`, `page`, `evidence`, `fix`, `owner`
(`code|content|server|external`) and `validation`. Exit code is 0 unless `--fail-on`
matches.

Example (excerpt):

```text
## Findings

### [high] hreflang-not-reciprocal — https://example.com/fr/page/
- Evidence: links https://example.com/page/ but that page does not link back
- Fix: Make the hreflang set reciprocal on both pages.
- Owner: code
- Validation: Re-run audit.

### [medium] server-no-compression — https://example.com/
- Evidence: no Content-Encoding header on the HTML document
- Fix: Enable brotli/gzip at the server/CDN for HTML, CSS, JS, JSON, SVG.
- Owner: server
- Validation: curl -sI -H 'Accept-Encoding: br, gzip' <url> | grep -i content-encoding
```

## What it covers

Technical SEO (crawlability, indexability, canonicalisation, redirects, status codes,
sitemaps, robots.txt), international SEO (localized URLs, hreflang, `x-default`,
localized metadata/schema), content quality and duplicate detection, structured data and
Open Graph, Core Web Vitals and render-path fixes, AI-crawler policy and `llms.txt`,
Search Console measurement, and a repeatable audit/verify workflow.

It refuses paid links, cloaking, doorway/near-duplicate pages, keyword stuffing, fake
reviews/ratings and fabricated evidence.

## Repository layout

```text
seo-skill/
├── SKILL.md                 # the skill (Agent Skills frontmatter + workflow)
├── references/              # deep dives loaded on demand
├── scripts/seo-audit.mjs    # dependency-free read-only auditor
├── test/                    # fixtures + assertions (no deps)
├── install.sh / install.ps1 # cross-harness installers
├── uninstall.sh
├── adapters/AGENTS.md       # pointer for harnesses without native skill support
└── docs/                    # install matrix, architecture, case study
```

## Development

```bash
node test/run.mjs                         # 41 assertions against good/broken fixtures
node scripts/seo-audit.mjs audit test/fixtures/broken --base https://broken.example/
sh -n install.sh uninstall.sh            # POSIX syntax check
```

Requirements: Node.js 18+ for the auditor and tests. The skill itself is plain Markdown.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Security notes and
authorized-use rules: [SECURITY.md](SECURITY.md).

## License

MIT © 2026 AJN-Tech. See [LICENSE](LICENSE).
