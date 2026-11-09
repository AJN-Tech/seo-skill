# Architecture

## Why a SKILL.md plus references

The Agent Skills standard gives every harness the same contract: a directory with
`SKILL.md` whose frontmatter has `name` and `description`, plus optional
`references/`, `scripts/` and `assets/`. Harnesses load only the name/description into
context at session start, then load the body when the skill is selected. That means:

- `SKILL.md` must be a complete, self-sufficient procedure (the model reads it).
- Deep material belongs in `references/`, linked from `SKILL.md`, loaded only when
  needed. This keeps the always-on cost tiny.
- Scripts provide deterministic checks the model can run instead of guessing.

No harness-specific syntax is used in `SKILL.md` except a short note about resolving
the skill directory (Claude Code exposes `CLAUDE_SKILL_DIR`; other harnesses give the
path in the skill listing or use relative paths from the skill directory).

## Auditor design

`scripts/seo-audit.mjs` is a single dependency-free ESM file:

| Concern | Decision |
| --- | --- |
| Dependencies | none; Node 18+ built-ins and global `fetch` |
| Inputs | live URL (bounded crawl, polite, sequential) or local directory |
| HTML parsing | token scanner for tags/attributes; no DOM dependency |
| Checks | page-level and site-level; findings carry severity/area/owner/validation |
| Output | Markdown (human) or JSON (agents/CI); optional `--out` file |
| Safety | read-only, GET only, per-request timeout, `--max-pages` cap, no form posts |
| Determinism | fixtures in `test/fixtures` with known-good and known-broken sites |

Why not reuse Lighthouse/axe? Those require Chrome and network installs; the skill must
work in any harness/CI. The auditor covers the evidence-based checks that a static
audit can prove. For rendered Core Web Vitals, the skill instructs the agent to use
PageSpeed Insights/Search Console and to report field vs lab data honestly.

The auditor intentionally does **not** claim CWV scores, Lighthouse audits, or Search
Console data. Those require credentials/browsers; the report marks them not verified.

## Finding model

```json
{
  "code": "hreflang-not-reciprocal",
  "severity": "high",
  "area": "international",
  "page": "https://example.com/fr/",
  "evidence": "links https://example.com/page/ but that page does not link back",
  "fix": "Make the hreflang set reciprocal on both pages.",
  "owner": "code",
  "validation": "Re-run audit."
}
```

- `severity`: critical (blocks indexing/ranking) → high → medium → low → info.
- `owner`: `code` (repository/build), `content`, `server` (host/CDN/DNS), `external`
  (Search Console, analytics, third-party).
- `validation`: the command or check that proves the fix.

## Cross-harness install strategy

The widest common denominator is `~/.agents/skills/<name>` — read by Codex, OpenCode,
DeepSeek Harness, Cursor, Gemini CLI and other Agent Skills clients. Claude Code only
reads its own `~/.claude/skills`. The installers therefore:

1. install to `~/.agents/skills/seo` (universal);
2. install to `~/.claude/skills/seo` when Claude Code is requested/detected;
3. offer native directories with `--native` for users who prefer them (warning about
   duplicate discovery where a harness reads both);
4. support project-scoped installs and an `AGENTS.md` pointer for harnesses without a
   skill directory.

See `docs/INSTALL-MATRIX.md` for paths and source links.

## Extension points

- Add a page check: write a function in `auditPage`, emit `audit.add({...})`, add a
  fixture that should trigger it and one assertion in `test/run.mjs`.
- Add a site check: extend `auditSiteLevel` or the crawl-file functions; keep evidence
  precise (counts, URLs) and owner correct.
- Add a reference: create `references/<topic>.md`, link it from `SKILL.md`, keep it
  actionable (commands, templates, pitfalls).
- Keep the skill honest: no check may claim a field metric it did not measure.
