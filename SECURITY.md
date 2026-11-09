# Security and authorized use

## Scope

`seo-skill` is a set of instructions and a **read-only** auditor. It:

- performs HTTP `GET` requests only (no forms, no writes, no authentication bypass);
- reads local build directories;
- requests one page at a time, with a timeout and a `--max-pages` cap;
- never installs packages or executes downloaded code.

## Authorized use

Only audit sites you own or have explicit permission to test. The auditor is polite by
design, but crawling third-party sites at scale is not permitted and may violate their
terms. Do not use it to probe authentication, enumerate private paths, or stress a
server.

## Installer behavior

The installers copy the skill files into well-known harness directories:

- `~/.agents/skills/seo`
- `~/.claude/skills/seo`
- optional native directories with `--native`

They do not run network requests. `--link` creates a symlink to the repository. The
`--agents-md` mode appends a clearly marked block to `AGENTS.md`; review it before
committing.

## Secrets and data

The skill never asks for credentials. If a workflow needs Search Console or analytics
access, use the harness's own authenticated tools and never write secrets into the
repository, a report, or a prompt. The auditor's reports contain public URLs only.

## Reporting a vulnerability

Open a private GitHub security advisory on
<https://github.com/AJN-Tech/seo-skill/security/advisories/new> instead of a public
issue. Include the affected version, a minimal reproduction, and the impact.
