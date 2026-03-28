# AutoCLI

AutoCLI is a Bun-first TypeScript CLI for terminal automation across LLMs, social platforms, shopping sites, bots, developer tools, editors, maps, finance, and public utilities.

The core idea is simple:

- connect once
- save the session or token locally
- keep using category-based commands from the terminal
- return clean `--json` output for scripts and agents

For cookie-backed and session-backed platforms, AutoCLI is designed to stay headless after setup. For token-backed platforms, AutoCLI stores the connection once and reuses it. For local editors and public utilities, there is no auth step at all.

## Why Use AutoCLI

- One command surface for many provider types: cookies, saved user sessions, API tokens, bot tokens, local tools, and no-auth public services.
- Category-first routing keeps the CLI scalable as providers grow: `autocli llm ...`, `autocli social ...`, `autocli developer ...`, `autocli tools ...`.
- Every provider is script-friendly and supports `--json`.
- Sessions and tokens are stored locally, so follow-up commands are short and automation-friendly.
- Editors, downloads, public utilities, and platform automation live in the same CLI instead of being split across many tools.

## Command Model

AutoCLI is category-only. Provider commands never live at the root.

- `autocli llm ...`
- `autocli editor ...`
- `autocli finance ...`
- `autocli maps ...`
- `autocli movie ...`
- `autocli music ...`
- `autocli social ...`
- `autocli shopping ...`
- `autocli developer ...`
- `autocli bot ...`
- `autocli tools ...`

Examples:

```bash
autocli llm chatgpt text "Write release notes for AutoCLI"
autocli social x post "Shipping AutoCLI today"
autocli developer github me
autocli bot telegrambot send 123456789 "Build finished"
autocli tools translate "hello world" --to hi
```

## Category Overview

| Category | Providers | Count | Needs | Why use it | Route |
| --- | --- | ---: | --- | --- | --- |
| `llm` | ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral, Perplexity, Qwen, Z.ai | 9 | cookies | Browserless prompting, image flows, generation jobs | `autocli llm <provider> ...` |
| `editor` | Archive, Audio, Document, GIF, Image, PDF, Subtitle, Video | 8 | local tools | Media and file transformations from the terminal | `autocli editor <provider> ...` |
| `finance` | Crypto, Currency/Forex, Stocks | 3 | none | Market, forex, and crypto lookups | `autocli finance <provider> ...` |
| `data` | CSV, HTML, JSON, Markdown, Text, XML, YAML | 7 | none | Structured data cleanup, conversion, filtering, and extraction for agents | `autocli data <provider> ...` |
| `maps` | Geo, OpenStreetMap, OSRM | 3 | none | Geocoding, reverse lookup, routing, geometry helpers | `autocli maps <provider> ...` |
| `movie` | AniList, IMDb, JustWatch, Kitsu, MyAnimeList, TMDb, TVMaze | 7 | none or cookies | Public title lookup, anime tracking, streaming availability | `autocli movie <provider> ...` |
| `music` | Bandcamp, SoundCloud, Spotify, YouTube Music | 4 | none or cookies | Public music discovery plus session-backed playback and library workflows | `autocli music <provider> ...` |
| `social` | Bluesky, Facebook, Instagram, LinkedIn, Pinterest, Telegram, Threads, TikTok, WhatsApp, X, YouTube | 11 | none, cookies, or session | Public profile/thread lookup plus cookie-backed posting, MTProto messaging, and QR/session-backed chat control where supported | `autocli social <provider> ...` |
| `shopping` | Amazon, eBay, Etsy, Flipkart | 4 | none or cookies | Product discovery plus account/cart/order surfaces where supported | `autocli shopping <provider> ...` |
| `developer` | GitHub, GitLab, Jira, Linear, Notion, Trello | 6 | cookies | Developer and workspace automation | `autocli developer <provider> ...` |
| `bot` | Discord Bot, GitHub Bot, Slack Bot, Telegram Bot | 4 | bot token or app token | Notifications, chat ops, bot messaging | `autocli bot <provider> ...` |
| `tools` | Cheat, DNS, Favicon, Headers, IP, Markdown Fetch, Metadata, News, Page Links, QR, Redirect, Robots, RSS, Screenshot, Sitemap, SSL, Time, Translate, Uptime, Weather, Web Search, Whois | 22 | none | Public utilities with zero account setup | `autocli tools <provider> ...` |

