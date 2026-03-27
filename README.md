# AutoCLI

AutoCLI is a Bun-first TypeScript CLI for browserless social automation. It supports both imported browser sessions and token-based bot connections, stores them under `~/.autocli/sessions/` and `~/.autocli/connections/`, and runs subsequent actions headlessly from the terminal without launching Playwright or Puppeteer.

Commands are organized by category only:

- `autocli llm ...`
- `autocli editor ...`
- `autocli social ...`
- `autocli shopping ...`
- `autocli api ...`
- `autocli music ...`
- `autocli public ...`

## Why `Commander.js + Zod`

I chose `Commander.js + Zod` over `oclif` and `Clerc` for this build because the goal here is a Bun-first, single-binary CLI with a small runtime surface:

- `Commander.js` stays lightweight and works cleanly with modern ESM TypeScript.
- `Zod` gives us strict validation without forcing a framework-specific command model.
- Bun’s official executable docs support compiling TypeScript CLIs directly with `bun build --compile`, which fits AutoCLI’s distribution model well.

Reference points:

- [Bun single-file executables](https://bun.sh/docs/bundler/executables)
- [Commander.js repository and docs](https://github.com/tj/commander.js)
- [oclif introduction](https://oclif.io/docs/introduction/)

## Current platform coverage

| Category | Providers | Count | Route pattern |
| --- | --- | ---: | --- |
| LLM | ChatGPT, Claude, DeepSeek, Gemini, Grok, Mistral, Perplexity, Qwen, Z.ai | 9 | `autocli llm <provider> ...` |
| Editor | Archive Editor, Audio Editor, Document Editor, GIF Editor, Image Editor, PDF Editor, Subtitle Editor, Video Editor | 8 | `autocli editor <provider> ...` |
| Music | Spotify, YouTube Music | 2 | `autocli music <provider> ...` |
| Social | Facebook, Instagram, LinkedIn, TikTok, X, YouTube | 6 | `autocli social <provider> ...` |
| Shopping | Amazon, Flipkart | 2 | `autocli shopping <provider> ...` |
| API | Discord Bot, GitHub, GitHub Bot, GitLab, Linear, Notion, Slack Bot, Telegram Bot | 8 | `autocli api <provider> ...` |
| Public | Cheat, Crypto, Currency, DNS, IP, Markdown Fetch, News, QR, Robots, RSS, Screenshot, Sitemap, Stocks, Time, Translate, Uptime, Weather, Web Search, Whois | 19 | `autocli public <provider> ...` |
| Total | 54 providers across 7 command groups | 54 | category-only |

### Capability highlights

- Archive Editor
  - `info`
  - `list`
  - `create`
  - `extract`
  - `gzip`
  - `gunzip`
- Facebook
  - `login`
  - `status`
  - `post`, `like`, and `comment` commands return explicit Facebook-specific errors until the write layer is implemented
- GitHub
  - `login --token`
  - `me`
  - `repos`
  - `repo`
  - `search-repos`
  - `issues`
  - `issue`
  - `create-issue`
  - `create-repo`
  - `star`
  - `unstar`
- GitLab
  - `login --token`
  - `me`
  - `projects`
  - `project`
  - `search-projects`
  - `issues`
  - `issue`
  - `create-issue`
  - `merge-requests`
  - `merge-request`
- Discord Bot
  - `login --token`
  - `me`
  - `guilds`
  - `channels`
  - `history`
  - `send`
  - `send-file`
  - `edit`
  - `delete`
- Document Editor
  - `info`
  - `convert`
  - `extract-text`
  - `to-markdown`
  - `metadata`
- GIF Editor
  - `info`
  - `create` / `from-video`
  - `optimize`
  - `to-video`
- Instagram
  - `login`
  - `post` with media + caption
  - `like`
  - `comment`
- News
  - `sources`
  - `top`
  - `search`
  - `feed <url>`
  - no API key required
- LinkedIn
  - `login`
  - `post` / `share` with text
  - `like`
  - `comment`
- Linear
  - `login --token`
  - `me`
  - `teams`
  - `projects`
  - `issues`
  - `issue`
  - `create-issue`
  - `update-issue`
  - `comment`
- Audio Editor
  - `info`
  - `trim`
  - `convert`
  - `compress`
  - `merge`
  - `fade-in`
  - `fade-out`
  - `trim-silence`
  - `normalize`
  - `volume`
  - `denoise`
  - `silence-detect`
  - `loudness-report`
  - `waveform`
  - `spectrogram`
- Cheat
  - `cheat <topic>`
  - optional `--shell` and `--lang` context
- Image Editor
  - `info`
  - `resize`
  - `crop`
  - `convert`
  - `rotate`
  - `compress`
  - `grayscale`
  - `blur`
  - `sharpen`
  - `thumbnail`
  - `strip-metadata`
  - `background-remove`
  - `watermark`
- PDF Editor
  - `info`
  - `merge`
  - `split`
  - `extract-pages`
  - `remove-pages`
  - `metadata`
  - `rotate`
  - `reorder-pages`
  - `watermark`
  - `optimize` / `compress`
  - `encrypt`
  - `decrypt`
- IP
  - `ip`
  - `ip --version 4|6|any`
  - `ip --details`
- Screenshot
  - `screenshot <url>`
  - `screenshot <url> --output-dir ./shots`
  - `screenshot <url> --output ./page.png`
- Amazon
  - `login`
  - `status`
  - `search`
  - `product`
  - `orders`
- Flipkart
  - `login`
  - `status`
  - `search`
  - `product`
  - `orders`
- TikTok
  - `login`
  - `status`
  - `post`, `like`, and `comment` commands are wired, but TikTok web write signing is not implemented yet
- Uptime
  - `uptime <url>`
  - `uptime <url> --method HEAD|GET`
  - `uptime <url> --timeout 15000`
- Subtitle Editor
  - `info`
  - `convert`
  - `shift`
  - `sync`
  - `clean`
  - `burn`
  - `merge`
- Video Editor
  - `info`
  - `trim`
  - `split`
  - `scene-detect`
  - `convert`
  - `compress`
  - `speed`
  - `reverse`
  - `boomerang`
  - `overlay-image`
  - `overlay-text`
  - `audio-replace`
  - `frame-extract`
  - `thumbnail`
  - `resize`
  - `crop`
  - `extract-audio`
  - `mute`
  - `gif`
  - `concat`
  - `subtitle-burn`
- Web Search
  - `engines`
  - `search`
- QR
  - `qr <text>`
  - optional `--size`, `--margin`, `--url`
- Slack Bot
  - `login --token`
  - `me`
  - `channels`
  - `history`
  - `send`
  - `send-file`
  - `edit`
  - `delete`
- Spotify
  - `login`
  - `me`
  - `search`
  - `trackid` / `info`
  - `albumid`
  - `artistid`
  - `playlistid`
  - `devices`
  - `status`
  - `recent`
  - `top`
  - `savedtracks`
  - `playlists`
  - `playlistcreate`
  - `playlisttracks`
  - `playlistadd`
  - `playlistremove`
  - `device` / `transfer`
  - `play`
  - `pause`
  - `next`
  - `previous`
  - `seek`
  - `volume`
  - `shuffle`
  - `repeat`
  - `queue`
  - `queueadd`
  - `like`
  - `unlike`
  - `followartist`
  - `unfollowartist`
  - `followplaylist`
  - `unfollowplaylist`
- Telegram Bot
  - `login --token`
  - `me`
  - `getchat`
  - `chats`
  - `updates`
  - `send`
  - `send-photo`
  - `send-document`
  - `send-video`
  - `send-audio`
  - `send-voice`
  - `edit`
  - `delete`
- X
  - `login`
  - `post` / `tweet` with optional image
  - `search` for accounts
  - `tweetid` / `info`
  - `profileid` / `profile`
  - `tweets`
  - `like`
  - `unlike`
  - `comment`
- Time
  - `time`
  - `time <timezone>`
- Weather
  - `weather [location]`
  - optional `--days` and `--lang`
- Global
  - `status`

## Important note

Facebook, Instagram, TikTok, and X private web endpoints change over time. This project isolates each platform into its own adapter, uses fallback endpoint chains where practical, and returns structured errors when a session or endpoint drifts. For a long-lived production rollout, the best next step is a dual-mode auth strategy:

- Use official APIs wherever the platform makes them viable.
- Keep cookie-backed web-session adapters for actions the official APIs do not expose.

That gives you a much more durable production system than relying on private web flows alone.

## Project structure

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
    │   ├── status.ts
    │   └── ...
    ├── platforms
    │   ├── api
    │   ├── bots
    │   ├── public
    │   ├── shared
    │   ├── social
    │   ├── config.ts
    │   └── index.ts
    ├── utils
    │   ├── cli.ts
    │   ├── cookie-manager.ts
    │   ├── file-source.ts
    │   ├── http-client.ts
    │   ├── media.ts
    │   ├── output.ts
    │   └── targets.ts
    ├── config.ts
    ├── errors.ts
    ├── index.ts
    ├── logger.ts
    └── types.ts
```

## Installation

```bash
bun install
```

That already runs the `prepare` build step and generates `dist/index.js`.

Build a single standalone binary:

```bash
bun run build:bin
```

Expose `autocli` on your shell path during local development:

```bash
bun run link:global
```

If your current shell still says `command not found`, open a new shell or run `hash -r` once so it refreshes command lookups.

## Session storage

Sessions are stored as JSON under:

```text
~/.autocli/sessions/<platform>/<account>.json
```

Token-based bot connections are stored under:

```text
~/.autocli/connections/<platform>/<account>.json
```

API-token connections, including GitHub personal access tokens, are stored in the same `~/.autocli/connections/` tree.

AutoCLI supports importing:

- Netscape `cookies.txt`
- raw cookie strings
- JSON cookie arrays
- serialized `tough-cookie` jars

## Usage

Show all connected accounts:

```bash
autocli status
autocli status --json
```

If you have not linked the package globally yet, use the local one-shot runner instead:

```bash
bun run dev status
```

## GitHub

Save a GitHub personal access token:

```bash
autocli api github login --token github_pat_xxx
```

Inspect the authenticated account and repos:

```bash
autocli api github me
autocli api github user torvalds
autocli api github repos
autocli api github repo openai/openai-node
autocli api github search-repos "typescript cli" --limit 10
autocli api github starred
autocli api github branches openai/openai-node
autocli api github pulls openai/openai-node --state open --limit 10
autocli api github releases openai/openai-node --limit 5
autocli api github readme openai/openai-node
```

Work with issues and repository actions:

```bash
autocli api github issues openai/openai-node --state open --limit 10
autocli api github issue openai/openai-node 1
autocli api github create-issue owner/repo --title "Bug report" --body "Details here"
autocli api github comment owner/repo 123 --body "Looks good to me"
autocli api github create-repo autocli-playground --private --auto-init
autocli api github fork openai/openai-node
autocli api github star openai/openai-node

## GitHub Bot

Use a GitHub App installation token or bot-style token with the same GitHub command surface:

```bash
autocli api githubbot login --token <github-app-or-bot-token>
autocli api githubbot me
autocli api githubbot repos
autocli api githubbot repo openai/openai-node
autocli api githubbot issues openai/openai-node --state open --limit 10
autocli api githubbot pulls openai/openai-node --state open --limit 10
autocli api githubbot create-issue owner/repo --title "Bug report" --body "Details here"
autocli api githubbot star openai/openai-node
```

## GitLab

Use a GitLab personal access token to inspect projects, issues, and merge requests:

```bash
autocli api gitlab login --token glpat_xxx
autocli api gitlab me
autocli api gitlab projects "autocli" --limit 10
autocli api gitlab project group/subgroup/project
autocli api gitlab search-projects "typescript cli" --limit 10
autocli api gitlab issues group/project --state opened --limit 10
autocli api gitlab issue group/project 123
autocli api gitlab create-issue group/project --title "Bug report" --body "Details here"
autocli api gitlab merge-requests group/project --state opened --limit 10
autocli api gitlab merge-request group/project 123
```

## Linear

Use a Linear personal API key to inspect teams, projects, and issues:

```bash
autocli api linear login --token lin_api_xxx
autocli api linear me
autocli api linear teams
autocli api linear projects
autocli api linear issues --team ENG --limit 20
autocli api linear issue ENG-123
autocli api linear create-issue --team ENG --title "Bug report" --description "Details here"
autocli api linear update-issue ENG-123 --title "Updated title"
autocli api linear comment ENG-123 --body "Looks good"
```

## Notion

Use a Notion integration token to search, inspect, and edit pages and data sources shared with the integration:

```bash
autocli api notion login --token secret_xxx
autocli api notion me
autocli api notion search "roadmap"
autocli api notion pages "launch"
autocli api notion page <page-id-or-url>
autocli api notion create-page --parent <page-or-data-source-id> --title "AutoCLI Notes" --content "Shipped from terminal"
autocli api notion update-page <page-id-or-url> --title "Updated title"
autocli api notion append <page-id-or-url> --text "Another paragraph"
autocli api notion databases
autocli api notion database <data-source-id-or-url>
autocli api notion query <data-source-id-or-url> --limit 10
autocli api notion comment <page-id-or-url> --text "Looks good"
```

## Web Search

Search the web with multiple engines without any account setup:

```bash
autocli public websearch engines
autocli public websearch search "bun cookies fetch"
autocli public websearch search "bun cookies fetch" --summary
autocli public websearch search "typescript cli" --engine bing
autocli public websearch search "typescript cli" --engine yahoo
autocli public websearch search "typescript cli" --engine yandex
autocli public websearch search "typescript cli" --engine baidu
autocli public websearch search "llm agent frameworks" --engine brave --limit 5
autocli public websearch search "terminal weather" --all --limit 3
```

## News

Read headlines and feeds from no-key sources such as Google News RSS, GDELT, Hacker News, Reddit, and generic RSS/Atom URLs:

```bash
autocli public news sources
autocli public news top
autocli public news search "typescript cli"
autocli public news search "ai agents" --source google
autocli public news feed "https://news.ycombinator.com/rss"
```

## Default flow

The intended workflow is:

1. Connect a platform once with `login`.
2. AutoCLI stores that session under the detected account name.
3. Later commands omit `--account` or `--bot` and AutoCLI uses the most recently saved connection for that platform.

Import Instagram cookies:

```bash
autocli social instagram login --cookies ./instagram.cookies.txt
```

Post to Instagram:

```bash
autocli social instagram post ./photo.jpg --caption "Shipping from the terminal"
```

Like or comment on Instagram:

```bash
autocli social instagram search "blackpink"
autocli social instagram posts @username --limit 5
autocli social instagram posts @username --type reel --limit 5
autocli social instagram stories @username
autocli social instagram stories @username --videos-only
autocli social instagram storydownload @username
autocli social instagram storydownload @username --photos-only
autocli social instagram downloadposts @username --limit 3
autocli social instagram batch download ./targets.txt
autocli social instagram batch storydownload ./profiles.txt --limit 1
autocli social instagram followers @username --limit 5
autocli social instagram following @username --limit 5
autocli social instagram mediaid https://www.instagram.com/p/SHORTCODE/
autocli social instagram profileid @username
autocli social instagram download https://www.instagram.com/p/SHORTCODE/
autocli social instagram like https://www.instagram.com/p/SHORTCODE/
autocli social instagram unlike https://www.instagram.com/p/SHORTCODE/
autocli social instagram comment https://www.instagram.com/p/SHORTCODE/ "Looks great"
autocli social instagram follow @username
autocli social instagram unfollow @username
```

Import Facebook cookies:

```bash
autocli social facebook login --cookies ./facebook.cookies.json
```

Check the saved Facebook session:

```bash
autocli status
```

Facebook write commands are present, but this adapter currently returns structured Facebook-specific errors for write actions:

```bash
autocli social facebook post "Posting from AutoCLI"
autocli social facebook like "https://www.facebook.com/permalink.php?story_fbid=456&id=123"
autocli social facebook comment "123_456" "Nice post"
```

Import X cookies:

```bash
autocli social x login --cookies ./x.cookies.txt
```

Post to X:

```bash
autocli social x post "Launching AutoCLI" --image ./launch.png
autocli social x tweet "Plain text post" --json
```

Inspect and search X:

```bash
autocli social x search "openai" --limit 5
autocli social x profileid @OpenAI
autocli social x tweets @OpenAI --limit 5
autocli social x tweetid https://x.com/OpenAI/status/2029620619743219811
```

Like or reply on X:

```bash
autocli social x like https://x.com/user/status/1234567890
autocli social x unlike 1234567890
autocli social x comment 1234567890 "Nice work"
```

Import LinkedIn cookies:

```bash
autocli social linkedin login --cookies ./linkedin.cookies.txt
```

Post, like, or comment on LinkedIn:

```bash
autocli social linkedin post "Shipping browserless automation from the terminal"
autocli social linkedin like "https://www.linkedin.com/feed/update/urn:li:activity:1234567890123456789/"
autocli social linkedin comment "urn:li:activity:1234567890123456789" "Nice launch"
```

Import TikTok cookies:

```bash
autocli social tiktok login --cookies ./tiktok.cookies.json
```

Check the saved TikTok session:

```bash
autocli status
```

TikTok write commands are present, but the adapter currently returns a structured `TIKTOK_SIGNING_REQUIRED` error until the TikTok web request-signing layer is added:

```bash
autocli social tiktok post ./clip.mp4 --caption "Posting from AutoCLI"
autocli social tiktok like "https://www.tiktok.com/@user/video/7486727777941556488"
autocli social tiktok comment "7486727777941556488" "Nice clip"
```

Import YouTube cookies:

```bash
autocli social youtube login --cookies ./youtube.cookies.txt
```

Use YouTube engagement actions:

```bash
autocli social youtube download "dQw4w9WgXcQ"
autocli social youtube download "dQw4w9WgXcQ" --audio-only
autocli social youtube search "rick astley"
autocli social youtube videoid "dQw4w9WgXcQ"
autocli social youtube channelid "@RickAstleyYT"
autocli social youtube playlistid "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI"
autocli social youtube related "dQw4w9WgXcQ"
autocli social youtube captions "dQw4w9WgXcQ"
autocli social youtube like "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
autocli social youtube dislike "dQw4w9WgXcQ"
autocli social youtube unlike "dQw4w9WgXcQ"
autocli social youtube comment "dQw4w9WgXcQ" "Nice video"
autocli social youtube subscribe "@RickAstleyYT"
autocli social youtube unsubscribe "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw"
```

YouTube downloads use `yt-dlp` plus `ffmpeg`. That is the correct implementation path; raw `ffmpeg` alone is not enough to resolve YouTube formats and signatures reliably.

YouTube video uploads and community posting are not implemented yet. `autocli social youtube upload ...` exists as the eventual entrypoint, but it currently returns a structured unsupported-action error because the Studio upload flow is separate from the watch-page action flow.

Commands are category-based, so provider routes always live under their provider type:

```bash
autocli api github me
autocli api discordbot me
autocli llm chatgpt text "Hello my name is Justine"
autocli llm claude text "Summarize this changelog"
autocli llm deepseek text "Draft release notes for AutoCLI"
autocli llm perplexity login --cookies ./perplexity.cookies.json
autocli llm mistral login --cookies ./mistral.cookies.json
autocli llm qwen text "Design a clean onboarding flow for AutoCLI"
autocli llm zai text "Hello my name is Justine"
autocli llm gemini text "Draft a polite follow-up email"
autocli social youtube search "rick astley"
autocli music spotify search "dandelions"
autocli music youtube-music play "dandelions"
```

Top-level provider routes like `autocli youtube ...` and `autocli spotify ...` are intentionally disabled now to avoid namespace conflicts as more providers are added.

Cookie-backed LLM providers are scaffolded too:

```bash
autocli llm zai login --cookies ./zai.cookies.json
autocli llm chatgpt text "Hello my name is Justine"
autocli llm claude login --cookies ./claude.cookies.json
autocli llm claude image ./diagram.png --caption "Explain this architecture"
autocli llm deepseek login --cookies ./deepseek.cookies.json --token <userToken>
autocli llm deepseek text "Explain retrieval-augmented generation"
autocli llm gemini login --cookies ./gemini.cookies.json
autocli llm gemini text "Draft a polite follow-up email"
autocli llm perplexity login --cookies ./perplexity.cookies.json
autocli llm mistral login --cookies ./mistral.cookies.json
autocli llm qwen login --cookies ./qwen.cookies.json
autocli llm qwen login --cookies ./qwen.cookies.json --token <bearerToken>
autocli llm qwen text "Explain retrieval-augmented generation"
autocli llm zai text "Outline a landing page for AutoCLI"
```

These providers now share a proper command surface. Gemini, Claude, and Z.ai use saved browser sessions for active generation. ChatGPT currently uses the browserless anonymous web flow for `text` and image prompts, while `login` and `status` only validate imported ChatGPT sessions. DeepSeek uses the browser cookies plus the `userToken` stored in localStorage on DeepSeek’s site. Qwen usually works directly from imported browser cookies because the export often includes the `token` cookie, and `--token` is only needed when that cookie is missing from the export. Perplexity and Mistral are cookie-backed LLM providers with working browserless text flows, while image and video expansion still depends on validating each provider’s private upload endpoints.

Use YouTube Music search and browse actions:

```bash
autocli music youtube-music play "dandelions"
autocli music youtube-music pause
autocli music youtube-music next
autocli music youtube-music queue
autocli music youtube-music queueadd "taylor swift"
autocli music youtube-music search "dandelions"
autocli music youtube-music songid "HZbsLxL7GeM"
autocli music youtube-music related "HZbsLxL7GeM"
autocli music youtube-music albumid "MPREb_uPJnzIv7Wl1"
autocli music youtube-music artistid "UCOx12K3GqOMcIeyNTNj1Z6Q"
autocli music youtube-music playlistid "VLOLAK5uy_n2FuJRR4HTkLC7qK_aQX2Mjx-hW6TI5_k"
autocli music youtube-music login --cookies ./youtube.cookies.txt
autocli music youtube-music like "HZbsLxL7GeM"
autocli music youtube-music unlike "HZbsLxL7GeM"
```

YouTube Music playback control is local to this machine. `play`, `pause`, `next`, `previous`, `queue`, and `queueadd` use `yt-dlp` to resolve playable audio and `ffplay` to run a lightweight local controller without opening the browser.

YouTube Music read commands can fall back to public browsing when there is no valid saved session. Write commands like `like`, `dislike`, and `unlike` still require a fresh imported YouTube cookie export.

Save a Telegram bot token:

```bash
autocli api telegrambot login --token 123456:ABCDEF --name alerts-bot
autocli api telegrambot me
autocli api telegrambot me --bot alerts-bot
autocli api telegrambot chats --limit 25
autocli api telegrambot updates --limit 10
autocli api telegrambot send 123456789 "Hello from AutoCLI"
autocli api telegrambot send-photo 123456789 ./photo.jpg --caption "Hello"
autocli api telegrambot send-audio 123456789 ./clip.mp3 --caption "Listen"
autocli api telegrambot send-voice 123456789 ./voice.ogg
autocli api telegrambot edit 123456789 42 "Updated text"
autocli api telegrambot delete 123456789 42
```

Save a Discord bot token:

```bash
autocli api discordbot login --token <bot-token> --name ops-bot
autocli api discordbot me
autocli api discordbot guilds --bot ops-bot
autocli api discordbot channels 123456789012345678
autocli api discordbot history 123456789012345678 --limit 20
autocli api discordbot send 123456789012345678 "hello world"
autocli api discordbot send-file 123456789012345678 ./report.pdf --content "build output"
autocli api discordbot edit 123456789012345678 234567890123456789 "updated message"
autocli api discordbot delete 123456789012345678 234567890123456789
```

Save a Slack bot token:

```bash
autocli api slackbot login --token xoxb-123 --name alerts-bot
autocli api slackbot me
autocli api slackbot me --bot alerts-bot
autocli api slackbot channels
autocli api slackbot history general --limit 20
autocli api slackbot send general "hello from AutoCLI"
autocli api slackbot send-file general ./build.log --comment "nightly build"
autocli api slackbot edit general 1700000000.000000 "updated text"
autocli api slackbot delete general 1700000000.000000
```

If you connect multiple accounts for the same platform, AutoCLI keeps them all as named session files and uses the most recently logged-in one by default.

## Session auto-refresh

AutoCLI now includes a dedicated refresh layer in [autorefresh.ts](/Users/vk/dev/autocli/src/utils/autorefresh.ts).

- Instagram, X, and YouTube use a lightweight authenticated keepalive flow before normal actions when the saved auth cookies are getting old or near expiry.
- Any rotated cookies returned by the platform are persisted back into the saved session file.
- LinkedIn is intentionally manual-only. Its copied browser sessions are not safely refreshable with a generic keepalive flow, and aggressive probing can revoke the session.

This is the professional cookie-session approach, but it is not a universal guarantee. Some websites do not offer a safe or durable cookie-only refresh path once they decide to invalidate a copied session.

## Agent-friendly output

Every command accepts `--json` and returns structured payloads shaped like:

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

Errors follow a consistent shape:

```json
{
  "ok": false,
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "X returned a logged-out page. Re-import cookies.txt."
  }
}
```

## Development

Run the CLI locally one time:

```bash
bun run dev --help
bun run dev social x login --cookies ./cookie.json
```

Use watch mode only when you explicitly want it:

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
