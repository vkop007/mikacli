# AutoCLI Category Map

Use this file when you need to choose the right AutoCLI surface quickly.

## Global Commands

- `status`: summary of CLI and connection health
- `doctor`: environment checks, saved sessions, missing binaries
- `sessions`: inspect or remove saved connections

## Categories

| Category | Use it for | Representative providers | Typical commands |
| --- | --- | --- | --- |
| `llm` | prompting and generation | `chatgpt`, `gemini`, `grok`, `mistral`, `perplexity` | `login`, `status`, `text`, `image`, `video` |
| `social` | posting, profile lookup, messaging, public social reads | `x`, `instagram`, `youtube`, `bluesky`, `mastodon`, `whatsapp` | `login`, `me`, `profile`, `posts`, `thread`, `post`, `send` |
| `developer` | code hosting, docs, issues, workspace tools | `github`, `gitlab`, `jira`, `linear`, `trello`, `confluence`, `notion` | `login`, `me`, `projects`, `issues`, `page`, `search` |
| `editor` | local file and media editing | `image`, `video`, `audio`, `pdf`, `document`, `subtitle` | `info`, `convert`, `resize`, `split`, `watermark`, `ocr` |
| `data` | structured data cleanup and transformation | `json`, `csv`, `yaml`, `xml`, `html`, `markdown`, `text` | `format`, `query`, `to-json`, `filter`, `text`, `replace` |
| `tools` | public utilities and web helpers | `websearch`, `translate`, `page-links`, `favicon`, `headers`, `screenshot`, `rss`, `timezone` | lookup-style commands, usually with no login |
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
| `cookies` | Import browser cookies once with `login --cookies ...` |
| `session` | Do one interactive login once, then reuse the saved session |
| `bot token` | Save a bot token once with `login --token ...` |
| `local tools` | Requires binaries like `ffmpeg`, `qpdf`, or `tesseract` |

## Safe Agent Defaults

- Use `--json` unless the user clearly wants formatted terminal output.
- Prefer read-only commands before mutations.
- Use `doctor` and `sessions` before assuming auth is broken.
- For nested help, use `autocli <category> --help` then `autocli <category> <provider> --help`.
- Do not use flat legacy forms like `autocli github ...` or `autocli chatgpt ...`.
