# Contributing

Thanks for improving the skill. Keep changes focused, portable and honest.

## Ground rules

- No runtime dependencies. The auditor must run on Node 18+ with nothing installed.
- Every finding needs evidence and an owner (`code`, `content`, `server`, `external`).
- Never add a check that claims a metric it cannot measure (CWV, Search Console,
  Lighthouse scores). Mark such work as "not verifiable" in the skill instructions.
- No fabricated data in examples, fixtures or docs.
- Keep `SKILL.md` self-sufficient; deep material goes in `references/`.
- Frontmatter constraints: `name` lowercase/hyphenated (max 64), `description` ≤1024
  characters, optional `license`/`compatibility`/`metadata`.

## Development

```bash
git clone https://github.com/AJN-Tech/seo-skill.git
cd seo-skill
node test/run.mjs
node scripts/seo-audit.mjs audit test/fixtures/broken --base https://broken.example/
node --check scripts/seo-audit.mjs
sh -n install.sh uninstall.sh
```

### Adding a check

1. Add the check to `scripts/seo-audit.mjs` in `auditPage` (page) or `auditSiteLevel`
   (site).
2. Emit a finding with a stable `code`, `severity`, `area`, `evidence`, `fix`, `owner`,
   `validation`.
3. Add or extend a fixture in `test/fixtures/` that should trigger it (and make sure the
   good fixture stays clean).
4. Add an assertion in `test/run.mjs`; run the suite.
5. Update `references/audit-checklist.md` and/or the relevant reference page.
6. Update `CHANGELOG.md`.

### Adding a reference

Create `references/<topic>.md` with: when to use it, commands, rules, pitfalls, and a
short verification step. Link it from the `## References` list in `SKILL.md`.

### Adding a harness

Update `install.sh`, `install.ps1` and `uninstall.sh` with the documented path, then
`docs/INSTALL-MATRIX.md` with the source link and verification command. Only add targets
confirmed by the harness documentation; otherwise use the `AGENTS.md` adapter.

## Pull requests

- Keep the diff small and explain the evidence for a new check.
- Run the full test suite and the fixture audit; include the result in the PR.
- Do not include secrets, customer data, or generated reports from private sites.
- By contributing you agree to license your work under MIT.
