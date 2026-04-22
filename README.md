# MikaCLI

<!-- GENERATED:badges:start -->
[![npm version](https://img.shields.io/npm/v/mikacli)](https://www.npmjs.com/package/mikacli)
[![license](https://img.shields.io/github/license/vkop007/mikacli)](./LICENSE)
[![providers](https://img.shields.io/badge/providers-117-blue)](#category-overview)
[![categories](https://img.shields.io/badge/categories-16-6f42c1)](#category-overview)
<!-- GENERATED:badges:end -->

MikaCLI is a terminal automation toolkit for developers and AI agents that turns websites, LLMs, developer platforms, editors, and utilities into one reusable CLI.

The core idea is simple:

- sign in once
- save the session or token locally
- keep using the provider headlessly from the terminal
- return clean `--json` output for scripts, agents, and orchestration

What makes MikaCLI especially useful is that it does not stop at API tokens. It works across cookies, saved browser sessions, user sessions, bot tokens, local tools, and public services, so the same CLI can drive GitHub, ChatGPT, Jira, Reddit, ffmpeg, DNS lookups, and more without switching tools.

## Why It Matters

<!-- GENERATED:why-it-matters-count:start -->
- One command surface across `117` providers.
<!-- GENERATED:why-it-matters-count:end -->
- Shared browser login means less manual cookie exporting for cookie-backed platforms.
- Sessions and tokens stay local, so follow-up commands are short and automation-friendly.
- Category-based routing stays predictable as the tool grows: `mikacli llm ...`, `mikacli google ...`, `mikacli social ...`, `mikacli developer ...`, `mikacli devops ...`.
- Every provider is designed to be script-friendly, with strong `--json` support.
- Provider capability metadata helps agents see auth type, stability, browser support, and read/write boundaries before they guess.
- Shared result normalization adds stable JSON aliases like `data.items`, `data.entity`, and `data.guidance`.

## Auto Browser Login

MikaCLI can keep a shared browser profile under its own control, let you sign in once, then reuse that browser state for later provider logins.

That means you can:

- log into Google or another identity provider once
- use `Continue with Google`, passkeys, or normal web sign-in flows
- let later provider logins reuse that same saved browser profile
- avoid re-exporting cookies every time for many cookie-backed providers

Typical flow:

```bash
mikacli login --browser
mikacli developer github login --browser
mikacli social x login --browser
mikacli llm qwen login --browser
```

After the provider session is saved, normal commands stay headless:

```bash
mikacli developer github me --json
mikacli social x post "Shipping from MikaCLI"
mikacli llm qwen text "Summarize this changelog"
```

## At a Glance

<!-- GENERATED:at-a-glance:start -->
| Item | Value |
| --- | --- |
| Package | `mikacli` |
| CLI command | `mikacli` |
| Providers | `117` |
| Categories | `16` |
| npm install | `npm install -g mikacli` |
| bun install | `bun install -g mikacli` |
| Local setup | `bun install` |
| Docs sync | `bun run sync:docs` |
<!-- GENERATED:at-a-glance:end -->

## Get Started

Install globally with npm or Bun:

```bash
npm install -g mikacli
bun install -g mikacli
```

Validate the install right away:

```bash
mikacli --version
mikacli doctor
mikacli doctor --fix
```

Set up the repo locally with Bun:

```bash
bun install
bun run build
```

Bootstrap the shared browser once if you want browser-assisted logins:

```bash
mikacli login --browser
```

Clear saved state when you want to sign back out:

```bash
mikacli logout
mikacli logout x default
mikacli logout --browser
```

Typical commands:

```bash
mikacli status
mikacli sessions validate
mikacli sessions repair
mikacli jobs
mikacli logout x default
mikacli search "youtube download"
mikacli llm chatgpt text "Write release notes for MikaCLI"
mikacli developer github login --browser
mikacli developer github me --json
mikacli developer github capabilities --json
mikacli devops cloudflare zones --json
mikacli devops render services --json
mikacli jobs show job-id-example
mikacli google gmail labels --json
mikacli google calendar today --json
mikacli google docs documents --json
mikacli google forms forms --json
mikacli google drive files --json
mikacli google sheets values google-sheet-id-example Sheet1!A1:B5 --json
mikacli tools page-links https://example.com --json
mikacli tools http github inspect --json
```

Every provider help page now includes:

- a generated `Quick Start` block
- a `Support Profile` with auth, discovery, mutation, browser, and async support
- a `Stability Guide` so agents can tell whether a provider is `stable`, `partial`, or `experimental`

## Why Use MikaCLI

- Sign into real web apps once, then reuse the saved session from the terminal.
- Use the same CLI for LLMs, socials, job search, developer tools, devops platforms, editors, and public utilities.
- Keep auth local to your machine instead of scattering cookies and tokens across one-off scripts.
- Give agents and scripts a stable command model with consistent JSON output.
- Reach protected web surfaces that are awkward to automate with plain APIs alone.

## Command Model

MikaCLI is category-only. Provider commands never live at the root.

<!-- GENERATED:command-model-categories:start -->
- `mikacli llm ...`
- `mikacli editor ...`
- `mikacli finance ...`
- `mikacli data ...`
- `mikacli google ...`
- `mikacli maps ...`
- `mikacli movie ...`
- `mikacli news ...`
- `mikacli music ...`
- `mikacli social ...`
- `mikacli careers ...`
- `mikacli shopping ...`
- `mikacli developer ...`
- `mikacli devops ...`
- `mikacli bot ...`
- `mikacli tools ...`
<!-- GENERATED:command-model-categories:end -->

Examples:

```bash
mikacli llm chatgpt text "Write release notes for MikaCLI"
mikacli google gmail labels
mikacli google calendar today
mikacli google docs documents
mikacli google forms forms
mikacli google drive files
mikacli google sheets values google-sheet-id-example Sheet1!A1:B10
mikacli social x post "Shipping MikaCLI today"
mikacli developer confluence search "release process"
mikacli developer github me
mikacli devops vercel projects
mikacli bot telegrambot send 123456789 "Build finished"
mikacli news top "AI"
mikacli tools translate "hello world" --to hi
mikacli tools timezone "Mumbai"
mikacli tools oembed https://www.youtube.com/watch?v=dQw4w9WgXcQ
mikacli tools http github request GET /settings/profile
mikacli tools download info https://www.youtube.com/watch?v=dQw4w9WgXcQ
mikacli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## Google Workspace

Google providers share the same OAuth2 flow. Enable the APIs you need in Google Cloud, create an OAuth client, and register the localhost callback URI:

```text
http://127.0.0.1:3333/callback
```

Common APIs to enable:

- Gmail API
- Google Calendar API
- Google Docs API
- Google Forms API
- Google Drive API
- Google Sheets API

Typical login flow:

```bash
mikacli google gmail login --client-id <id> --client-secret <secret>
mikacli google calendar login --client-id <id> --client-secret <secret>
mikacli google docs login --client-id <id> --client-secret <secret>
mikacli google forms login --client-id <id> --client-secret <secret>
mikacli google drive login --client-id <id> --client-secret <secret>
mikacli google sheets login --client-id <id> --client-secret <secret>
```

Docs examples:

```bash
mikacli google docs documents --limit 10 --json
mikacli google docs document google-doc-id-example --json
mikacli google docs content google-doc-id-example --json
mikacli google docs create "Launch Notes" --text "Hello from MikaCLI" --json
mikacli google docs append-text google-doc-id-example "More text from MikaCLI" --json
mikacli google docs replace-text google-doc-id-example --search "draft" --replace "published" --json
```

Forms examples:

```bash
mikacli google forms forms --limit 10 --json
mikacli google forms form google-form-id-example --json
mikacli google forms create "Launch Survey" --description "Tell us what you think" --json
mikacli google forms add-text-question google-form-id-example --title "What should we improve?" --paragraph --required --json
mikacli google forms add-choice-question google-form-id-example --title "How did we do?" --options "Great|Good|Okay|Needs work" --type RADIO --json
mikacli google forms responses google-form-id-example --limit 20 --json
mikacli google forms publish google-form-id-example --published true --accepting-responses true --json
```

Calendar examples:

```bash
mikacli google calendar calendars --json
mikacli google calendar today --calendar primary --json
mikacli google calendar events --calendar primary --time-min 2026-04-12T00:00:00+05:30 --time-max 2026-04-12T23:59:59+05:30 --json
mikacli google calendar create-event --calendar primary --summary "Launch review" --start 2026-04-12T10:00:00+05:30 --end 2026-04-12T10:30:00+05:30 --json
mikacli google calendar update-event google-event-id-example --calendar primary --location "Zoom" --json
mikacli google calendar delete-event google-event-id-example --calendar primary --json
```

## Cross-Site Downloads

Use `mikacli tools download` for multi-site media downloads powered by `yt-dlp`, with optional saved-session cookies from MikaCLI when a site needs auth.

Examples:

```bash
mikacli tools download info https://www.youtube.com/watch?v=dQw4w9WgXcQ --json
mikacli tools download video https://x.com/user/status/123 --platform x
mikacli tools download video https://www.instagram.com/reel/SHORTCODE/ --platform instagram --account default
mikacli tools download audio https://www.youtube.com/watch?v=dQw4w9WgXcQ --audio-format mp3
mikacli tools download batch ./urls.txt --mode video --quality 720p
mikacli tools download info 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' --playlist --limit 5
```

## Command Search

Use `mikacli search` to find providers and exact runnable commands across MikaCLI's built-in command surface.

Examples:

```bash
mikacli search github
mikacli search "youtube download"
mikacli search uptime --category devops
mikacli search gmail --category google
mikacli search transcript --json
```

## Session Validation

Use `mikacli sessions validate` when you want a live provider check instead of the last saved session state.

Examples:

```bash
mikacli sessions validate
mikacli sessions validate x
mikacli sessions validate youtube default --json
```

Use `mikacli sessions repair` when you want MikaCLI to validate first, then replay safe login paths like stored tokens or browser-assisted cookie repair.

Examples:

```bash
mikacli sessions repair
mikacli sessions repair x --browser
mikacli sessions repair discordbot default --json
```

## Saved Jobs

Use `mikacli jobs` to inspect saved media and async jobs across providers, then reopen, watch, download, or cancel them from one root command surface.

Examples:

```bash
mikacli jobs
mikacli jobs --platform grok
mikacli jobs show job-id-example
mikacli jobs watch job-id-example
mikacli jobs download job-id-example --output-dir ./renders
mikacli jobs cancel job-id-example --platform grok
```

## Cross-Site Transcripts

Use `mikacli tools transcript` to pull subtitles or transcripts from media pages supported by `yt-dlp`, with plain text by default and subtitle formats when you need them.

Examples:

```bash
mikacli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ
mikacli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --lang en --format srt
mikacli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --auto --format json --json
```

## Agent JSON Conventions

MikaCLI keeps provider-specific fields, but it also adds a few stable JSON aliases so agents can plan and transform results more reliably:

- `data.items` for list-style results, even when the provider also returns keys like `repos`, `projects`, `posts`, or `recommendations`
- `data.entity` for singular objects, even when the provider also returns keys like `profile`, `page`, `movie`, or `project`
- `data.meta.count` and `data.meta.listKey` for quick list summaries
- `data.guidance.recommendedNextCommand` and `data.guidance.nextCommands` for safer follow-up planning

Example:

```bash
mikacli social reddit search "bun cli" --json
mikacli movie tmdb title 27205 --json
mikacli developer github capabilities --json
```
## Output Filtering & Field Selection

Use `--filter` and `--select` global flags to transform JSON results without external tools:

### Filter by conditions

```bash
mikacli developer github repos --json --filter 'stargazers_count > 100'
mikacli developer github repos --json --filter 'language = "TypeScript" AND stargazers_count > 1000'
mikacli social x posts --json --filter 'public_metrics.likes > 5000'
```

### Select specific fields

```bash
mikacli developer github repos --json --select name,stargazers_count,language
mikacli social linkedin posts --json --select content,engagement_count,timestamp
```

### Combine filtering and selection

```bash
mikacli developer github repos --json \
  --filter 'stargazers_count > 100 AND language = "TypeScript"' \
  --select name,stargazers_count,url
```

### Supported Operators

- **Comparison**: `>`, `<`, `>=`, `<=`, `=`, `!=`
- **Text**: `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`
- **Logic**: `AND`, `OR` with proper precedence
- **Nested fields**: Access via dot notation, e.g., `public_metrics.like_count`

For detailed examples and syntax reference, see [FILTERING_GUIDE.md](./FILTERING_GUIDE.md).

## Output Format Transformations

Transform JSON results into different formats without external tools using `--format`:

### Available Formats

- **`csv`** - Comma-separated values (for spreadsheets and data pipelines)
- **`table`** - Formatted terminal table with unicode borders
- **`yaml`** - YAML output (for configuration and infrastructure)
- **`markdown`** - Markdown tables (for documentation and reports)
- **`html`** - HTML tables (for email reports and web pages)
- **`json`** - Default JSON format

### Examples

```bash
# Export to CSV for Excel
mikacli developer github repos --json --format csv > repos.csv

# Display as formatted table in terminal
mikacli social reddit search "ai" --json --format table --filter 'score > 100'

# Generate markdown table for documentation
mikacli developer github repos --json --format markdown --select name,language,stargazers_count

# Create HTML report
mikacli devops vercel projects --json --format html --select name,updated_at > report.html

# YAML for configuration/infrastructure
mikacli devops railway services --json --format yaml > services.yaml
```

### Combine Formats with Filtering & Selection

```bash
# High-star TypeScript repos as CSV
mikacli developer github repos --json \
  --filter 'language = "TypeScript" AND stargazers_count > 100000' \
  --select name,stargazers_count,forks_count \
  --format csv > top-ts-repos.csv

# Popular posts as markdown table
mikacli social reddit search "bun cli" --json \
  --filter 'score > 500' \
  --select title,author,score \
  --format markdown
```
## Stability Levels

- `stable`: ready for routine automation and the default choice when you have options
- `partial`: core flows work well, but some protected or edge routes may still need care
- `experimental`: useful, but still changing quickly and best used with extra verification
- `unknown`: not classified yet, so inspect with `capabilities --json` before leaning on it

To inspect a provider before acting:

```bash
mikacli developer github capabilities --json
mikacli social reddit capabilities --json
mikacli devops railway capabilities --json
```

## Category Overview

<!-- GENERATED:category-overview:start -->
This inventory is generated from the live platform registry.

| Category | Representative providers | Count | Auth modes | Use it for | Route |
| --- | --- | ---: | --- | --- | --- |
| `llm` | `chatgpt`, `claude`, `deepseek`, `gemini`, `grok`, +4 more | 9 | `cookies` | Prompting, chat, image, and generation workflows. | `mikacli llm ...` |
| `editor` | `archive`, `audio`, `document`, `gif`, `image`, +3 more | 8 | `none` | Local file, media, and document transformations. | `mikacli editor ...` |
| `finance` | `crypto`, `currency`, `stocks` | 3 | `none` | Market, forex, and crypto lookups. | `mikacli finance ...` |
| `data` | `csv`, `html`, `json`, `markdown`, `text`, +2 more | 7 | `none` | Structured data cleanup, conversion, filtering, and extraction. | `mikacli data ...` |
| `google` | `calendar`, `docs`, `drive`, `forms`, `gmail`, +1 more | 6 | `oauth2` | Google Workspace APIs and account-backed productivity flows. | `mikacli google ...` |
| `maps` | `geo`, `openstreetmap`, `osrm` | 3 | `none` | Geocoding, routing, elevation, and geometry helpers. | `mikacli maps ...` |
| `movie` | `anilist`, `imdb`, `justwatch`, `kitsu`, `letterboxd`, +3 more | 8 | `cookies`, `none` | Title lookup, recommendations, and streaming availability. | `mikacli movie ...` |
| `news` | `news` | 1 | `none` | Headline discovery, source search, and feed aggregation. | `mikacli news ...` |
| `music` | `bandcamp`, `deezer`, `soundcloud`, `spotify`, `youtube-music` | 5 | `cookies`, `none` | Music discovery, playback, and library-style workflows. | `mikacli music ...` |
| `social` | `bluesky`, `facebook`, `instagram`, `linkedin`, `mastodon`, +9 more | 14 | `cookies`, `none`, `session` | Posting, profile lookup, messaging, and public social reads. | `mikacli social ...` |
| `careers` | `indeed`, `ziprecruiter` | 2 | `none` | Job search and hiring discovery workflows. | `mikacli careers ...` |
| `shopping` | `amazon`, `ebay`, `etsy`, `flipkart` | 4 | `cookies`, `none` | Product discovery plus cart and order surfaces where supported. | `mikacli shopping ...` |
| `developer` | `confluence`, `github`, `gitlab`, `jira`, `linear`, +2 more | 7 | `cookies` | Code hosting, issues, docs, and workspace automation. | `mikacli developer ...` |
| `devops` | `cloudflare`, `digitalocean`, `fly`, `netlify`, `railway`, +4 more | 9 | `api token` | Infrastructure, deployments, DNS, and uptime automation. | `mikacli devops ...` |
| `bot` | `discordbot`, `githubbot`, `slackbot`, `telegrambot` | 4 | `api token`, `bot token` | Bot-token messaging and chat ops. | `mikacli bot ...` |
| `tools` | `cheat`, `dns`, `download`, `favicon`, `headers`, +22 more | 27 | `cookies`, `none`, `session` | Public utilities, temp mail, downloads, transcripts, and web helpers. | `mikacli tools ...` |

MikaCLI currently exposes `117` providers across `16` active command groups.
<!-- GENERATED:category-overview:end -->

## Access Modes

| Needs | Meaning |
| --- | --- |
| `none` | Public or local functionality. No cookies, no token, no API key. |
| `local tools` | Uses binaries already installed on the machine, like `ffmpeg`, `ffprobe`, `qpdf`, or `yt-dlp`. |
| `cookies` | Import a browser session with `login --cookies ...` or let MikaCLI open a browser with `login --browser`, then reuse it headlessly. |
| `session` | Do one interactive login once, save the resulting user session locally, then reuse it headlessly. |
| `cookies + local token` | Cookie session plus a token the site keeps in localStorage or a similar client store. |
| `api token` | A personal or service token saved once with `login --token ...`. |
| `bot token` | A bot token saved once with `login --token ...`. |
| `browser later` | The current CLI route works for some surfaces, but more protected flows may later get an opt-in browser-backed mode. |

## Installation

### Recommended Global Install

Use the published package as the primary supported install path:

```bash
npm install -g mikacli
bun install -g mikacli
```

After install, verify the command and your local environment:

```bash
mikacli --version
mikacli doctor
mikacli doctor --fix
mikacli status
```

`mikacli doctor` checks the shared browser setup plus optional local tools such as `ffmpeg`, `yt-dlp`, `qpdf`, `poppler`, `7z`, and macOS-native helpers when relevant.

On macOS, `mikacli doctor --fix` can install all supported missing browser and local-tool dependencies automatically with Homebrew, then rerun the health check.

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

Link `mikacli` globally for local development:

```bash
bun run link:global
```

If your shell still says `command not found`, open a new shell or run `hash -r`.

### Documentation Sync

Refresh the generated README sections, regenerate the provider-specific skill references, and sync the installed Codex skill copy:

```bash
bun run generate:readme
bun run generate:skill-providers
bun run sync:docs
bun run sync:skills
```

`bun run generate:readme` refreshes the marker-based sections in this README from the live provider registry.

`bun run sync:docs` runs the README generator, refreshes the generated files under [`skills/mikacli/references/providers`](./skills/mikacli/references/providers), and copies the repo skill into your local Codex skill directory (defaults to `~/.codex/skills/mikacli` unless `CODEX_HOME` is set).

`npm publish` now runs this automatically through `prepublishOnly`, so release builds regenerate and sync the docs before typecheck, tests, and build.

### Platform Registry Sync

Platform manifests and provider runtime metadata are auto-discovered into generated files, so new providers no longer need a manual import/edit pass in `src/platforms/index.ts` or a hand-edited central config entry.

```bash
bun run generate:platform-registry
```

Common scripts such as `dev`, `start`, `typecheck`, `test`, `build`, and `generate:skill-providers` refresh the generated registry automatically.

## Open Source Project Files

- [LICENSE](./LICENSE)
- [Contributing Guide](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
- [AI Agent Skill](./skills/mikacli/SKILL.md)

If you plan to contribute, please do not commit live cookies, tokens, QR session state, or personal exports. MikaCLI should only store those locally on the contributor machine, never in the repository.

## Quick Start

Check global status:

```bash
mikacli status
mikacli status --json
mikacli doctor
mikacli sessions
```

If you have not linked the CLI globally yet:

```bash
bun run dev status
```

Typical first-run flows:

```bash
mikacli social x login --cookies ./x.cookies.json
mikacli developer github login --browser
mikacli llm chatgpt text "Summarize this changelog"
mikacli developer github login --cookies ./github.cookies.json
mikacli devops cloudflare login --token $CLOUDFLARE_API_TOKEN
mikacli social telegram login --api-id 123456 --api-hash abcdef123456 --qr
mikacli bot telegrambot login --token 123456:ABCDEF --name alerts-bot
mikacli news top "AI"
mikacli tools websearch search "bun commander zod"
mikacli tools http github inspect
```

## Best Example Workflows

### Cookie-backed social posting

```bash
mikacli social instagram login --cookies ./instagram.cookies.txt
mikacli social instagram post ./photo.jpg --caption "Shipping from the terminal"
mikacli social x login --cookies ./x.cookies.json
mikacli social x post "Launching MikaCLI" --image ./launch.png
```

If you do not want to export cookies manually, many cookie-backed providers now also support:

```bash
mikacli login --browser
mikacli developer github login --browser
mikacli social x login --browser
mikacli llm qwen login --browser
```

`mikacli login --browser` opens MikaCLI's shared browser profile so you can sign into Google or other identity providers once. Later provider logins reuse that same saved browser profile, and `mikacli <category> <provider> login --browser` still skips opening the browser entirely when an already-saved active provider session is available.

### LLM prompting and generation

```bash
mikacli llm chatgpt text "Write release notes for MikaCLI"
mikacli llm deepseek login --cookies ./deepseek.cookies.json --token <userToken>
mikacli llm deepseek text "Explain retrieval-augmented generation"
mikacli llm grok image "Minimal orange fox logo on white background"
mikacli llm grok video "Minimal orange fox logo with subtle camera motion"
```

### Developer and bot automation

```bash
mikacli developer confluence search "deploy backend"
mikacli developer github me
mikacli developer gitlab projects "mikacli" --limit 10
mikacli developer jira projects
mikacli developer linear issues --team ENG --limit 20
mikacli developer trello boards
mikacli devops netlify sites
mikacli devops railway projects
mikacli devops fly apps --org personal
mikacli devops digitalocean apps
mikacli bot telegrambot send 123456789 "Build finished"
mikacli bot discordbot send 123456789012345678 "nightly deploy complete"
```

### Google workspace automation

```bash
mikacli google gmail labels --json
mikacli google calendar today --calendar primary --json
mikacli google docs documents --limit 10 --json
mikacli google forms forms --limit 10 --json
mikacli google drive files --limit 10 --json
mikacli google sheets values google-sheet-id-example Sheet1!A1:B10 --json
```

### Session-backed messaging

```bash
mikacli social telegram login --api-id 123456 --api-hash abcdef123456 --qr
mikacli social telegram send me "Hello from MikaCLI"
mikacli social reddit search "bun cli"
mikacli social reddit post programming "Launching MikaCLI" "Now with Reddit support."
mikacli social whatsapp login
mikacli social whatsapp send 919876543210 "Ping from MikaCLI"
```

### Public utilities

```bash
mikacli news top "AI" --source google
mikacli news search "typescript cli"
mikacli news feed https://hnrss.org/frontpage --limit 5
mikacli tools translate "hello world" --to hi
mikacli tools websearch search "typescript cli bun"
mikacli tools screenshot https://example.com --output-dir ./shots
mikacli tools favicon openai.com
mikacli tools page-links https://example.com --type external
mikacli tools timezone "Mumbai"
mikacli tools oembed https://www.youtube.com/watch?v=dQw4w9WgXcQ
mikacli login --browser
mikacli tools http github.com capture --browser-timeout 60
mikacli tools http github.com capture --summary --group-by endpoint --browser-timeout 60
mikacli tools uptime https://example.com --json
mikacli tools rss https://hnrss.org/frontpage --limit 5
```

### Music discovery and download

```bash
mikacli music bandcamp search "radiohead"
mikacli music bandcamp album https://radiohead.bandcamp.com/album/in-rainbows
mikacli music soundcloud search "dandelions"
mikacli music soundcloud user aviciiofficial
mikacli music soundcloud playlist https://soundcloud.com/lofi-hip-hop-music/sets/lofi-lofi
mikacli music soundcloud download "dandelions" --output-dir ./downloads
```

### Local editing

```bash
mikacli editor image resize ./photo.png --width 1200
mikacli editor video split ./clip.mp4 --every 30
mikacli editor video blur ./clip.mp4 --x 120 --y 80 --width 360 --height 200 --start 00:00:05 --duration 3 --corner-radius 24
mikacli editor audio loudness-report ./podcast.wav
mikacli editor pdf watermark ./deck.pdf --text "Internal"
mikacli editor subtitle burn ./video.mp4 --subtitle ./captions.srt
```

## Sessions And Connections

Cookie sessions are stored under:

```text
~/.mikacli/sessions/<platform>/<account>.json
```

Token, bot, and saved session connections are stored under:

```text
~/.mikacli/connections/<platform>/<account>.json
```

MikaCLI supports importing:

- Netscape `cookies.txt`
- raw cookie strings
- JSON cookie arrays
- serialized `tough-cookie` jars

After the first `login`, later commands normally omit `--account` or `--bot` and MikaCLI uses the most recently saved connection for that provider.

## Provider Matrix

<!-- GENERATED:provider-matrix:start -->
The tables below are generated from provider manifests and runtime capability metadata, so they stay aligned with `mikacli <category> <provider> capabilities --json`.

### LLM

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | `stable` | `cookies` | `supported` | `supported` | `supported` | `partial` | `mikacli llm chatgpt` |
| Claude | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `mikacli llm claude` |
| DeepSeek | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `mikacli llm deepseek` |
| Gemini | `stable` | `cookies` | `supported` | `supported` | `supported` | `partial` | `mikacli llm gemini` |
| Grok | `partial` | `cookies` | `supported` | `supported` | `supported` | `supported` | `mikacli llm grok` |
| Mistral | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `mikacli llm mistral` |
| Perplexity | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `mikacli llm perplexity` |
| Qwen | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `mikacli llm qwen` |
| Z.ai | `partial` | `cookies` | `supported` | `supported` | `supported` | `partial` | `mikacli llm zai` |

Notes:
- `chatgpt`: Shared browser login works well for cookie capture and reuse.
- `deepseek`: Some flows also need a token recovered from browser storage.
- `grok`: MikaCLI can fall back to an in-browser Grok request path when the browserless endpoint is blocked.

### Editor

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Archive Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli editor archive` |
| Audio Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli editor audio` |
| Document Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli editor document` |
| GIF Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli editor gif` |
| Image Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli editor image` |
| PDF Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli editor pdf` |
| Subtitle Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli editor subtitle` |
| Video Editor | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli editor video` |

### Finance

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Crypto | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli finance crypto` |
| Currency | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli finance currency` |
| Stocks | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli finance stocks` |

### Data

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CSV | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli data csv` |
| HTML | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli data html` |
| JSON | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli data json` |
| Markdown | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli data markdown` |
| Text | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli data text` |
| XML | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli data xml` |
| YAML | `stable` | `none` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli data yaml` |

### Google

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gmail | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli google gmail` |
| Google Calendar | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli google calendar` |
| Google Docs | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli google docs` |
| Google Drive | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli google drive` |
| Google Forms | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli google forms` |
| Google Sheets | `stable` | `oauth2` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli google sheets` |

Notes:
- `gmail`: Uses Google's OAuth2 flow and stores refresh tokens locally for headless reuse.
- `calendar`: Uses Google's OAuth2 flow for calendar listing plus Google Calendar event reads and writes.
- `docs`: Uses Google's OAuth2 flow for Google Docs listing, content reads, document creation, and text edits.
- `drive`: Uses Google's OAuth2 flow and supports Drive file listing, uploads, downloads, and deletes.
- `forms`: Uses Google's OAuth2 flow plus Drive-backed listing and deletion for Google Forms CRUD, responses, and publish settings.
- `sheets`: Uses Google's OAuth2 flow for spreadsheet reads and writes.

### Maps

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Geo | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli maps geo` |
| OpenStreetMap | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli maps openstreetmap` |
| OSRM | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli maps osrm` |

### Movie

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AniList | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli movie anilist` |
| IMDb | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli movie imdb` |
| JustWatch | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli movie justwatch` |
| Kitsu | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli movie kitsu` |
| Letterboxd | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli movie letterboxd` |
| MyAnimeList | `stable` | `cookies`, `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli movie myanimelist` |
| TMDb | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli movie tmdb` |
| TVMaze | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli movie tvmaze` |

### News

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| News | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli news` |

### Music

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bandcamp | `stable` | `none` | `supported` | `unsupported` | `partial` | `unsupported` | `mikacli music bandcamp` |
| Deezer | `stable` | `none` | `supported` | `unsupported` | `partial` | `unsupported` | `mikacli music deezer` |
| SoundCloud | `stable` | `none` | `supported` | `partial` | `partial` | `unsupported` | `mikacli music soundcloud` |
| Spotify | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli music spotify` |
| YouTube Music | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli music youtube-music` |

### Social

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bluesky | `stable` | `none`, `session` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli social bluesky` |
| Facebook | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli social facebook` |
| Instagram | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli social instagram` |
| LinkedIn | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `mikacli social linkedin` |
| Mastodon | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli social mastodon` |
| Pinterest | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli social pinterest` |
| Reddit | `partial` | `none`, `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli social reddit` |
| Telegram | `partial` | `session` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli social telegram` |
| Threads | `partial` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli social threads` |
| TikTok | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `mikacli social tiktok` |
| Twitch | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `mikacli social twitch` |
| WhatsApp | `partial` | `session` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli social whatsapp` |
| X | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli social x` |
| YouTube | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `mikacli social youtube` |

Notes:
- `bluesky`: Public reads stay available without auth. App-password login enables saved-session `me`, `post`, `comment`, and `like` commands without browser automation.
- `facebook`: Facebook writes now run through browser-backed post, like, and comment flows. Use `--browser` to jump straight into the shared MikaCLI browser profile when you want the visible browser path.
- `instagram`: Reads and image/comment writes are browserless; post and comment deletion can fall back to browser-backed flows when Instagram's web APIs get flaky.
- `reddit`: Public reads are stable; writes can use a saved session or the shared browser profile.
- `telegram`: Uses saved MTProto sessions instead of browser cookies.
- `twitch`: Uses Twitch's authenticated web GraphQL surface for channel, stream, video, and clip lookups.
- `twitch`: Follow and unfollow try Twitch's web mutation path first, then can fall back to the shared MikaCLI browser profile when Twitch enforces an integrity challenge.
- `twitch`: Clip creation and stream settings updates currently run through the shared MikaCLI browser profile.
- `whatsapp`: Uses QR or pairing-code session state instead of browser cookies.
- `x`: X write actions run through browser-backed flows. Use `--browser` to force the shared MikaCLI browser profile immediately when you want the live browser path.
- `youtube`: Studio uploads are browser-backed. Watch-page likes, dislikes, comments, and subscriptions still use request tokens from the saved session.

### Careers

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Indeed | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli careers indeed` |
| ZipRecruiter | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli careers ziprecruiter` |

### Shopping

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Amazon | `partial` | `cookies` | `supported` | `partial` | `supported` | `unsupported` | `mikacli shopping amazon` |
| eBay | `stable` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli shopping ebay` |
| Etsy | `partial` | `none` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli shopping etsy` |
| Flipkart | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli shopping flipkart` |

Notes:
- `amazon`: `add-to-cart`, `remove-from-cart`, `update-cart`, `orders`, `order`, and `cart` support browser-backed execution when the saved session alone is not enough.
- `flipkart`: Uses the saved Flipkart session for cart actions. New adds use the authenticated cart endpoint; quantity updates and removals use the saved session in an invisible browser.

### Developer

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Confluence | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli developer confluence` |
| GitHub | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli developer github` |
| GitLab | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli developer gitlab` |
| Jira | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli developer jira` |
| Linear | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli developer linear` |
| Notion | `partial` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli developer notion` |
| Trello | `stable` | `cookies` | `supported` | `supported` | `supported` | `unsupported` | `mikacli developer trello` |

Notes:
- `github`: Uses a saved GitHub web session for browserless repository automation.

### DevOps

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cloudflare | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli devops cloudflare` |
| DigitalOcean | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli devops digitalocean` |
| Fly.io | `partial` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli devops fly` |
| Netlify | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli devops netlify` |
| Railway | `partial` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli devops railway` |
| Render | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli devops render` |
| Supabase | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli devops supabase` |
| UptimeRobot | `stable` | `api token` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli devops uptimerobot` |
| Vercel | `stable` | `api token` | `supported` | `unsupported` | `unsupported` | `unsupported` | `mikacli devops vercel` |

Notes:
- `fly`: Org-aware app listing may require an explicit --org slug for some tokens.
- `railway`: Uses Railway's GraphQL surface, so some deeper actions may still be added later.
- `uptimerobot`: Uses UptimeRobot's official v3 API with bearer-token authentication.

### Bot

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Discord Bot | `stable` | `bot token` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli bot discordbot` |
| GitHub Bot | `stable` | `api token` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli bot githubbot` |
| Slack Bot | `stable` | `bot token` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli bot slackbot` |
| Telegram Bot | `stable` | `bot token` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli bot telegrambot` |

### Tools

| Provider | Stability | Auth | Read | Write | Browser login | Async jobs | Command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cheat | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools cheat` |
| DNS | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools dns` |
| Download | `stable` | `none`, `cookies` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools download` |
| Favicon | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools favicon` |
| Headers | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools headers` |
| HTTP Toolkit | `stable` | `none`, `cookies` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli tools http` |
| IP | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools ip` |
| Markdown Fetch | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools markdown-fetch` |
| Metadata | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools metadata` |
| oEmbed | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools oembed` |
| Page Links | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools page-links` |
| QR | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools qr` |
| Redirect | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools redirect` |
| Robots | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools robots` |
| RSS | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools rss` |
| Screenshot | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools screenshot` |
| Sitemap | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools sitemap` |
| SSL | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools ssl` |
| Temp Mail | `stable` | `session` | `supported` | `supported` | `unsupported` | `unsupported` | `mikacli tools tempmail` |
| Time | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools time` |
| Timezone | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools timezone` |
| Transcript | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools transcript` |
| Translate | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools translate` |
| Uptime | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools uptime` |
| Weather | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools weather` |
| Web Search | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools websearch` |
| Whois | `stable` | `none` | `supported` | `unknown` | `unsupported` | `unsupported` | `mikacli tools whois` |

Notes:
- `http`: Best used with saved sessions or the shared browser profile for authenticated request inspection and replay.
- `tempmail`: Uses Mail.tm's free disposable inbox API and stores the mailbox session locally for reuse.
<!-- GENERATED:provider-matrix:end -->

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

This makes MikaCLI friendly for:

- shell scripts
- CI jobs
- multi-step agents
- external orchestrators

## Session Refresh

MikaCLI includes a refresh layer in `src/utils/autorefresh.ts`.

- Instagram, X, and YouTube can use lightweight authenticated keepalive checks before normal actions.
- Rotated cookies are persisted back into the saved session file when the platform returns them.
- Some platforms still do not support a durable cookie-only refresh path, so expiration handling remains provider-specific.

This is the most practical browserless approach for copied web sessions, but it is not a universal guarantee for every website.

For cookie-backed providers that support interactive capture, you can also use `login --browser` to open a real browser, complete the sign-in flow manually, and let MikaCLI save the session automatically.

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
- The category model is intentionally strict so provider names do not collide as MikaCLI grows.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=vkop007/mikacli&type=Date)](https://star-history.com/#vkop007/mikacli&Date)
