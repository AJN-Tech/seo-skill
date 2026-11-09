# Install matrix — agent harness support

The skill follows the [Agent Skills specification](https://agentskills.io/specification):
a directory with `SKILL.md` (frontmatter `name` + `description`) and optional
`references/`, `scripts/`, `assets/`.

Paths below are global (user) locations. Project-scoped locations are the same relative
paths inside a repository. Verified against the harness docs in November 2026; confirm
before relying on a new release.

## Universal target (recommended)

`~/.agents/skills/seo/` — the cross-agent alias. One install covers:

| Harness | Reads `~/.agents/skills` | Native global path (optional) | Verify |
| --- | --- | --- | --- |
| OpenAI Codex (CLI/IDE) | Yes (`$HOME/.agents/skills`) | `/etc/codex/skills` (admin), repo `.agents/skills` | `/skills`, `$seo` |
| OpenCode | Yes | `~/.config/opencode/skills` | skill tool list |
| DeepSeek Harness | Yes | `~/.dsh/skills` | skill list in a new session |
| Cursor | Yes | `~/.cursor/skills` | `/seo`, `@seo` |
| Gemini CLI | Yes | `~/.gemini/skills` | `/skills list` |
| Claude Code | No | `~/.claude/skills` (required) | `/seo` |
| Windsurf / Cline / Roo / Continue / Aider / Amp / Zed | Not confirmed | — | `--agents-md` pointer |

Sources:
- Claude Code skills: <https://code.claude.com/docs/en/skills>
- OpenAI Codex skills: <https://learn.chatgpt.com/docs/build-skills>
- OpenCode Agent Skills: <https://docs.opencode.ai/docs/skills/>
- DeepSeek Harness skills: official `docs/subsystems/skills.md` (paths listed in
  <https://github.com/TimeMachineLab/awesome-deepseek-harness-zh/blob/main/docs/skills.md>)
- Cursor skills: <https://prod.cursor.com/help/customization/skills>
- Gemini CLI skills: <https://geminicli.com/docs/cli/skills.md>
- Agent Skills spec: <https://agentskills.io/specification>

## What the installer does

| Command | Targets |
| --- | --- |
| `./install.sh` | `~/.agents/skills/seo` + `~/.claude/skills/seo` if Claude Code is detected |
| `./install.sh --all` | `~/.agents/skills/seo` + `~/.claude/skills/seo` |
| `./install.sh --harness claude` | `~/.claude/skills/seo` |
| `./install.sh --harness codex` | `~/.agents/skills/seo` |
| `./install.sh --harness opencode --native` | `~/.config/opencode/skills/seo` |
| `./install.sh --harness dsh --native` | `~/.dsh/skills/seo` |
| `./install.sh --harness cursor --native` | `~/.cursor/skills/seo` |
| `./install.sh --harness gemini --native` | `~/.gemini/skills/seo` |
| `./install.sh --project DIR` | `DIR/.agents/skills/seo` + `DIR/.claude/skills/seo` |
| `./install.sh --agents-md DIR` | appends a pointer block to `DIR/AGENTS.md` |
| `./install.sh --check` / `--uninstall` | verify / remove selected targets |

Installs are copies by default. `--link` symlinks the repository directory instead
(Claude Code, Codex and Cursor follow symlinked skill folders; keep the repo in place).

### Duplicate-name caution

OpenCode, Cursor and Gemini CLI scan both `~/.agents/skills` and their native directory.
If you install the skill in both places with the same `name`, the harness sees two
skills with the same name. Prefer the universal target, or use `--native` without the
universal target. Claude Code only reads its own directory, so `--all` installs both
safely there.

## Project-scoped install

Commit the skill with a project so the whole team gets it:

```bash
cd my-site
/path/to/seo-skill/install.sh --project .
git add .agents/skills/seo .claude/skills/seo
```

`~/.agents/skills` and project `.agents/skills` are both standard; project skills take
precedence (check your harness docs for the exact order).

## Windows

`install.ps1` installs the same targets. Project-scoped:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1 -Project C:\src\my-site
```

## Verification

```bash
./install.sh --check
# ok    -> /home/you/.agents/skills/seo
# ok    -> /home/you/.claude/skills/seo
```

The check verifies `SKILL.md` exists and its frontmatter `name` is `seo`. Then restart the
harness or start a new session; skill catalogs are usually loaded at session start.

## Harnesses without a skill directory

Use the `AGENTS.md` pointer (or copy `adapters/AGENTS.md` into the project). Rules-only
harnesses (for example Windsurf rules, Cline rules) can include the same text in their
rules file; the skill body still needs to be readable by the agent, so keep
`SKILL.md`/`references` in the repository.

## Uninstall

```bash
./uninstall.sh --all
# or
./uninstall.sh --harness claude
```
