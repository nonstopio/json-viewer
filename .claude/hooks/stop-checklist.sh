#!/bin/bash
# Stop — final checklist. Blocks "done" only when debug leftovers
# (console.log / debugger) sit in src files CHANGED this session, so it guards
# new cruft without nagging about the repo's pre-existing logs.
input=$(cat)

# Don't loop: if this hook already blocked once this turn, let it through.
echo "$input" | grep -q '"stop_hook_active": *true' && exit 0

cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0

# Files touched vs HEAD: staged, unstaged, and untracked — src TS only.
changed=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null \
  | grep -E '^src/.*\.(ts|tsx)$' | sort -u )
[ -z "$changed" ] && exit 0

leftovers=$(echo "$changed" | xargs grep -nE "console\.log|debugger" 2>/dev/null)
if [ -n "$leftovers" ]; then
  echo "Stop-hook checklist failed — remove debug leftovers from files you changed:" >&2
  echo "$leftovers" >&2
  exit 2
fi
exit 0
