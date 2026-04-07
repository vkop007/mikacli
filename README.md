# AutoCLI

[![npm version](https://img.shields.io/npm/v/%40vk007%2Fautocli)](https://www.npmjs.com/package/@vk007/autocli)
[![license](https://img.shields.io/github/license/vkop007/autocli)](./LICENSE)
[![providers](https://img.shields.io/badge/providers-107-blue)](#category-overview)
[![categories](https://img.shields.io/badge/categories-14-6f42c1)](#category-overview)

AutoCLI is a terminal automation toolkit for developers and AI agents that turns websites, LLMs, developer platforms, editors, and utilities into one reusable CLI.

The core idea is simple:

- sign in once
- save the session or token locally
- keep using the provider headlessly from the terminal
- return clean `--json` output for scripts, agents, and orchestration

What makes AutoCLI especially useful is that it does not stop at API tokens. It works across cookies, saved browser sessions, user sessions, bot tokens, local tools, and public services, so the same CLI can drive GitHub, ChatGPT, Jira, Reddit, ffmpeg, DNS lookups, and more without switching tools.

## Why It Matters

- One command surface across `107` providers.
- Shared browser login means less manual cookie exporting for cookie-backed platforms.
- Sessions and tokens stay local, so follow-up commands are short and automation-friendly.
- Category-based routing stays predictable as the tool grows: `autocli llm ...`, `autocli social ...`, `autocli developer ...`, `autocli devops ...`.
- Every provider is designed to be script-friendly, with strong `--json` support.
- Provider capability metadata helps agents see auth type, stability, browser support, and read/write boundaries before they guess.
- Shared result normalization adds stable JSON aliases like `data.items`, `data.entity`, and `data.guidance`.

## Auto Browser Login

AutoCLI can keep a shared browser profile under its own control, let you sign in once, then reuse that browser state for later provider logins.

That means you can:

- log into Google or another identity provider once
- use `Continue with Google`, passkeys, or normal web sign-in flows
- let later provider logins reuse that same saved browser profile
- avoid re-exporting cookies every time for many cookie-backed providers

Typical flow:

```bash
autocli login --browser
autocli developer github login --browser
autocli social x login --browser
autocli llm qwen login --browser
```

After the provider session is saved, normal commands stay headless:

```bash
autocli developer github me --json
autocli social x post "Shipping from AutoCLI"
autocli llm qwen text "Summarize this changelog"
```

## At a Glance

| Item | Value |
| --- | --- |
| Package | `@vk007/autocli` |
| CLI command | `autocli` |
| Providers | `107` |
| Categories | `14` |
| npm install | `npm install -g @vk007/autocli` |
| bun install | `bun install -g @vk007/autocli` |
| Local setup | `bun install` |

## Get Started

Install globally with npm or Bun:

```bash
npm install -g @vk007/autocli
bun install -g @vk007/autocli
```

Validate the install right away:

```bash
autocli --version
autocli doctor
autocli doctor --fix
```

Set up the repo locally with Bun:

```bash
bun install
bun run build
```

Bootstrap the shared browser once if you want browser-assisted logins:

```bash
autocli login --browser
```

Typical commands:

```bash
autocli status
autocli search "youtube download"
autocli llm chatgpt text "Write release notes for AutoCLI"
autocli developer github login --browser
autocli developer github me --json
autocli developer github capabilities --json
autocli devops cloudflare zones --json
autocli devops render services --json
autocli tools page-links https://example.com --json
autocli tools http github inspect --json
```

Every provider help page now includes:

- a generated `Quick Start` block
- a `Support Profile` with auth, discovery, mutation, browser, and async support
- a `Stability Guide` so agents can tell whether a provider is `stable`, `partial`, or `experimental`

## Why Use AutoCLI

- Sign into real web apps once, then reuse the saved session from the terminal.
- Use the same CLI for LLMs, socials, developer tools, devops platforms, editors, and public utilities.
- Keep auth local to your machine instead of scattering cookies and tokens across one-off scripts.
- Give agents and scripts a stable command model with consistent JSON output.
- Reach protected web surfaces that are awkward to automate with plain APIs alone.

## Command Model

AutoCLI is category-only. Provider commands never live at the root.

- `autocli llm ...`
- `autocli editor ...`
- `autocli finance ...`
- `autocli maps ...`
- `autocli movie ...`
- `autocli news ...`
- `autocli music ...`
- `autocli social ...`
- `autocli shopping ...`
- `autocli developer ...`
- `autocli devops ...`
- `autocli bot ...`
- `autocli tools ...`

Examples:

```bash
autocli llm chatgpt text "Write release notes for AutoCLI"
autocli social x post "Shipping AutoCLI today"
autocli developer confluence search "release process"
autocli developer github me
autocli devops vercel projects
autocli bot telegrambot send 123456789 "Build finished"
autocli news top "AI"
autocli tools translate "hello world" --to hi
autocli tools timezone "Mumbai"
autocli tools oembed https://www.youtube.com/watch?v=dQw4w9WgXcQ
autocli tools http github request GET /settings/profile
autocli tools download info https://www.youtube.com/watch?v=dQw4w9WgXcQ
autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## Cross-Site Downloads

Use `autocli tools download` for multi-site media downloads powered by `yt-dlp`, with optional saved-session cookies from AutoCLI when a site needs auth.

Examples:

```bash
autocli tools download info https://www.youtube.com/watch?v=dQw4w9WgXcQ --json
autocli tools download video https://x.com/user/status/123 --platform x
autocli tools download video https://www.instagram.com/reel/SHORTCODE/ --platform instagram --account default
autocli tools download audio https://www.youtube.com/watch?v=dQw4w9WgXcQ --audio-format mp3
autocli tools download batch ./urls.txt --mode video --quality 720p
autocli tools download info 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' --playlist --limit 5
```

## Command Search

Use `autocli search` to find providers and exact runnable commands across AutoCLI's built-in command surface.

Examples:

```bash
autocli search github
autocli search "youtube download"
autocli search uptime --category devops
autocli search transcript --json
```

## Cross-Site Transcripts

Use `autocli tools transcript` to pull subtitles or transcripts from media pages supported by `yt-dlp`, with plain text by default and subtitle formats when you need them.

Examples:

```bash
autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ
autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --lang en --format srt
autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --auto --format json --json
```

## Agent JSON Conventions

AutoCLI keeps provider-specific fields, but it also adds a few stable JSON aliases so agents can plan and transform results more reliably:

- `data.items` for list-style results, even when the provider also returns keys like `repos`, `projects`, `posts`, or `recommendations`
- `data.entity` for singular objects, even when the provider also returns keys like `profile`, `page`, `movie`, or `project`
- `data.meta.count` and `data.meta.listKey` for quick list summaries
- `data.guidance.recommendedNextCommand` and `data.guidance.nextCommands` for safer follow-up planning

Example:

```bash
autocli social reddit search "bun cli" --json
autocli movie tmdb title 27205 --json
autocli developer github capabilities --json
```

## Stability Levels

- `stable`: ready for routine automation and the default choice when you have options
- `partial`: core flows work well, but some protected or edge routes may still need care
- `experimental`: useful, but still changing quickly and best used with extra verification
- `unknown`: not classified yet, so inspect with `capabilities --json` before leaning on it

To inspect a provider before acting:

```bash
autocli developer github capabilities --json
autocli social reddit capabilities --json
autocli devops railway capabilities --json
```

## Category Overview

| Category | Providers | Count | Needs | Why use it | Route |
| --- | --- | ---: | --- | --- | --- |
| `llm` | ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral, Perplexity, Qwen, Z.ai | 9 | cookies | Browserless prompting, image flows, generation jobs | `autocli llm <provider> ...` |
| `editor` | Archive, Audio, Document, GIF, Image, PDF, Subtitle, Video | 8 | local tools | Media and file transformations from the terminal | `autocli editor <provider> ...` |
| `finance` | Crypto, Currency/Forex, Stocks | 3 | none | Market, forex, and crypto lookups | `autocli finance <provider> ...` |
| `data` | CSV, HTML, JSON, Markdown, Text, XML, YAML | 7 | none | Structured data cleanup, conversion, filtering, and extraction for agents | `autocli data <provider> ...` |
| `maps` | Geo, OpenStreetMap, OSRM | 3 | none | Geocoding, reverse lookup, routing, geometry helpers | `autocli maps <provider> ...` |
| `movie` | AniList, IMDb, JustWatch, Kitsu, Letterboxd, MyAnimeList, TMDb, TVMaze | 8 | none or cookies | Public title lookup, anime tracking, streaming availability, and community taste signals | `autocli movie <provider> ...` |
| `news` | News | 1 | none | Public headline discovery, source search, and feed aggregation | `autocli news ...` |
| `music` | Bandcamp, Deezer, SoundCloud, Spotify, YouTube Music | 5 | none or cookies | Public music discovery plus session-backed playback and library workflows | `autocli music <provider> ...` |
| `social` | Bluesky, Facebook, Instagram, LinkedIn, Mastodon, Pinterest, Reddit, Telegram, Threads, TikTok, WhatsApp, X, YouTube | 13 | none, cookies, or session | Public profile/thread lookup plus cookie-backed posting, Reddit discovery and write automation, federated discovery, MTProto messaging, and QR/session-backed chat control where supported | `autocli social <provider> ...` |
| `shopping` | Amazon, eBay, Etsy, Flipkart | 4 | none or cookies | Product discovery plus account/cart/order surfaces where supported | `autocli shopping <provider> ...` |
| `developer` | Confluence, GitHub, GitLab, Jira, Linear, Notion, Trello | 7 | cookies | Developer and workspace automation | `autocli developer <provider> ...` |
| `devops` | Cloudflare, DigitalOcean, Fly.io, Netlify, Railway, Render, Supabase, UptimeRobot, Vercel | 9 | api token | Infrastructure, deployment, DNS, platform, backend, and uptime-monitoring automation | `autocli devops <provider> ...` |
| `bot` | Discord Bot, GitHub Bot, Slack Bot, Telegram Bot | 4 | bot token or app token | Notifications, chat ops, bot messaging | `autocli bot <provider> ...` |
| `tools` | Cheat, DNS, Download, Favicon, Headers, HTTP Toolkit, IP, Markdown Fetch, Metadata, oEmbed, Page Links, QR, Redirect, Robots, RSS, Screenshot, Sitemap, SSL, Time, Timezone, Transcript, Translate, Uptime, Weather, Web Search, Whois | 26 | none or cookies | Public utilities, cross-site downloads, transcript extraction, session-aware request inspection, and zero-setup helpers | `autocli tools <provider> ...` |

AutoCLI currently exposes `107` providers across `14` active command groups.

## Access Modes

| Needs | Meaning |
| --- | --- |
| `none` | Public or local functionality. No cookies, no token, no API key. |
| `local tools` | Uses binaries already installed on the machine, like `ffmpeg`, `ffprobe`, `qpdf`, or `yt-dlp`. |
| `cookies` | Import a browser session with `login --cookies ...` or let AutoCLI open a browser with `login --browser`, then reuse it headlessly. |
| `session` | Do one interactive login once, save the resulting user session locally, then reuse it headlessly. |
| `cookies + local token` | Cookie session plus a token the site keeps in localStorage or a similar client store. |
| `api token` | A personal or service token saved once with `login --token ...`. |
| `bot token` | A bot token saved once with `login --token ...`. |
| `browser later` | The current CLI route works for some surfaces, but more protected flows may later get an opt-in browser-backed mode. |

## Installation

### Recommended Global Install

Use the published package as the primary supported install path:

```bash
npm install -g @vk007/autocli
bun install -g @vk007/autocli
```

After install, verify the command and your local environment:

```bash
autocli --version
autocli doctor
autocli doctor --fix
autocli status
```

`autocli doctor` checks the shared browser setup plus optional local tools such as `ffmpeg`, `yt-dlp`, `qpdf`, `poppler`, `7z`, and macOS-native helpers when relevant.

On macOS, `autocli doctor --fix` can install all supported missing browser and local-tool dependencies automatically with Homebrew, then rerun the health check.

### Local Development Setup

Set up the repo locally with Bun:

```bash
bun install
```

Build the Node-targeted bundle:

```bash
bun run build
```

### Experimental Standalone Binary

You can also compile a standalone Bun binary:

```bash
bun run build:bin
```

This path is still experimental. The supported production install remains the npm or Bun global package above, because some runtime-heavy providers can behave differently in the compiled Bun binary.

### Local Development Linking

Link `autocli` globally for local development:

```bash
bun run link:global
```

If your shell still says `command not found`, open a new shell or run `hash -r`.

### Skill Doc Sync

Regenerate the provider-specific skill references and sync the installed Codex skill copy in one step:

```bash
bun run sync:skills
```

This refreshes the generated files under [`skills/autocli/references/providers`](./skills/autocli/references/providers) and copies the repo skill into your local Codex skill directory (defaults to `~/.codex/skills/autocli` unless `CODEX_HOME` is set).

`npm publish` now runs this automatically through `prepublishOnly`, so release builds regenerate and sync the skill docs before typecheck, tests, and build.

## Open Source Project Files

- [LICENSE](./LICENSE)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [AI Agent Skill](./skills/autocli/SKILL.md)

If you plan to contribute, please do not commit live cookies, tokens, QR session state, or personal exports. AutoCLI should only store those locally on the contributor machine, never in the repository.

## Quick Start

Check global status:

```bash
autocli status
autocli status --json
autocli doctor
autocli sessions
```

If you have not linked the CLI globally yet:

```bash
bun run dev status
```

Typical first-run flows:

```bash
autocli social x login --cookies ./x.cookies.json
autocli developer github login --browser
autocli llm chatgpt text "Summarize this changelog"
autocli developer github login --cookies ./github.cookies.json
autocli devops cloudflare login --token $CLOUDFLARE_API_TOKEN
autocli social telegram login --api-id 123456 --api-hash abcdef123456 --qr
autocli bot telegrambot login --token 123456:ABCDEF --name alerts-bot
autocli news top "AI"
autocli tools websearch search "bun commander zod"
autocli tools http github inspect
```

## Best Example Workflows

### Cookie-backed social posting

```bash
autocli social instagram login --cookies ./instagram.cookies.txt
autocli social instagram post ./photo.jpg --caption "Shipping from the terminal"
autocli social x login --cookies ./x.cookies.json
autocli social x post "Launching AutoCLI" --image ./launch.png
```

If you do not want to export cookies manually, many cookie-backed providers now also support:

```bash
autocli login --browser
autocli developer github login --browser
autocli social x login --browser
autocli llm qwen login --browser
```

`autocli login --browser` opens AutoCLI's shared browser profile so you can sign into Google or other identity providers once. Later provider logins reuse that same saved browser profile, and `autocli <category> <provider> login --browser` still skips opening the browser entirely when an already-saved active provider session is available.

### LLM prompting and generation

```bash
autocli llm chatgpt text "Write release notes for AutoCLI"
autocli llm deepseek login --cookies ./deepseek.cookies.json --token <userToken>
autocli llm deepseek text "Explain retrieval-augmented generation"
autocli llm grok image "Minimal orange fox logo on white background"
autocli llm grok video "Minimal orange fox logo with subtle camera motion"
```

### Developer and bot automation

```bash
autocli developer confluence search "deploy backend"
autocli developer github me
autocli developer gitlab projects "autocli" --limit 10
autocli developer jira projects
autocli developer linear issues --team ENG --limit 20
autocli developer trello boards
autocli devops netlify sites
autocli devops railway projects
autocli devops fly apps --org personal
autocli devops digitalocean apps
autocli bot telegrambot send 123456789 "Build finished"
autocli bot discordbot send 123456789012345678 "nightly deploy complete"
```

### Session-backed messaging

```bash
autocli social telegram login --api-id 123456 --api-hash abcdef123456 --qr
autocli social telegram send me "Hello from AutoCLI"
autocli social reddit search "bun cli"
autocli social reddit post programming "Launching AutoCLI" "Now with Reddit support."
autocli social whatsapp login
autocli social whatsapp send 919876543210 "Ping from AutoCLI"
```

### Public utilities

```bash
autocli news top "AI" --source google
autocli news search "typescript cli"
autocli news feed https://hnrss.org/frontpage --limit 5
autocli tools translate "hello world" --to hi
autocli tools websearch search "typescript cli bun"
autocli tools screenshot https://example.com --output-dir ./shots
autocli tools favicon openai.com
autocli tools page-links https://example.com --type external
autocli tools timezone "Mumbai"
autocli tools oembed https://www.youtube.com/watch?v=dQw4w9WgXcQ
autocli login --browser
autocli tools http github.com capture --browser-timeout 60
autocli tools http github.com capture --summary --group-by endpoint --browser-timeout 60
autocli tools uptime https://example.com --json
autocli tools rss https://hnrss.org/frontpage --limit 5
```

### Music discovery and download

```bash
autocli music bandcamp search "radiohead"
autocli music bandcamp album https://radiohead.bandcamp.com/album/in-rainbows
autocli music soundcloud search "dandelions"
autocli music soundcloud user aviciiofficial
autocli music soundcloud playlist https://soundcloud.com/lofi-hip-hop-music/sets/lofi-lofi
autocli music soundcloud download "dandelions" --output-dir ./downloads
```

### Local editing

```bash
autocli editor image resize ./photo.png --width 1200
autocli editor video split ./clip.mp4 --every 30
autocli editor audio loudness-report ./podcast.wav
autocli editor pdf watermark ./deck.pdf --text "Internal"
autocli editor subtitle burn ./video.mp4 --subtitle ./captions.srt
```

## Sessions And Connections

Cookie sessions are stored under:

```text
~/.autocli/sessions/<platform>/<account>.json
```

Token, bot, and saved session connections are stored under:

```text
~/.autocli/connections/<platform>/<account>.json
```

AutoCLI supports importing:

- Netscape `cookies.txt`
- raw cookie strings
- JSON cookie arrays
- serialized `tough-cookie` jars

After the first `login`, later commands normally omit `--account` or `--bot` and AutoCLI uses the most recently saved connection for that provider.

## Provider Matrix

The `Stability` column below matches the runtime metadata behind `autocli <category> <provider> capabilities --json`.

### LLM

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| ChatGPT | `stable` | cookies | text prompts and image prompting | Authenticated web flow is supported; richer media generation is still evolving. |
| Claude | `partial` | cookies | Claude web-session access | Text prompting is the clearest supported path today; richer media flows still depend on private web-flow drift. |
| DeepSeek | `partial` | cookies + local token | browserless DeepSeek chat | Text chat works; image and video prompting are not mapped yet. Needs browser cookies and sometimes `userToken` from site storage. |
| Gemini | `stable` | cookies | Google Gemini prompting and media flows | Works from imported browser sessions; download helpers are wired for media jobs. |
| Grok | `partial` | cookies | text, image, and async video generation | Best current fit for job-style image/video workflows. |
| Mistral | `partial` | cookies | browserless Mistral chat | Cookie-backed text flow is implemented; image/video support is still limited. |
| Perplexity | `partial` | cookies | search-heavy prompting | Uses Perplexity’s live web flow for browserless text prompts; image/video support is still limited. |
| Qwen | `partial` | cookies | cookie-backed Qwen chat | Usually works directly from exported browser cookies. |
| Z.ai | `partial` | cookies | cookie-backed chat workflows | Session-backed provider for text-oriented usage today; media flows are still limited. |

### Editor

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Archive Editor | `stable` | local tools | create, inspect, and extract archives | Good for zip/tar/gzip workflows. |
| Audio Editor | `stable` | local tools | trim, convert, normalize, denoise, report | Built around `ffmpeg` and related local tooling. |
| Document Editor | `stable` | local tools | document conversion, OCR, and text extraction | Useful for format conversion, OCR, and markdown export. |
| GIF Editor | `stable` | local tools | GIF create, optimize, and video conversion | Great for social clips and quick previews. |
| Image Editor | `stable` | local tools | image transformation pipelines | Includes upscale, background remove, watermark, compress, metadata strip, and more. |
| PDF Editor | `stable` | local tools | merge, split, watermark, reorder, secure | Also supports `to-images`, with better multi-page output when `pdftoppm` is installed. |
| Subtitle Editor | `stable` | local tools | shift, clean, merge, burn subtitles | Pairs well with YouTube and video publishing flows. |
| Video Editor | `stable` | local tools | split, stabilize, scene detect, overlay, transcode | Strong `ffmpeg`-driven video workflow surface. |

### Finance

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Crypto | `stable` | none | crypto spot price lookup | No key required. |
| Currency | `stable` | none | currency conversion and forex math | Also exposed naturally as forex conversion. |
| Stocks | `stable` | none | stock quote lookups | Public market data surface. |

### Data

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| CSV | `stable` | none | inspect, filter, and convert CSV | Good for tabular exports and spreadsheet-style data. |
| HTML | `stable` | none | extract plain text or convert HTML to Markdown | Useful after scraping or page capture workflows. |
| JSON | `stable` | none | format, query, and merge JSON | Best glue layer for agent workflows across providers. |
| Markdown | `stable` | none | convert Markdown to HTML or text | Good for docs, release notes, and prompt shaping. |
| Text | `stable` | none | stats, replace, and dedupe lines | Useful for cleanup and normalization between steps. |
| XML | `stable` | none | format XML and convert it to JSON | Useful for feeds, sitemaps, and older structured formats. |
| YAML | `stable` | none | format YAML and convert it to JSON | Good for configs, manifests, and infra files. |

### Maps

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Geo | `stable` | none | distance, midpoint, plus codes, elevation | Pure local/public helpers plus public elevation lookup. |
| OpenStreetMap | `stable` | none | search, reverse geocode, nearby lookup | Uses public OSM and Overpass services. |
| OSRM | `stable` | none | route, trip, table, nearest, match | Public routing and trip calculations. |

### Movie

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| AniList | `stable` | none | anime title lookup, trending, recommendations | Public anime metadata plus trending and recs. |
| IMDb | `stable` | none | movie and show lookup | Public search/title surface. |
| JustWatch | `stable` | none | where-to-watch checks | Streaming availability lookup. |
| Kitsu | `stable` | none | anime and manga discovery | Alternative anime metadata source. |
| Letterboxd | `stable` | none | film pages, diary feeds, and community taste | Public film pages plus profile and diary/RSS reading. |
| MyAnimeList | `stable` | none or cookies | public search plus your own saved list | Public lookups work without cookies; personal defaults can use cookies. |
| TMDb | `stable` | none | broad movie and TV title lookup | Uses TMDb's live public web catalog for search, title detail, popular titles, and recommendations. |
| TVMaze | `stable` | none | TV and episode-oriented title lookup | Strong TV-first public catalog with episode lists. |

### Music

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Bandcamp | `stable` | none | public artist, album, and track lookup | Uses Bandcamp search plus readable album, track, and artist pages. |
| Deezer | `stable` | none | public track, album, artist, and playlist lookup | Uses Deezer's public entity API and a public search fallback where regional search is weak. |
| SoundCloud | `stable` | none | public track, playlist, and user discovery | Uses SoundCloud's public web client flow and can download tracks when a public stream is exposed. |
| Spotify | `stable` | cookies | library, playback, queue, playlists | Strongest playback-control surface in the repo today. |
| YouTube Music | `partial` | cookies | search and local playback control | Read commands can fall back to public browsing in some flows. |

### Social

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Bluesky | `stable` | none | public profile, feed, and thread lookup | Uses Bluesky's public appview API, so it is cleaner and more stable than most social adapters. |
| Facebook | `partial` | cookies | session import and light account automation | Validation and safer read surfaces are strongest today; protected write flows are still conservative. |
| Instagram | `partial` | cookies | posting, downloads, stories, follows | One of the strongest cookie-backed social adapters in the repo. |
| LinkedIn | `partial` | cookies | posting and engagement | Text posting works best; richer media/write surfaces can drift and may need adapter refreshes over time. |
| Mastodon | `stable` | none | federated profile, posts, and thread lookup | Uses public instance APIs and respects the target instance when resolving accounts and statuses. |
| Pinterest | `stable` | none | public pin, profile, and board discovery | Good public-read discovery surface without cookies. |
| Reddit | `partial` | none or cookies | public post/thread discovery plus session-backed posting, comments, votes, and saves | Public reads use Reddit's JSON endpoints; writes can use a saved session or the shared browser profile with `--browser`. |
| Telegram | `partial` | session | QR, phone, or session-string login for account messaging | Uses MTProto with a saved user session, not browser cookies. |
| Threads | `partial` | none | public profile, post, and reply lookup | Uses the live Threads web surface through readable extraction; good for discovery, not write automation yet. |
| TikTok | `partial` | cookies | session handling and light public automation | Session validation and read flows are strongest today; signing for private web writes is still a known hard part. |
| WhatsApp | `partial` | session | QR or pairing-code login for account messaging | Uses a saved WhatsApp multi-device auth state with cached chats/messages for terminal workflows. |
| X | `partial` | cookies | posting, likes, profile/tweet lookup | Strong cookie-backed adapter with browser-backed write flows to reduce X automation friction. |
| YouTube | `partial` | cookies | search, likes, comments, downloads | Upload/community posting are still separate future work. |

### Partial Support Notes

These providers are intentionally included, but their current browserless surface is narrower than their full website:

- `Claude`, `DeepSeek`, `Mistral`, `Perplexity`, and `Z.ai` are strongest on text-oriented prompting today.
- `Facebook` and `TikTok` are more reliable for session validation and lighter read flows than for protected web writes.
- `LinkedIn` works best for text-first posting and engagement, but richer web flows can drift.
- `YouTube` is strong for search, engagement, subscriptions, and downloads, while upload/community publishing is still separate future work.

### Shopping

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Amazon | `partial` | cookies | account, cart, add-to-cart, remove-from-cart, update-cart, search, product lookup | `add-to-cart`, `remove-from-cart`, `update-cart`, `cart`, `orders`, and `order` support browser-backed execution when the saved session alone is not enough. |
| eBay | `stable` | none | public listings, item lookup, seller discovery | Uses public readable page extraction plus the public autocomplete endpoint. |
| Etsy | `partial` | none | public listing and shop discovery | Direct Etsy fetches are anti-bot protected, so this adapter uses public site-search discovery today. |
| Flipkart | `stable` | cookies | account, wishlist, cart, add-to-cart, remove-from-cart, update-cart, orders | Uses the saved Flipkart session for cart actions. New adds use the authenticated cart endpoint; quantity updates and removals use the saved session in an invisible browser. |

### Developer

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Confluence | `stable` | cookies | spaces, pages, search, comments, page creation | Uses an Atlassian web session to search and edit workspace documentation from the terminal. |
| GitHub | `stable` | cookies | repos, issues, pull requests, stars | Uses a saved GitHub web session for browserless developer automation. |
| GitLab | `stable` | cookies | projects, issues, merge requests | Uses a saved GitLab web session instead of personal access tokens. |
| Jira | `stable` | cookies | projects, issues, JQL search, issue creation | Saves a site-scoped Jira web session and reuses it for browserless workspace automation. |
| Linear | `partial` | cookies | issue management and comments | Uses the saved Linear web session for GraphQL issue workflows. |
| Notion | `partial` | cookies | search, pages, databases, comments | Uses the saved Notion web session instead of an official integration token. |
| Trello | `stable` | cookies | boards, lists, cards, card creation | Uses a saved Trello web session for browserless board and card workflows. |

### DevOps

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Cloudflare | `stable` | api token | zones, DNS, and account-level infrastructure automation | Strong official API surface for DNS and zone operations. |
| DigitalOcean | `stable` | api token | App Platform, deployments, and domains | Uses the official App Platform and account APIs. |
| Fly.io | `partial` | api token | apps, machines, volumes, and certificates | Some tokens may need an explicit `--org` slug for the cleanest results. |
| Netlify | `stable` | api token | sites, deploys, DNS, and team account automation | Good fit for deployment and static hosting workflows. |
| Railway | `partial` | api token | projects, services, and environment-oriented platform workflows | Uses Railway’s GraphQL surface, so deeper actions may still expand over time. |
| Render | `stable` | api token | services, projects, and env-group automation | Strong official REST API for deployment and service inspection. |
| Supabase | `stable` | api token | organizations, projects, and functions | Good backend/platform automation surface. |
| Vercel | `stable` | api token | teams, projects, and deployments | Strong deployment-centric API coverage. |

### Bot

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Discord Bot | `stable` | bot token | guild/channel messaging automation | Good for notifications and chat ops. |
| GitHub Bot | `stable` | api token | GitHub app or bot-token actions | Same GitHub surface, but bot-style auth. |
| Slack Bot | `stable` | bot token | channel history, send, edit, file upload | Strong for workspace notification flows. |
| Telegram Bot | `stable` | bot token | send, edit, media, updates | Good default bot adapter for lightweight notifications. |

### Tools

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| Cheat | `stable` | none | shell and language cheat sheets | Fast terminal help. |
| DNS | `stable` | none | DNS record lookups | Good for quick ops checks. |
| Favicon | `stable` | none | site icon discovery and verification | Resolves declared icon tags, falls back to `/favicon.ico`, and verifies candidates. |
| Headers | `stable` | none | inspect raw HTTP response headers | Useful for cache, CDN, and server debugging. |
| HTTP Toolkit | `stable` | none or cookies | inspect saved sessions, attach to the shared browser, and replay authenticated requests | Best for session-aware debugging on sites where plain `curl` is not enough. |
| IP | `stable` | none | public IP and network details | Fast no-auth network lookup. |
| Markdown Fetch | `stable` | none | turn pages into markdown-like text | Useful for scraping readable content. |
| Metadata | `stable` | none | webpage title and social tags | Extracts title, description, canonical, favicon, Open Graph, and Twitter tags. |
| oEmbed | `stable` | none | embeddable media/page metadata from URLs | Uses page-discovered oEmbed endpoints first, then falls back to a public resolver. |
| Page Links | `stable` | none | internal/external link extraction from webpages | Useful for crawls, site audits, and agent discovery. |
| QR | `stable` | none | QR generation | Can save or print a public image URL. |
| Redirect | `stable` | none | redirect-chain tracing | Shows each HTTP hop and final destination. |
| Robots | `stable` | none | `robots.txt` inspection | Useful for site crawling checks. |
| RSS | `stable` | none | feed inspection | Reads RSS/Atom without setup. |
| Screenshot | `stable` | none | URL-to-image captures | Public no-key render service. |
| Sitemap | `stable` | none | sitemap discovery and listing | Good for SEO/crawl inspection. |
| SSL | `stable` | none | TLS certificate inspection | Shows certificate, issuer, SANs, protocol, and expiry. |
| Time | `stable` | none | timezone and current time lookup | Public time APIs. |
| Timezone | `stable` | none | resolve timezone from a place, coordinates, or IANA zone | Useful for scheduling, agent routing, and regional workflows. |
| Translate | `stable` | none | quick translation | Uses a public translation endpoint. |
| Uptime | `stable` | none | latency and HTTP health checks | Lightweight monitoring helper. |
| Weather | `stable` | none | weather lookup | No account required. |
| Web Search | `stable` | none | multi-engine search | Supports summaries and engine selection. |
| Whois | `stable` | none | domain registration details | Useful for domain inspection. |

### News

| Provider | Stability | Needs | Best for | Notes |
| --- | --- | --- | --- | --- |
| News | `stable` | none | headline and feed aggregation | Pulls from public no-key sources like Google News, GDELT, Hacker News, Reddit, and raw RSS feeds. |

## Agent-Friendly Output

Every command supports `--json`.

Success shape:

```json
{
  "ok": true,
  "platform": "x",
  "account": "personal",
  "action": "post",
  "message": "X post created for personal.",
  "id": "1234567890",
  "url": "https://x.com/user/status/1234567890"
}
```

Error shape:

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "X returned a logged-out page. Re-import cookies.txt."
  }
}
```

This makes AutoCLI friendly for:

- shell scripts
- CI jobs
- multi-step agents
- external orchestrators

## Session Refresh

AutoCLI includes a refresh layer in `src/utils/autorefresh.ts`.

- Instagram, X, and YouTube can use lightweight authenticated keepalive checks before normal actions.
- Rotated cookies are persisted back into the saved session file when the platform returns them.
- Some platforms still do not support a durable cookie-only refresh path, so expiration handling remains provider-specific.

This is the most practical browserless approach for copied web sessions, but it is not a universal guarantee for every website.

For cookie-backed providers that support interactive capture, you can also use `login --browser` to open a real browser, complete the sign-in flow manually, and let AutoCLI save the session automatically.

## Project Structure

```text
.
├── README.md
├── package.json
├── tsconfig.json
└── src
    ├── __tests__
    ├── core
    │   ├── auth
    │   └── runtime
    ├── commands
    ├── platforms
    │   ├── bot
    │   ├── developer
    │   ├── editor
    │   ├── finance
    │   ├── llm
    │   ├── maps
    │   ├── movie
    │   ├── music
    │   ├── shopping
    │   ├── social
    │   ├── tools
    │   ├── config.ts
    │   └── index.ts
    ├── utils
    ├── config.ts
    ├── errors.ts
    ├── index.ts
    └── logger.ts
```

## Development

Run the local CLI:

```bash
bun run dev --help
bun run dev social x login --cookies ./cookie.json
```

Watch mode:

```bash
bun run dev:watch --help
```

Typecheck:

```bash
bun run typecheck
```

Run tests:

```bash
bun test
```

## Notes On Reliability

- Cookie-backed private web flows can drift as providers change internal endpoints.
- Token-backed developer and bot providers are usually the most stable long-term.
- Local editor and public utility providers are the least fragile because they do not depend on private web sessions.
- The category model is intentionally strict so provider names do not collide as AutoCLI grows.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vkop007/autocli&type=Date)](https://star-history.com/#vkop007/autocli&Date)
