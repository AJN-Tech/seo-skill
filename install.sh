#!/usr/bin/env sh
# seo-skill installer — installs the `seo` Agent Skill for the AI harnesses you use.
#
# Universal target:  ~/.agents/skills/seo        (Codex, OpenCode, DeepSeek Harness,
#                                                 Cursor, Gemini CLI, and other
#                                                 Agent Skills clients that scan .agents)
# Claude Code target: ~/.claude/skills/seo       (Claude Code reads its own directory)
#
# Usage:
#   ./install.sh                     # universal + Claude Code if detected
#   ./install.sh --all               # universal + Claude Code (covers all named harnesses)
#   ./install.sh --harness claude    # one harness (see --help)
#   ./install.sh --harness opencode --native
#   ./install.sh --project ../site   # project-scoped install
#   ./install.sh --check             # verify an install
#   ./install.sh --uninstall         # remove installed copies
#
# Options: --all --harness NAME --native --link --force --dry-run --project DIR
#          --agents-md [DIR] --check --uninstall --help
set -eu

SKILL_NAME=seo
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
HOME_DIR=${HOME:?HOME is not set}

ALL=0
HARNESSES=""
NATIVE=0
LINK=0
FORCE=0
DRY=0
CHECK=0
UNINSTALL=0
PROJECT=""
AGENTS_MD=""
SELECTOR=0

say() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 2; }

usage() {
  cat <<'EOF'
seo-skill installer

Installs the `seo` skill into the global skill directories used by AI harnesses.

Targets:
  ~/.agents/skills/seo          Codex, OpenCode, DeepSeek Harness, Cursor,
                                Gemini CLI and other Agent Skills clients
  ~/.claude/skills/seo          Claude Code
  ~/.config/opencode/skills/seo OpenCode native (with --harness opencode --native)
  ~/.dsh/skills/seo             DeepSeek Harness native (--harness dsh --native)
  ~/.cursor/skills/seo          Cursor native (--harness cursor --native)
  ~/.gemini/skills/seo          Gemini CLI native (--harness gemini --native)

Options:
  --all                 Install the universal target + Claude Code
  --harness NAME        agents|claude|codex|opencode|dsh|cursor|gemini
                        (repeatable; --all covers every named harness)
  --native              With opencode/dsh/cursor/gemini: use their private dir too
  --link                Symlink the skill directory instead of copying
  --force               Replace an existing install
  --dry-run             Print actions without touching the filesystem
  --project DIR         Install in DIR/.agents/skills/seo and DIR/.claude/skills/seo
  --agents-md [DIR]     Append a pointer block to DIR/AGENTS.md (default: PWD)
  --check               Verify the selected install(s)
  --uninstall           Remove the selected install(s)
  --help                This help

Examples:
  ./install.sh
  ./install.sh --all
  ./install.sh --harness claude
  ./install.sh --project ~/src/mysite
  ./install.sh --check
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --all) ALL=1; SELECTOR=1 ;;
    --harness)
      shift
      [ $# -gt 0 ] || die "--harness needs a value"
      HARNESSES="$HARNESSES $1"
      SELECTOR=1
      ;;
    --native) NATIVE=1 ;;
    --link) LINK=1 ;;
    --force) FORCE=1 ;;
    --dry-run) DRY=1 ;;
    --check) CHECK=1 ;;
    --uninstall) UNINSTALL=1 ;;
    --project)
      shift
      [ $# -gt 0 ] || die "--project needs a directory"
      PROJECT=$1
      SELECTOR=1
      ;;
    --agents-md)
      AGENTS_MD=$HOME_DIR
      if [ $# -gt 1 ]; then
        case "$2" in
          -*) : ;;
          *) AGENTS_MD=$2; shift ;;
        esac
      fi
      ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

TARGETS=""
add_target() {
  case " $TARGETS " in
    *" $1 "*) return ;;
  esac
  TARGETS="$TARGETS $1"
}

