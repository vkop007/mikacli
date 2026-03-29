---
name: autocli
description: Use when a task can be completed through the AutoCLI command line instead of custom scripts. Helps agents choose the right category and provider, prefer --json output, use shared browser login or saved sessions safely, inspect health with status/doctor/sessions, and use session-aware tools like tools http before inventing custom web automation.
---

# AutoCLI

Use this skill when the task maps to an existing AutoCLI provider or when you need to operate the AutoCLI repository itself.

## Quick Rules

- Always use category-based commands: `autocli <category> <provider> ...`
- Prefer `--json` for agent work unless the user explicitly wants human-readable output.
- If auth state is unclear, start with `autocli status --json` or `autocli doctor --json`.
- Check saved sessions with `autocli sessions --json` before asking for a fresh cookie export or token.
- For cookie-backed providers, prefer `autocli login --browser` and then `<provider> login --browser` when manual cookie export would be awkward.
- Use `autocli tools http <provider-or-domain> inspect|request|capture` when a saved web session exists but the exact provider command is missing or unclear.
- For risky actions, read or list first, then mutate second.
- Use `autocli <category> --help` and `autocli <category> <provider> --help` before assuming subcommands.
- Some web-session providers are partial. If a route feels limited, consult the repo `README.md` support notes and the provider help text.

## Core Workflow

1. Map the task to a category. If unsure, read [references/category-map.md](references/category-map.md).
2. Confirm whether the provider is public, cookie-backed, session-backed, API-token-based, bot-token-based, or local-tool-based.
3. If the provider needs auth and no saved session exists, run `login` first.
4. For cookie-backed providers, choose the cleanest auth path:
   - `login --browser` when the user can sign in interactively
   - `login --cookies ...` when they already have an export
5. Prefer discovery commands like `search`, `me`, `profile`, `status`, `page`, `title`, `posts`, `spaces`, `projects`, `services`, or `apps` before write commands.
6. When you need to pass results to another command, use `--json` and route through `autocli data ...` if transformation is needed.
7. If the provider is authenticated but the exact action is not modeled yet, try `autocli tools http ...` before reaching for custom curl or browser automation.

## Global Commands

- `autocli login --browser`
- `autocli status --json`
- `autocli doctor --json`
- `autocli sessions --json`
- `autocli sessions show <platform> <account> --json`

## High-Value Patterns

- Use `login --browser` once to bootstrap the shared AutoCLI browser profile, then reuse it for later cookie-backed logins.
- Use `tools` and `data` as glue around other providers.
- Use `tools http` to inspect saved web sessions, replay authenticated requests, and capture logged-in traffic from the shared browser.
- Use `editor` for local transformations before upload or posting.
- Use `news`, `movie`, `music`, `maps`, `finance`, and many `tools` providers for public lookup tasks with no login step.
- Use `developer`, `social`, `llm`, `shopping`, `devops`, and some `music` providers when the task needs an account-backed action.

## Common Examples

```bash
autocli login --browser
autocli developer github login --browser
autocli developer github me --json
autocli social reddit search "bun cli" --json
autocli devops render services --json
autocli tools http github inspect --json
autocli tools page-links https://example.com --type external --json
autocli data json query '{"items":[{"title":"AutoCLI"}]}' 'items[0].title'
autocli editor image resize ./photo.png --width 1200
```

## Failure Recovery

- If a login-based provider fails unexpectedly, run `autocli sessions --json` and `autocli doctor --json`.
- If a cookie-backed provider says the session expired, re-login with `login --browser` or re-import cookies with `login --cookies ...`.
- If a site works in the shared browser but not through its modeled provider commands yet, use `autocli tools http <provider-or-domain> inspect` or `capture`.
- If a command depends on local binaries, `doctor` will show missing tools such as `ffmpeg`, `qpdf`, `tesseract`, or other local dependencies.
- If a provider exposes async media jobs, prefer its `status`, `wait`, `download`, or `cancel` subcommands instead of polling manually.

## When To Read More

- Read [references/category-map.md](references/category-map.md) when you need a quick category/provider chooser, auth hint, or example command pattern.
