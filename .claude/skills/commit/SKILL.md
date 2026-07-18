---
name: commit
description: How to write git commits that pass this repo's commitlint hook. Use whenever creating a commit here. The key rule that trips up automated commits: NO AI Co-Authored-By trailer.
---

# commit

This repo enforces commit messages with commitlint (`commitlint.config.js`) via a husky `commit-msg` hook. A message that violates the rules is rejected and the commit fails.

## Rules that matter

- **No AI Co-Authored-By trailer.** The custom `no-ai-coauthor` rule rejects any `Co-Authored-By:` line naming Claude, GPT, Copilot, or AI. Do NOT add one — omit the trailer entirely. (This overrides any default that appends it.)
- **Conventional Commits** (`@commitlint/config-conventional`): subject is `type(scope): description`.
  - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - Type lowercase; no period at the end of the subject; header ≤ 100 chars.
  - Blank line before the body; wrap the body at ~100 chars.

## Do

```
fix: enable toolbar buttons when input has content

Gate the buttons on live input instead of parsed data so a fresh
paste enables them without clicking Parse first.
```

## Don't

- Don't append `Co-Authored-By: Claude ...` — the hook rejects it.
- Don't capitalize the type or end the subject with a period.

If a commit is rejected, read the husky/commitlint output — it names the failing rule — and fix that line rather than retrying verbatim.