detect_claude() {
  [ -d "$HOME_DIR/.claude" ] || command -v claude >/dev/null 2>&1
}

resolve_global() {
  case "$1" in
    agents) add_target "$HOME_DIR/.agents/skills/$SKILL_NAME" ;;
    codex) add_target "$HOME_DIR/.agents/skills/$SKILL_NAME" ;;
    claude) add_target "$HOME_DIR/.claude/skills/$SKILL_NAME" ;;
    opencode)
      if [ "$NATIVE" -eq 1 ]; then
        add_target "${XDG_CONFIG_HOME:-$HOME_DIR/.config}/opencode/skills/$SKILL_NAME"
      else
        add_target "$HOME_DIR/.agents/skills/$SKILL_NAME"
      fi
      ;;
    dsh)
      if [ "$NATIVE" -eq 1 ]; then
        add_target "${DSH_HOME:-$HOME_DIR/.dsh}/skills/$SKILL_NAME"
      else
        add_target "$HOME_DIR/.agents/skills/$SKILL_NAME"
      fi
      ;;
    cursor)
      if [ "$NATIVE" -eq 1 ]; then
        add_target "$HOME_DIR/.cursor/skills/$SKILL_NAME"
      else
        add_target "$HOME_DIR/.agents/skills/$SKILL_NAME"
      fi
      ;;
    gemini)
      if [ "$NATIVE" -eq 1 ]; then
        add_target "$HOME_DIR/.gemini/skills/$SKILL_NAME"
      else
        add_target "$HOME_DIR/.agents/skills/$SKILL_NAME"
      fi
      ;;
    windsurf|cline|roo|continue|aider|amp|zed)
      warn "$1 has no confirmed Agent Skills directory yet; use --agents-md to add a pointer."
      ;;
    *) die "unknown harness: $1 (agents|claude|codex|opencode|dsh|cursor|gemini)" ;;
  esac
}

if [ -n "$PROJECT" ]; then
  PROJECT=$(CDPATH= cd -- "$PROJECT" 2>/dev/null && pwd) || die "project directory not found"
  add_target "$PROJECT/.agents/skills/$SKILL_NAME"
  add_target "$PROJECT/.claude/skills/$SKILL_NAME"
elif [ "$ALL" -eq 1 ]; then
  add_target "$HOME_DIR/.agents/skills/$SKILL_NAME"
  add_target "$HOME_DIR/.claude/skills/$SKILL_NAME"
elif [ -n "$HARNESSES" ]; then
  for harness in $HARNESSES; do
    resolve_global "$harness"
  done
elif [ "$CHECK" -eq 1 ]; then
  # Check the two standard targets unless a selector was given.
  add_target "$HOME_DIR/.agents/skills/$SKILL_NAME"
  add_target "$HOME_DIR/.claude/skills/$SKILL_NAME"
elif [ "$SELECTOR" -eq 0 ] && [ -n "$AGENTS_MD" ]; then
  : # --agents-md can be standalone
elif [ "$UNINSTALL" -eq 1 ] && [ "$SELECTOR" -eq 0 ]; then
  add_target "$HOME_DIR/.agents/skills/$SKILL_NAME"
  add_target "$HOME_DIR/.claude/skills/$SKILL_NAME"
else
  add_target "$HOME_DIR/.agents/skills/$SKILL_NAME"
  if detect_claude; then
    add_target "$HOME_DIR/.claude/skills/$SKILL_NAME"
  else
    say "Claude Code not detected; skipping ~/.claude (use --harness claude to force)."
  fi
fi

if [ -z "$TARGETS" ] && [ -z "$AGENTS_MD" ] && [ "$CHECK" -eq 0 ] && [ "$UNINSTALL" -eq 0 ]; then
  die "nothing to install; pass --all, --harness NAME or --project DIR"
fi

# Always ensure the universal skill dir is considered when Claude Code is the only
# selected harness? No: only install the targets the user selected.

