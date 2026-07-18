#!/bin/bash
# PostToolUse — prettier every file Claude writes. Automates the "format" half
# of `npm run code-quality` so the formatter, not the model, has the last word.
file=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))')

case "$file" in
  *.js|*.jsx|*.ts|*.tsx|*.css|*.json|*.md|*.html)
    command -v npx >/dev/null 2>&1 && npx --yes prettier --write "$file" >/dev/null 2>&1
    ;;
esac
exit 0
