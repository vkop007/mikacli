# Platform Structure

Providers are grouped by category under `src/platforms/`.

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
src/platforms/
  api/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
    bots/
      <name>/
        adapter.ts
        manifest.ts
        capabilities/
  music/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  public/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  social/
    <name>/
      adapter.ts
      command.ts
      manifest.ts
      capabilities/
  shared/
```

Rules:

- Register every platform in `src/platforms/index.ts`.
- Put shared platform metadata in `src/platforms/config.ts`.
- Keep root CLI wiring out of `src/index.ts`; the root only loads platform definitions.
- Use `manifest.ts` as the single entrypoint for a platform.
- Set `category` in every `PlatformDefinition`.
- Category commands are mounted automatically as `autocli <category> <platform>`.
- Prefer `capabilities` for new work.
- Keep `src/commands/*` as compatibility wrappers only.
- Use the shared connection layer in `src/core/auth/connection-store.ts`.
- Pick the correct auth strategy in `manifest.ts`:
  - `cookies` for imported browser sessions
  - `botToken` for Telegram/Discord/Slack style bot adapters
  - `oauth2`, `apiKey`, or `none` for future API-first platforms

Current examples:

- All current platforms are capability-based.
- API-token platforms: `src/platforms/api/github/`, `src/platforms/api/gitlab/`, `src/platforms/api/linear/`, `src/platforms/api/notion/`
- Bot-token API platforms: `src/platforms/api/bots/discordbot/`, `src/platforms/api/bots/githubbot/`, `src/platforms/api/bots/slackbot/`, `src/platforms/api/bots/telegrambot/`
- Music platforms: `src/platforms/music/spotify/`, `src/platforms/music/youtube-music/`
- Public utility platforms: `src/platforms/public/cheat/`, `src/platforms/public/ip/`, `src/platforms/public/news/`, `src/platforms/public/qr/`, `src/platforms/public/time/`, `src/platforms/public/weather/`, `src/platforms/public/websearch/`
- Cookie-backed social platforms: `src/platforms/social/facebook/`, `src/platforms/social/instagram/`, `src/platforms/social/linkedin/`, `src/platforms/social/tiktok/`, `src/platforms/social/x/`, `src/platforms/social/youtube/`
- Spotify specifically now uses an internal engine split:
  - `web` for standard Web API endpoints
  - `connect` for connect-state playback/device/queue control
  - `auto` to prefer `connect` and fall back to `web`
