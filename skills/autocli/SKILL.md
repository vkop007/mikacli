---
name: autocli
description: Use when a task can be completed through the AutoCLI command line instead of custom scripts. Helps agents choose the right category and provider, prefer --json output, use shared browser login or saved sessions safely, inspect health only when needed, and use session-aware tools like tools http before inventing custom web automation.
---

# AutoCLI

Use this skill when the task maps to an existing AutoCLI provider or when you need to operate the AutoCLI repository itself.

## Fast Agent Rules

- Default to one direct `autocli <category> <provider> ... --json` command.
- Do not start with `help`, `doctor`, `sessions`, `status`, or `capabilities` unless the direct command is unclear or fails.
- Always use category-based commands: `autocli <category> <provider> ...`
- Prefer `--json` for agent work unless the user explicitly wants human-readable output.
- If the intent matches a known recipe, use that exact command first. Read [references/recipes.md](references/recipes.md).
- If the category or provider is unclear, read [references/category-map.md](references/category-map.md).
- If the provider is already known and you need its exact command surface, read [references/providers/index.md](references/providers/index.md) and then the matching provider file.
- Use `autocli <category> <provider> capabilities --json` only when you need to confirm auth type, stability, browser support, or read/write boundaries before acting.
- For cookie-backed providers, prefer `autocli login --browser` and then `<provider> login --browser` when manual cookie export would be awkward.
- Use `autocli tools http <provider-or-domain> inspect|request|capture` when a saved web session exists but the exact provider command is missing or unclear.
- For risky actions, read or list first, then mutate second.

## Default Flow

1. Match the user request to a known recipe. If one fits, run it immediately.
2. If no recipe fits, map the task to a category and provider using [references/category-map.md](references/category-map.md).
3. Run one direct `autocli ... --json` command.
4. If it fails, do one minimal recovery step:
   - auth problem -> provider `login` or `autocli login --browser`
   - support uncertainty -> `capabilities --json`
   - missing local dependency -> `autocli doctor --json`
   - modeled command gap -> `autocli tools http ...`
5. Retry once with the new information.

Avoid multi-command exploration unless the task is genuinely ambiguous or the user asked for diagnosis.

## Recovery Ladder

- `SESSION_EXPIRED` or browser login needed:
  - run the provider `login` command first
  - for cookie-backed sites, prefer `autocli login --browser` or `<provider> login --browser`
- `UNSUPPORTED_ACTION` or unclear write support:
  - run `autocli <category> <provider> capabilities --json`
- missing local binary or environment issue:
  - run `autocli doctor --json`
- authenticated site but modeled command missing:
  - run `autocli tools http <provider-or-domain> inspect --json`

Use only one recovery step before retrying unless the user explicitly asks for troubleshooting.

## Result Conventions

- Many list-style commands expose a stable `data.items` alias even if the native provider key is `repos`, `projects`, `posts`, or something else.
- Many singular reads expose a stable `data.entity` alias even if the native provider key is `profile`, `page`, `movie`, or `project`.
- `data.meta.count` and `data.meta.listKey` give a quick summary for list results.
- `data.guidance.recommendedNextCommand` and `data.guidance.nextCommands` are safe follow-up hints the agent should prefer over guessing.
- Prefer small JSON results and do not ask AutoCLI for extra verbose output unless needed.

## Global Commands

- `autocli login --browser`
- `autocli search <query>`
- `autocli status --json`
- `autocli doctor --json`
- `autocli sessions --json`
- `autocli sessions show <platform> <account> --json`
- `autocli <category> <provider> capabilities --json`

## High-Value Patterns

- Use `login --browser` once to bootstrap the shared AutoCLI browser profile, then reuse it for later cookie-backed logins.
- Use `capabilities --json` to verify support level only when the action is unfamiliar, risky, or failing.
- Treat provider help as machine guidance too, but only read it when the command surface is unclear.
- Use `tools` and `data` as glue around other providers.
- Use `tools download` for cross-site media downloads instead of looking for a provider-specific download command first.
- Use `tools http` to inspect saved web sessions, replay authenticated requests, and capture logged-in traffic from the shared browser.
- Use `editor` for local transformations before upload or posting.
- Use `news`, `movie`, `music`, `maps`, `finance`, and many `tools` providers for public lookup tasks with no login step.
- Use `developer`, `social`, `llm`, `shopping`, `devops`, and some `music` providers when the task needs an account-backed action.

## Common Examples

```bash
autocli shopping flipkart cart --json
autocli developer github me --json
autocli social linkedin post-media ./photo.png --caption "Launching AutoCLI" --json
autocli social reddit comment https://www.reddit.com/... "Nice breakdown." --json
autocli llm grok image "Minimal red logo" --json
autocli social youtube upload ./video.mp4 --title "My upload" --visibility private --json
autocli tools download video https://www.instagram.com/reel/SHORTCODE/ --platform instagram --json
autocli tools http github inspect --json
autocli data json query '{"items":[{"title":"AutoCLI"}]}' 'items[0].title'
```

## When To Read More

- Read [references/recipes.md](references/recipes.md) first when the user intent is common and concrete.
- Read [references/category-map.md](references/category-map.md) when you need a quick category/provider chooser, auth hint, or example command pattern.
- Read [references/providers/index.md](references/providers/index.md) when you already know the provider and need all of its commands quickly.
