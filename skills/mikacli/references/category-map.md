# MikaCLI Category Map

Use this file when you need to choose the right MikaCLI surface quickly.

If the user intent is already concrete, read [recipes.md](recipes.md) first and run the direct command instead of exploring.

## Global Commands

- `login --browser`: open MikaCLI's shared browser profile for interactive sign-in
- `status`: summary of CLI and connection health
- `doctor`: environment checks, saved sessions, and missing binaries
- `sessions`: inspect or remove saved connections
- `<category> <provider> capabilities`: machine-readable provider support metadata
- `... --json --select <fields>`: extract only specific fields from results
- `... --json --filter '<condition>'`: filter list results by conditions without external tools
- `... --json --filter '<condition>' --select <fields>`: combine filtering and field selection
- `... --json --format csv|table|yaml|markdown|html`: transform output format without external tools

## Categories

| Category | Use it for | Representative providers | Typical commands |
| --- | --- | --- | --- |
| `llm` | prompting and generation | `chatgpt`, `gemini`, `grok`, `mistral`, `perplexity`, `qwen` | `login`, `status`, `text`, `image`, `video` |
| `google` | Google workspace and account APIs | `calendar`, `docs`, `forms`, `gmail`, `drive`, `sheets` | `auth-url`, `login`, `me`, `calendars`, `documents`, `forms`, `events`, `files`, `labels`, `values`, `append` |
| `social` | posting, profile lookup, messaging, public social reads | `x`, `instagram`, `reddit`, `bluesky`, `mastodon`, `telegram`, `whatsapp`, `youtube` | `login`, `me`, `profile`, `posts`, `thread`, `post`, `comment`, `send` |
| `careers` | job search and discovery | `indeed`, `ziprecruiter` | `search` |
| `developer` | code hosting, docs, issues, workspace tools | `github`, `gitlab`, `jira`, `linear`, `trello`, `confluence`, `notion` | `login`, `me`, `projects`, `issues`, `page`, `search` |
| `devops` | infrastructure, deploys, DNS, monitoring, and platform operations | `cloudflare`, `vercel`, `supabase`, `render`, `railway`, `netlify`, `digitalocean`, `fly`, `uptimerobot` | `login`, `me`, `zones`, `projects`, `services`, `apps`, `deployments`, `monitors` |
| `editor` | local file and media editing | `image`, `video`, `audio`, `pdf`, `document`, `subtitle`, `gif`, `archive` | `info`, `convert`, `resize`, `split`, `watermark`, `ocr` |
| `data` | structured data cleanup and transformation | `json`, `csv`, `yaml`, `xml`, `html`, `markdown`, `text` | `format`, `query`, `to-json`, `filter`, `text`, `replace` |
| `tools` | public utilities, cross-site downloads, session-aware HTTP inspection, and web helpers | `download`, `http`, `websearch`, `translate`, `page-links`, `favicon`, `headers`, `rss`, `timezone` | `download`, `inspect`, `capture`, `request`, and other lookup-style commands |
| `news` | public headline and feed discovery | `news` | `top`, `search`, `sources`, `feed` |
| `maps` | geocoding, routing, geometry | `openstreetmap`, `osrm`, `geo` | `search`, `reverse`, `route`, `distance`, `elevation` |
| `finance` | market and forex lookups | `stocks`, `crypto`, `currency` | quote and conversion commands |
| `movie` | title lookup, recommendations, streaming availability | `tmdb`, `imdb`, `letterboxd`, `justwatch`, `anilist` | `search`, `title`, `recommendations`, `trending` |
| `music` | music discovery and playback surfaces | `soundcloud`, `bandcamp`, `deezer`, `spotify`, `youtube-music` | `search`, `track`, `album`, `playlist`, playback controls |
| `shopping` | product discovery and account shopping actions | `amazon`, `ebay`, `etsy`, `flipkart` | `search`, `product`, `cart`, `orders` |
| `bot` | bot-token messaging and chat ops | `telegrambot`, `discordbot`, `slackbot`, `githubbot` | `login`, `send`, `channels`, `issues` |

## Auth Expectations

| Needs | Meaning |
| --- | --- |
| `none` | Public or local functionality |
| `cookies` | Use `login` for the default browser flow, or `login --cookies ...` to import a saved web session directly |
| `cookies + local token` | Cookie-backed session plus a token stored in site storage |
| `session` | Do one interactive login once, then reuse the saved user session |
| `oauth2` | Generate a consent URL, exchange an auth code or refresh token once, then reuse the saved OAuth connection |
| `api token` | Save a personal or service token once with `login --token ...` |
| `bot token` | Save a bot token once with `login --token ...` |
| `local tools` | Requires binaries like `ffmpeg`, `qpdf`, or `tesseract` |

## Safe Agent Defaults

- Use `--json` unless the user clearly wants formatted terminal output.
- Prefer one direct command before discovery commands.
- Prefer read-only commands before mutations.
- Use `capabilities --json` before risky or unfamiliar provider actions so the agent can see auth type, stability, browser support, and read/write boundaries.
- Use `doctor` and `sessions` only after a direct command fails or when the task is explicitly diagnostic.
- If the user can sign in interactively, prefer `mikacli login --browser` and then the provider's `login --browser`.
- If a provider is authenticated but missing a modeled action, try `mikacli tools http <provider-or-domain> inspect` before inventing custom automation.
- For nested help, use `mikacli <category> --help` then `mikacli <category> <provider> --help`.
- Do not use flat legacy forms like `mikacli github ...` or `mikacli chatgpt ...`.
