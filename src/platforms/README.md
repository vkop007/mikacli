# Platform Structure

Each platform lives under `src/platforms/<name>/`.

There are two supported patterns:

1. `buildCommand`
- Use this when a platform already has a large custom command builder.
- Required files:
  - `manifest.ts`
  - `command.ts`
  - `adapter.ts` if the platform uses a shared adapter instance

2. `capabilities`
- Use this for new platforms or when splitting an existing large platform.
- Required files:
  - `manifest.ts`
  - `adapter.ts` when the platform has an adapter-backed implementation
  - `capabilities/*.ts`

Recommended layout:

```text
src/platforms/<name>/
  adapter.ts
  command.ts
  manifest.ts
  capabilities/
    login.ts
    post.ts
    like.ts
    comment.ts
```

Rules:

- Register every platform in `src/platforms/index.ts`.
- Put shared platform metadata in `src/platforms/config.ts`.
- Keep root CLI wiring out of `src/index.ts`; the root only loads platform definitions.
- Use `manifest.ts` as the single entrypoint for a platform.
- Prefer `capabilities` for new work.
- Keep `src/commands/*` as compatibility wrappers only.
- Use the shared connection layer in `src/core/auth/connection-store.ts`.
- Pick the correct auth strategy in `manifest.ts`:
  - `cookies` for imported browser sessions
  - `botToken` for Telegram/Discord/Slack style bot adapters
  - `oauth2`, `apiKey`, or `none` for future API-first platforms

Current examples:

- All current platforms are capability-based.
- Bot-token platforms: `src/platforms/discordbot/`, `src/platforms/slackbot/`, `src/platforms/telegrambot/`
- Cookie-backed platforms: `src/platforms/facebook/`, `src/platforms/instagram/`, `src/platforms/linkedin/`, `src/platforms/tiktok/`, `src/platforms/x/`, `src/platforms/youtube/`
