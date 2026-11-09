# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/); versioning: semver.

## [1.0.0] — 2026-11-09

### Added
- `SKILL.md` — portable Agent Skills skill for SEO audits, fixes and verification,
  focused on multilingual and static/SSG sites, with evidence and anti-fabrication
  guardrails.
- `references/` — audit checklist, technical SEO, crawl files (robots/sitemap/llms.txt),
  internationalization, content quality, structured data, performance, AI search,
  measurement, report template, static-site playbook.
- `scripts/seo-audit.mjs` — dependency-free read-only auditor for live URLs and local
  build directories; JSON/Markdown output, severity/owner/validation per finding,
  `--fail-on` CI gate.
- `test/` — good/broken fixture sites and 41 assertions (no dependencies).
- `install.sh`, `install.ps1`, `uninstall.sh` — cross-harness installers for
  Claude Code, OpenAI Codex, OpenCode, DeepSeek Harness, Cursor and Gemini CLI
  (universal `~/.agents/skills/seo` + `~/.claude/skills/seo`), project-scoped and
  `AGENTS.md` adapter modes.
- `docs/INSTALL-MATRIX.md`, `docs/CASE-STUDY-AJENU.md`, `docs/ARCHITECTURE.md`.
- GitHub Actions CI (Node 20/22, tests, fixture audit, shell syntax).

### Notes
- Server-owned findings (compression, cache TTLs, host redirects) are documented, never
  claimed as repository fixes.
- No fabricated SEO data, reviews, statistics or integrations.
