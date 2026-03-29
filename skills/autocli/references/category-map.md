# AutoCLI Category Map

Use this file when you need to choose the right AutoCLI surface quickly.

## Global Commands

- `login --browser`: open AutoCLI's shared browser profile for interactive sign-in
- `status`: summary of CLI and connection health
- `doctor`: environment checks, saved sessions, and missing binaries
- `sessions`: inspect or remove saved connections
- `<category> <provider> capabilities`: machine-readable provider support metadata

## Categories

| Category | Use it for | Representative providers | Typical commands |
| --- | --- | --- | --- |
| `llm` | prompting and generation | `chatgpt`, `gemini`, `grok`, `mistral`, `perplexity`, `qwen` | `login`, `status`, `text`, `image`, `video` |
| `social` | posting, profile lookup, messaging, public social reads | `x`, `instagram`, `reddit`, `bluesky`, `mastodon`, `telegram`, `whatsapp`, `youtube` | `login`, `me`, `profile`, `posts`, `thread`, `post`, `comment`, `send` |
| `developer` | code hosting, docs, issues, workspace tools | `github`, `gitlab`, `jira`, `linear`, `trello`, `confluence`, `notion` | `login`, `me`, `projects`, `issues`, `page`, `search` |
| `devops` | infrastructure, deploys, DNS, and platform operations | `cloudflare`, `vercel`, `supabase`, `render`, `railway`, `netlify`, `digitalocean`, `fly` | `login`, `me`, `zones`, `projects`, `services`, `apps`, `deployments` |
| `editor` | local file and media editing | `image`, `video`, `audio`, `pdf`, `document`, `subtitle`, `gif`, `archive` | `info`, `convert`, `resize`, `split`, `watermark`, `ocr` |
| `data` | structured data cleanup and transformation | `json`, `csv`, `yaml`, `xml`, `html`, `markdown`, `text` | `format`, `query`, `to-json`, `filter`, `text`, `replace` |
| `tools` | public utilities, session-aware HTTP inspection, and web helpers | `http`, `websearch`, `translate`, `page-links`, `favicon`, `headers`, `rss`, `timezone` | `inspect`, `capture`, `request`, and other lookup-style commands |
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
| `cookies` | Use `login --cookies ...` or `login --browser` for a saved web session |
| `cookies + local token` | Cookie-backed session plus a token stored in site storage |
| `session` | Do one interactive login once, then reuse the saved user session |
| `api token` | Save a personal or service token once with `login --token ...` |
| `bot token` | Save a bot token once with `login --token ...` |
| `local tools` | Requires binaries like `ffmpeg`, `qpdf`, or `tesseract` |

## Safe Agent Defaults

- Use `--json` unless the user clearly wants formatted terminal output.
- Prefer read-only commands before mutations.
- Use `capabilities --json` before risky or unfamiliar provider actions so the agent can see auth type, stability, browser support, and read/write boundaries.
- Use `doctor` and `sessions` before assuming auth is broken.
- If the user can sign in interactively, prefer `autocli login --browser` and then the provider's `login --browser`.
- If a provider is authenticated but missing a modeled action, try `autocli tools http <provider-or-domain> inspect` before inventing custom automation.
- For nested help, use `autocli <category> --help` then `autocli <category> <provider> --help`.
- Do not use flat legacy forms like `autocli github ...` or `autocli chatgpt ...`.
