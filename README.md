# AutoCLI

AutoCLI is a Bun-first TypeScript CLI for browserless social automation. It imports an existing authenticated browser session once, stores it under `~/.autocli/sessions/` with account-based filenames, and then performs actions headlessly from the terminal without launching Playwright or Puppeteer.

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

- Facebook
  - `login`
  - `status`
  - `post`, `like`, and `comment` commands return explicit Facebook-specific errors until the write layer is implemented
- Instagram
  - `login`
  - `post` with media + caption
  - `like`
  - `comment`
- LinkedIn
  - `login`
  - `post` / `share` with text
  - `like`
  - `comment`
- TikTok
  - `login`
  - `status`
  - `post`, `like`, and `comment` commands are wired, but TikTok web write signing is not implemented yet
- X
  - `login`
  - `post` / `tweet` with optional image
  - `like`
  - `comment`
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
    │   └── cookie-manager.test.ts
    ├── adapters
    │   ├── base.ts
    │   ├── facebook.ts
    │   ├── index.ts
    │   ├── instagram.ts
    │   ├── linkedin.ts
    │   ├── youtube.ts
    │   ├── tiktok.ts
    │   └── x.ts
    ├── commands
    │   ├── facebook.ts
    │   ├── instagram.ts
    │   ├── linkedin.ts
    │   ├── status.ts
    │   ├── youtube.ts
    │   ├── tiktok.ts
    │   └── x.ts
    ├── utils
    │   ├── cli.ts
    │   ├── cookie-manager.ts
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

## Default flow

The intended workflow is:

1. Connect a platform once with `login`.
2. AutoCLI stores that session under the detected account name.
3. Later commands omit `--account` and AutoCLI uses the most recently saved session for that platform.

Import Instagram cookies:

```bash
autocli instagram login --cookies ./instagram.cookies.txt
```

Post to Instagram:

```bash
autocli instagram post ./photo.jpg --caption "Shipping from the terminal"
```

Like or comment on Instagram:

```bash
autocli instagram search "blackpink"
autocli instagram posts @username --limit 5
autocli instagram stories @username
autocli instagram storydownload @username
autocli instagram followers @username --limit 5
autocli instagram following @username --limit 5
autocli instagram mediaid https://www.instagram.com/p/SHORTCODE/
autocli instagram profileid @username
autocli instagram download https://www.instagram.com/p/SHORTCODE/
autocli instagram like https://www.instagram.com/p/SHORTCODE/
autocli instagram unlike https://www.instagram.com/p/SHORTCODE/
autocli instagram comment https://www.instagram.com/p/SHORTCODE/ "Looks great"
autocli instagram follow @username
autocli instagram unfollow @username
```

Import Facebook cookies:

```bash
autocli facebook login --cookies ./facebook.cookies.json
```

Check the saved Facebook session:

```bash
autocli status
```

Facebook write commands are present, but this adapter currently returns structured Facebook-specific errors for write actions:

```bash
autocli facebook post "Posting from AutoCLI"
autocli facebook like "https://www.facebook.com/permalink.php?story_fbid=456&id=123"
autocli facebook comment "123_456" "Nice post"
```

Import X cookies:

```bash
autocli x login --cookies ./x.cookies.txt
```

Post to X:

```bash
autocli x post "Launching AutoCLI" --image ./launch.png
autocli x tweet "Plain text post" --json
```

Like or reply on X:

```bash
autocli x like https://x.com/user/status/1234567890
autocli x comment 1234567890 "Nice work"
```

Import LinkedIn cookies:

```bash
autocli linkedin login --cookies ./linkedin.cookies.txt
```

Post, like, or comment on LinkedIn:

```bash
autocli linkedin post "Shipping browserless automation from the terminal"
autocli linkedin like "https://www.linkedin.com/feed/update/urn:li:activity:1234567890123456789/"
autocli linkedin comment "urn:li:activity:1234567890123456789" "Nice launch"
```

Import TikTok cookies:

```bash
autocli tiktok login --cookies ./tiktok.cookies.json
```

Check the saved TikTok session:

```bash
autocli status
```

TikTok write commands are present, but the adapter currently returns a structured `TIKTOK_SIGNING_REQUIRED` error until the TikTok web request-signing layer is added:

```bash
autocli tiktok post ./clip.mp4 --caption "Posting from AutoCLI"
autocli tiktok like "https://www.tiktok.com/@user/video/7486727777941556488"
autocli tiktok comment "7486727777941556488" "Nice clip"
```

Import YouTube cookies:

```bash
autocli youtube login --cookies ./youtube.cookies.txt
```

Use YouTube engagement actions:

```bash
autocli youtube download "dQw4w9WgXcQ"
autocli youtube download "dQw4w9WgXcQ" --audio-only
autocli youtube search "rick astley"
autocli youtube videoid "dQw4w9WgXcQ"
autocli youtube channelid "@RickAstleyYT"
autocli youtube playlistid "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI"
autocli youtube related "dQw4w9WgXcQ"
autocli youtube captions "dQw4w9WgXcQ"
autocli youtube like "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
autocli youtube dislike "dQw4w9WgXcQ"
autocli youtube unlike "dQw4w9WgXcQ"
autocli youtube comment "dQw4w9WgXcQ" "Nice video"
autocli youtube subscribe "@RickAstleyYT"
autocli youtube unsubscribe "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw"
```

YouTube downloads use `yt-dlp` plus `ffmpeg`. That is the correct implementation path; raw `ffmpeg` alone is not enough to resolve YouTube formats and signatures reliably.

YouTube video uploads and community posting are not implemented yet. `autocli youtube upload ...` exists as the eventual entrypoint, but it currently returns a structured unsupported-action error because the Studio upload flow is separate from the watch-page action flow.

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
bun run dev x login --cookies ./cookie.json
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
