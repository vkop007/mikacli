---
name: autocli
description: Use when a task can be completed through the AutoCLI command line instead of custom scripts. Helps agents choose the right category and provider, prefer --json output, handle cookies or saved sessions safely, inspect health with status/doctor/sessions, and chain AutoCLI tools together without guessing command names.
---

# AutoCLI

Use this skill when the task maps to an existing AutoCLI provider or when you need to operate the AutoCLI repository itself.

## Quick Rules

- Always use category-based commands: `autocli <category> <provider> ...`
- Prefer `--json` for agent work unless the user explicitly wants human-readable output.
- If auth state is unclear, start with `autocli status --json` or `autocli doctor --json`.
- Check saved sessions with `autocli sessions --json` before asking for a fresh cookie export or token.
- For risky actions, read or list first, then mutate second.
- Use `autocli <category> --help` and `autocli <category> <provider> --help` before assuming subcommands.
- Some web-session providers are partial. If a route feels limited, consult the repo `README.md` support notes and the provider help text.

## Core Workflow

1. Map the task to a category. If unsure, read [references/category-map.md](references/category-map.md).
2. Confirm whether the provider is public, cookie-backed, session-backed, or local-tool-based.
3. If the provider needs auth and no saved session exists, run `login` first.
4. Prefer discovery commands like `search`, `me`, `profile`, `status`, `page`, `title`, `posts`, `spaces`, or `projects` before write commands.
5. When you need to pass results to another command, use `--json` and route through `autocli data ...` if transformation is needed.

## Global Commands

- `autocli status --json`
- `autocli doctor --json`
- `autocli sessions --json`
- `autocli sessions show <platform> <account> --json`

## High-Value Patterns

- Use `tools` and `data` as glue around other providers.
- Use `editor` for local transformations before upload or posting.
- Use `news`, `movie`, `music`, `maps`, `finance`, and many `tools` providers for public lookup tasks with no login step.
- Use `developer`, `social`, `llm`, `shopping`, and some `music` providers when the task needs an account-backed action.

## Common Examples

```bash
autocli llm chatgpt text "Summarize this changelog" --json
autocli developer github me --json
autocli social x post "Shipping AutoCLI today"
autocli tools page-links https://example.com --type external --json
autocli data json query '{"items":[{"title":"AutoCLI"}]}' 'items[0].title'
autocli editor image resize ./photo.png --width 1200
```

## Failure Recovery

- If a login-based provider fails unexpectedly, run `autocli sessions --json` and `autocli doctor --json`.
- If a web-session provider says the session expired, re-import cookies with `login --cookies ...`.
- If a command depends on local binaries, `doctor` will show missing tools such as `ffmpeg`, `qpdf`, or `tesseract`.
- If a provider exposes async media jobs, prefer its `status`, `wait`, `download`, or `cancel` subcommands instead of polling manually.

## When To Read More

- Read [references/category-map.md](references/category-map.md) when you need a quick category/provider chooser or example command patterns.