AutoCLI currently exposes `88` providers across `12` active command groups.

## Access Modes

| Needs | Meaning |
| --- | --- |
| `none` | Public or local functionality. No cookies, no token, no API key. |
| `local tools` | Uses binaries already installed on the machine, like `ffmpeg`, `ffprobe`, `qpdf`, or `yt-dlp`. |
| `cookies` | Import a browser session once with `login --cookies ...`, then reuse it headlessly. |
| `session` | Do one interactive login once, save the resulting user session locally, then reuse it headlessly. |
| `cookies + local token` | Cookie session plus a token the site keeps in localStorage or a similar client store. |
| `api token` | A personal or service token saved once with `login --token ...`. |
| `bot token` | A bot token saved once with `login --token ...`. |
| `browser later` | The current CLI route works for some surfaces, but more protected flows may later get an opt-in browser-backed mode. |

## Installation

Install dependencies:

```bash
bun install
```

Build the Node-targeted bundle:

```bash
bun run build
```

Build a standalone Bun binary:

```bash
bun run build:bin
```

Link `autocli` globally for local development:

```bash
bun run link:global
```

If your shell still says `command not found`, open a new shell or run `hash -r`.

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
autocli llm chatgpt text "Summarize this changelog"
autocli developer github login --cookies ./github.cookies.json
autocli social telegram login --api-id 123456 --api-hash abcdef123456 --qr
autocli bot telegrambot login --token 123456:ABCDEF --name alerts-bot
autocli tools websearch search "bun commander zod"
```

## Best Example Workflows

### Cookie-backed social posting

```bash
autocli social instagram login --cookies ./instagram.cookies.txt
autocli social instagram post ./photo.jpg --caption "Shipping from the terminal"
autocli social x login --cookies ./x.cookies.json
autocli social x post "Launching AutoCLI" --image ./launch.png
```

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
autocli developer github me
autocli developer gitlab projects "autocli" --limit 10
autocli developer jira projects
autocli developer linear issues --team ENG --limit 20
autocli developer trello boards
autocli bot telegrambot send 123456789 "Build finished"
autocli bot discordbot send 123456789012345678 "nightly deploy complete"
```

### Session-backed messaging

```bash
autocli social telegram login --api-id 123456 --api-hash abcdef123456 --qr
autocli social telegram send me "Hello from AutoCLI"
autocli social whatsapp login
autocli social whatsapp send 919876543210 "Ping from AutoCLI"
```

### Public utilities

