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
  movie/
    <name>/
      adapter.ts
      manifest.ts
    shared/
  editor/
    <name>/
      adapter.ts
      manifest.ts
      output.ts
    shared/
  finance/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  google/
    <name>/
      adapter.ts
      manifest.ts
    shared/
  maps/
    <name>/
      adapter.ts
      manifest.ts
    shared/
  news/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  developer/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  devops/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  bot/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  llm/
    <name>/
      adapter.ts
      manifest.ts
  music/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  shopping/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
  tools/
    <name>/
      adapter.ts
      manifest.ts
      capabilities/
    shared/
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
- Keep `src/commands/*` only for true root/global commands such as `status`, `doctor`, and `sessions`.
- Use the shared connection layer in `src/core/auth/connection-store.ts`.
- Pick the correct auth strategy in `manifest.ts`:
  - `cookies` for imported browser sessions
  - `session` for saved user sessions like Telegram MTProto or WhatsApp QR state
  - `botToken` for Telegram/Discord/Slack style bot adapters
  - `oauth2`, `apiKey`, or `none` for future API-first platforms
- Google providers share the OAuth2 base in `src/platforms/google/shared/`; reuse that layer before adding one-off token handling.

Current examples:

- Most providers are capability-based; use `buildCommand` directly when the login flow needs QR rendering, interactive prompts, or other custom session UX.
- Data platforms: `src/platforms/data/csv/`, `src/platforms/data/html/`, `src/platforms/data/json/`, `src/platforms/data/markdown/`, `src/platforms/data/text/`, `src/platforms/data/xml/`, `src/platforms/data/yaml/`
- Local editor platforms: `src/platforms/editor/archive/`, `src/platforms/editor/audio/`, `src/platforms/editor/document/`, `src/platforms/editor/gif/`, `src/platforms/editor/image/`, `src/platforms/editor/pdf/`, `src/platforms/editor/subtitle/`, `src/platforms/editor/video/`
- Developer platforms: `src/platforms/developer/confluence/`, `src/platforms/developer/github/`, `src/platforms/developer/gitlab/`, `src/platforms/developer/jira/`, `src/platforms/developer/linear/`, `src/platforms/developer/notion/`, `src/platforms/developer/trello/`
- Devops platforms: `src/platforms/devops/cloudflare/`, `src/platforms/devops/digitalocean/`, `src/platforms/devops/fly/`, `src/platforms/devops/netlify/`, `src/platforms/devops/railway/`, `src/platforms/devops/render/`, `src/platforms/devops/supabase/`, `src/platforms/devops/uptimerobot/`, `src/platforms/devops/vercel/`
- Bot platforms: `src/platforms/bot/discordbot/`, `src/platforms/bot/githubbot/`, `src/platforms/bot/slackbot/`, `src/platforms/bot/telegrambot/`
- Active browserless LLM platforms: `src/platforms/llm/chatgpt/`, `src/platforms/llm/claude/`, `src/platforms/llm/deepseek/`, `src/platforms/llm/gemini/`, `src/platforms/llm/grok/`, `src/platforms/llm/mistral/`, `src/platforms/llm/perplexity/`, `src/platforms/llm/qwen/`, `src/platforms/llm/zai/`
- Finance platforms: `src/platforms/finance/crypto/`, `src/platforms/finance/currency/`, `src/platforms/finance/stocks/`
- Google platforms: `src/platforms/google/calendar/`, `src/platforms/google/docs/`, `src/platforms/google/forms/`, `src/platforms/google/gmail/`, `src/platforms/google/drive/`, `src/platforms/google/sheets/`
- Maps platforms: `src/platforms/maps/geo/`, `src/platforms/maps/openstreetmap/`, `src/platforms/maps/osrm/`
- Movie platforms: `src/platforms/movie/anilist/`, `src/platforms/movie/imdb/`, `src/platforms/movie/justwatch/`, `src/platforms/movie/kitsu/`, `src/platforms/movie/letterboxd/`, `src/platforms/movie/myanimelist/`, `src/platforms/movie/tmdb/`, `src/platforms/movie/tvmaze/`
- News platforms: `src/platforms/news/news/`
- DeepSeek uses imported browser cookies plus the `userToken` from localStorage when the export does not already include it.
- Qwen usually works directly from imported browser cookies because the export often includes the `token` cookie. Use `--token` only when that cookie is missing.
- Grok now uses the official `grok.com` web flow and returns a Grok-specific anti-bot error when xAI blocks browserless prompt writes.
- Music platforms: `src/platforms/music/bandcamp/`, `src/platforms/music/deezer/`, `src/platforms/music/soundcloud/`, `src/platforms/music/spotify/`, `src/platforms/music/youtube-music/`
- Shopping platforms: `src/platforms/shopping/amazon/`, `src/platforms/shopping/ebay/`, `src/platforms/shopping/etsy/`, `src/platforms/shopping/flipkart/`
- Tool platforms: `src/platforms/tools/cheat/`, `src/platforms/tools/dns/`, `src/platforms/tools/download/`, `src/platforms/tools/favicon/`, `src/platforms/tools/headers/`, `src/platforms/tools/http/`, `src/platforms/tools/ip/`, `src/platforms/tools/markdown-fetch/`, `src/platforms/tools/metadata/`, `src/platforms/tools/oembed/`, `src/platforms/tools/page-links/`, `src/platforms/tools/qr/`, `src/platforms/tools/redirect/`, `src/platforms/tools/robots/`, `src/platforms/tools/rss/`, `src/platforms/tools/screenshot/`, `src/platforms/tools/sitemap/`, `src/platforms/tools/ssl/`, `src/platforms/tools/time/`, `src/platforms/tools/timezone/`, `src/platforms/tools/transcript/`, `src/platforms/tools/translate/`, `src/platforms/tools/uptime/`, `src/platforms/tools/weather/`, `src/platforms/tools/websearch/`, `src/platforms/tools/whois/`
- Social platforms: `src/platforms/social/bluesky/`, `src/platforms/social/facebook/`, `src/platforms/social/instagram/`, `src/platforms/social/linkedin/`, `src/platforms/social/mastodon/`, `src/platforms/social/pinterest/`, `src/platforms/social/reddit/`, `src/platforms/social/telegram/`, `src/platforms/social/threads/`, `src/platforms/social/tiktok/`, `src/platforms/social/twitch/`, `src/platforms/social/whatsapp/`, `src/platforms/social/x/`, `src/platforms/social/youtube/`
- Spotify specifically now uses an internal engine split:
  - `web` for standard Web API endpoints
  - `connect` for connect-state playback/device/queue control
  - `auto` to prefer `connect` and fall back to `web`
