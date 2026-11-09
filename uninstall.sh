#!/usr/bin/env sh
# Remove the seo skill from the harness locations installed by install.sh.
# Usage: ./uninstall.sh [--all] [--harness NAME] [--project DIR] [--dry-run]
set -eu
HOME_DIR=${HOME:?HOME is not set}
SKILL_NAME=seo
DRY=0
ALL=0
PROJECT=""
HARNESSES=""
while [ $# -gt 0 ]; do
  case "$1" in
    --all) ALL=1 ;;
    --harness) shift; HARNESSES="$HARNESSES $1" ;;
    --project) shift; PROJECT=$1 ;;
    --dry-run) DRY=1 ;;
    --help|-h) printf 'usage: %s [--all] [--harness NAME] [--project DIR] [--dry-run]\n' "$0"; exit 0 ;;
    *) printf 'unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

TARGETS=""
add() { case " $TARGETS " in *" $1 "*) : ;; *) TARGETS="$TARGETS $1" ;; esac; }
if [ -n "$PROJECT" ]; then
  PROJECT=$(CDPATH= cd -- "$PROJECT" && pwd)
  add "$PROJECT/.agents/skills/$SKILL_NAME"
  add "$PROJECT/.claude/skills/$SKILL_NAME"
else
  if [ "$ALL" -eq 1 ] || [ -z "$HARNESSES" ]; then
    HARNESSES="agents claude opencode dsh cursor gemini"
  fi
  for h in $HARNESSES; do
    case "$h" in
      agents|codex) add "$HOME_DIR/.agents/skills/$SKILL_NAME" ;;
      claude) add "$HOME_DIR/.claude/skills/$SKILL_NAME" ;;
      opencode) add "${XDG_CONFIG_HOME:-$HOME_DIR/.config}/opencode/skills/$SKILL_NAME" ;;
      dsh) add "${DSH_HOME:-$HOME_DIR/.dsh}/skills/$SKILL_NAME" ;;
      cursor) add "$HOME_DIR/.cursor/skills/$SKILL_NAME" ;;
      gemini) add "$HOME_DIR/.gemini/skills/$SKILL_NAME" ;;
      *) printf 'unknown harness: %s\n' "$h" >&2; exit 2 ;;
    esac
  done
fi
status=0
for target in $TARGETS; do
  case "$target" in
    */skills/seo) : ;;
    *) printf 'refusing unsafe target: %s\n' "$target" >&2; exit 2 ;;
  esac
  if [ -L "$target" ] || [ -d "$target" ]; then
    if [ "$DRY" -eq 1 ]; then printf 'would remove %s\n' "$target"; else rm -rf "$target"; printf 'removed -> %s\n' "$target"; fi
  else
    printf 'not installed -> %s\n' "$target"
  fi
done
exit "$status"