```bash
autocli tools translate "hello world" --to hi
autocli tools websearch search "typescript cli bun"
autocli tools screenshot https://example.com --output-dir ./shots
autocli tools favicon openai.com
autocli tools page-links https://example.com --type external
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

### LLM

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| ChatGPT | cookies | text prompts and image prompting | Authenticated web flow is supported; richer media generation is still evolving. |
| Claude | cookies | Claude web-session access | Session-backed scaffolding exists; prompt reliability depends on the current private web flow. |
| DeepSeek | cookies + local token | browserless DeepSeek chat | Needs browser cookies and sometimes `userToken` from site storage. |
| Gemini | cookies | Google Gemini prompting and media flows | Works from imported browser sessions; download helpers are wired for media jobs. |
| Grok | cookies | text, image, and async video generation | Best current fit for job-style image/video workflows. |
| Mistral | cookies | browserless Mistral chat | Cookie-backed text flow is implemented. |
| Perplexity | cookies | search-heavy prompting | Uses Perplexity’s live web flow for browserless text prompts. |
| Qwen | cookies | cookie-backed Qwen chat | Usually works directly from exported browser cookies. |
| Z.ai | cookies | cookie-backed chat workflows | Session-backed provider for text-oriented LLM usage. |

### Editor

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| Archive Editor | local tools | create, inspect, and extract archives | Good for zip/tar/gzip workflows. |
| Audio Editor | local tools | trim, convert, normalize, denoise, report | Built around `ffmpeg` and related local tooling. |
| Document Editor | local tools | document conversion, OCR, and text extraction | Useful for format conversion, OCR, and markdown export. |
| GIF Editor | local tools | GIF create, optimize, and video conversion | Great for social clips and quick previews. |
| Image Editor | local tools | image transformation pipelines | Includes upscale, background remove, watermark, compress, metadata strip, and more. |
| PDF Editor | local tools | merge, split, watermark, reorder, secure | Also supports `to-images`, with better multi-page output when `pdftoppm` is installed. |
| Subtitle Editor | local tools | shift, clean, merge, burn subtitles | Pairs well with YouTube and video publishing flows. |
| Video Editor | local tools | split, stabilize, scene detect, overlay, transcode | Strong `ffmpeg`-driven video workflow surface. |

### Finance

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| Crypto | none | crypto spot price lookup | No key required. |
| Currency | none | currency conversion and forex math | Also exposed naturally as forex conversion. |
| Stocks | none | stock quote lookups | Public market data surface. |

### Data

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| CSV | none | inspect, filter, and convert CSV | Good for tabular exports and spreadsheet-style data. |
| HTML | none | extract plain text or convert HTML to Markdown | Useful after scraping or page capture workflows. |
| JSON | none | format, query, and merge JSON | Best glue layer for agent workflows across providers. |
| Markdown | none | convert Markdown to HTML or text | Good for docs, release notes, and prompt shaping. |
| Text | none | stats, replace, and dedupe lines | Useful for cleanup and normalization between steps. |
| XML | none | format XML and convert it to JSON | Useful for feeds, sitemaps, and older structured formats. |
| YAML | none | format YAML and convert it to JSON | Good for configs, manifests, and infra files. |

### Maps

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| Geo | none | distance, midpoint, plus codes, elevation | Pure local/public helpers plus public elevation lookup. |
| OpenStreetMap | none | search, reverse geocode, nearby lookup | Uses public OSM and Overpass services. |
| OSRM | none | route, trip, table, nearest, match | Public routing and trip calculations. |

### Movie

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| AniList | none | anime title lookup, trending, recommendations | Public anime metadata plus trending and recs. |
| IMDb | none | movie and show lookup | Public search/title surface. |
| JustWatch | none | where-to-watch checks | Streaming availability lookup. |
| Kitsu | none | anime and manga discovery | Alternative anime metadata source. |
| MyAnimeList | none or cookies | public search plus your own saved list | Public lookups work without cookies; personal defaults can use cookies. |
| TMDb | none | broad movie and TV title lookup | Uses TMDb's live public web catalog for search, title detail, popular titles, and recommendations. |
| TVMaze | none | TV and episode-oriented title lookup | Strong TV-first public catalog with episode lists. |

### Music

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| Bandcamp | none | public artist, album, and track lookup | Uses Bandcamp search plus readable album, track, and artist pages. |
| SoundCloud | none | public track, playlist, and user discovery | Uses SoundCloud's public web client flow and can download tracks when a public stream is exposed. |
| Spotify | cookies | library, playback, queue, playlists | Strongest playback-control surface in the repo today. |
| YouTube Music | cookies | search and local playback control | Read commands can fall back to public browsing in some flows. |

### Social

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| Bluesky | none | public profile, feed, and thread lookup | Uses Bluesky's public appview API, so it is cleaner and more stable than most social adapters. |
| Facebook | cookies | session import and future social automation | Protected write flows are still conservative; browser later may help for harder surfaces. |
| Instagram | cookies | posting, downloads, stories, follows | One of the strongest cookie-backed social adapters in the repo. |
| LinkedIn | cookies | posting and engagement | Web write flow works, but LinkedIn can drift and may need adapter refreshes over time. |
| Pinterest | none | public pin, profile, and board discovery | Good public-read discovery surface without cookies. |
| Telegram | session | QR, phone, or session-string login for account messaging | Uses MTProto with a saved user session, not browser cookies. |
| Threads | none | public profile, post, and reply lookup | Uses the live Threads web surface through readable extraction; good for discovery, not write automation yet. |
| TikTok | cookies | session handling and future posting flows | Signing for private web writes is still a known hard part; browser later may help. |
| WhatsApp | session | QR or pairing-code login for account messaging | Uses a saved WhatsApp multi-device auth state with cached chats/messages for terminal workflows. |
| X | cookies | posting, likes, profile/tweet lookup | Strong cookie-backed adapter with reliable agent-friendly output. |
| YouTube | cookies | search, likes, comments, downloads | Upload/community posting are still separate future work. |

### Shopping

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| Amazon | cookies | account, cart, search, product lookup | Some order-history surfaces are more protected and may need browser later. |
| eBay | none | public listings, item lookup, seller discovery | Uses public readable page extraction plus the public autocomplete endpoint. |
| Etsy | none | public listing and shop discovery | Direct Etsy fetches are anti-bot protected, so this adapter uses public site-search discovery today. |
| Flipkart | cookies | account, wishlist, cart, orders | Stronger browserless account coverage today than Amazon. |

### Developer

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| GitHub | cookies | repos, issues, pull requests, stars | Uses a saved GitHub web session for browserless developer automation. |
| GitLab | cookies | projects, issues, merge requests | Uses a saved GitLab web session instead of personal access tokens. |
| Jira | cookies | projects, issues, JQL search, issue creation | Saves a site-scoped Jira web session and reuses it for browserless workspace automation. |
| Linear | cookies | issue management and comments | Uses the saved Linear web session for GraphQL issue workflows. |
| Notion | cookies | search, pages, databases, comments | Uses the saved Notion web session instead of an official integration token. |
| Trello | cookies | boards, lists, cards, card creation | Uses a saved Trello web session for browserless board and card workflows. |

### Bot

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| Discord Bot | bot token | guild/channel messaging automation | Good for notifications and chat ops. |
| GitHub Bot | api token | GitHub app or bot-token actions | Same GitHub surface, but bot-style auth. |
| Slack Bot | bot token | channel history, send, edit, file upload | Strong for workspace notification flows. |
| Telegram Bot | bot token | send, edit, media, updates | Good default bot adapter for lightweight notifications. |

### Tools

| Provider | Needs | Best for | Notes |
| --- | --- | --- | --- |
| Cheat | none | shell and language cheat sheets | Fast terminal help. |
| DNS | none | DNS record lookups | Good for quick ops checks. |
| Favicon | none | site icon discovery and verification | Resolves declared icon tags, falls back to `/favicon.ico`, and verifies candidates. |
| Headers | none | inspect raw HTTP response headers | Useful for cache, CDN, and server debugging. |
| IP | none | public IP and network details | Fast no-auth network lookup. |
| Markdown Fetch | none | turn pages into markdown-like text | Useful for scraping readable content. |
| Metadata | none | webpage title and social tags | Extracts title, description, canonical, favicon, Open Graph, and Twitter tags. |
| News | none | headline and feed aggregation | Pulls from public no-key sources. |
| Page Links | none | internal/external link extraction from webpages | Useful for crawls, site audits, and agent discovery. |
| QR | none | QR generation | Can save or print a public image URL. |
| Redirect | none | redirect-chain tracing | Shows each HTTP hop and final destination. |
| Robots | none | `robots.txt` inspection | Useful for site crawling checks. |
| RSS | none | feed inspection | Reads RSS/Atom without setup. |
| Screenshot | none | URL-to-image captures | Public no-key render service. |
| Sitemap | none | sitemap discovery and listing | Good for SEO/crawl inspection. |
| SSL | none | TLS certificate inspection | Shows certificate, issuer, SANs, protocol, and expiry. |
| Time | none | timezone and current time lookup | Public time APIs. |
| Translate | none | quick translation | Uses a public translation endpoint. |
| Uptime | none | latency and HTTP health checks | Lightweight monitoring helper. |
| Weather | none | weather lookup | No account required. |
| Web Search | none | multi-engine search | Supports summaries and engine selection. |
| Whois | none | domain registration details | Useful for domain inspection. |

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