validate_target() {
  case "$1" in
    */skills/seo|*"/skills/$SKILL_NAME") : ;;
    *) die "refusing unsafe target path: $1" ;;
  esac
}

copy_skill() {
  target=$1
  mkdir -p "$target"
  for file in SKILL.md README.md LICENSE; do
    [ -f "$SOURCE_DIR/$file" ] && cp "$SOURCE_DIR/$file" "$target/$file"
  done
  for dir in references scripts docs; do
    [ -d "$SOURCE_DIR/$dir" ] && cp -R "$SOURCE_DIR/$dir" "$target/$dir"
  done
}

install_one() {
  target=$1
  validate_target "$target"
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ "$DRY" -eq 1 ]; then
      say "exists -> $target (pass --force to replace)"
      return
    fi
    if [ "$FORCE" -ne 1 ]; then
      die "already exists: $target (use --force to replace, or --uninstall)"
    fi
    rm -rf "$target"
  fi
  if [ "$DRY" -eq 1 ]; then
    say "would install -> $target"
    return
  fi
  mkdir -p "$(dirname "$target")"
  if [ "$LINK" -eq 1 ]; then
    ln -s "$SOURCE_DIR" "$target"
  else
    copy_skill "$target"
  fi
  say "installed -> $target"
}

check_one() {
  target=$1
  validate_target "$target"
  if [ -f "$target/SKILL.md" ] && grep -q '^name: seo$' "$target/SKILL.md"; then
    say "ok    -> $target"
  else
    say "MISSING -> $target"
    return 1
  fi
}

uninstall_one() {
  target=$1
  validate_target "$target"
  if [ -L "$target" ] || [ -d "$target" ]; then
    if [ "$DRY" -eq 1 ]; then say "would remove $target"; else rm -rf "$target"; say "removed -> $target"; fi
  else
    say "not installed -> $target"
  fi
}

status=0
for target in $TARGETS; do
  if [ "$CHECK" -eq 1 ]; then
    check_one "$target" || status=1
  elif [ "$UNINSTALL" -eq 1 ]; then
    uninstall_one "$target"
  elif [ "$DRY" -eq 1 ]; then
    install_one "$target"
  else
    install_one "$target"
  fi
done

if [ -n "$AGENTS_MD" ]; then
  mkdir -p "$AGENTS_MD" 2>/dev/null || true
  agents_file="$AGENTS_MD/AGENTS.md"
  if [ -f "$agents_file" ] && grep -q 'seo-skill:start' "$agents_file"; then
    say "AGENTS.md pointer already present -> $agents_file"
  elif [ "$DRY" -eq 1 ]; then
    say "would add SEO pointer -> $agents_file"
  else
    {
      printf '\n<!-- seo-skill:start (AJN-Tech/seo-skill) -->\n'
      printf '## SEO work\n\n'
      printf 'When a task involves SEO, read the `seo` skill first: `%s/SKILL.md`.\n' "$HOME_DIR/.agents/skills/$SKILL_NAME"
      printf 'It contains the audit workflow, references and a read-only auditor (`scripts/seo-audit.mjs`).\n'
      printf 'Do not invent SEO data; run the checks or state what could not be verified.\n'
      printf '<!-- seo-skill:end -->\n'
    } >> "$agents_file"
    say "added SEO pointer -> $agents_file"
  fi
fi

if [ "$CHECK" -eq 0 ] && [ "$UNINSTALL" -eq 0 ] && [ "$DRY" -eq 0 ] && [ -n "$TARGETS" ]; then
  say ""
  say "Verify in your harness (restart if the skill list was already loaded):"
  say "  Claude Code      /seo"
  say "  Codex            /skills  or  \$seo"
  say "  OpenCode         ask for an SEO audit (skill tool)"
  say "  DeepSeek Harness new session; the skill list should include \"seo\""
  say "  Cursor           /seo  or  @seo"
  say "  Gemini CLI       /skills list"
fi

exit "$status"
