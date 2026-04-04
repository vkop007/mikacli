# YouTube

Generated from the real AutoCLI provider definition and command tree.

- Provider: `youtube`
- Category: `social`
- Command prefix: `autocli social youtube`
- Aliases: `yt`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `partial`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Interact with YouTube using an imported browser session for public lookup, engagement, downloads, and Studio uploads

## Notes

- Studio uploads are browser-backed. Watch-page likes, dislikes, comments, and subscriptions still use request tokens from the saved session.

## Fast Start

- `autocli social youtube login`
- `autocli social youtube login --cookies ./cookiestest/youtube.json`
- `autocli social youtube upload ./video.mp4 --title "AutoCLI upload" --visibility private`
- `autocli social youtube capabilities --json`

## Default Command

Usage:
```bash
autocli social youtube [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli social youtube login [options]
```

Save the YouTube session for future headless use. With no auth flags, AutoCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `download`

Usage:
```bash
autocli social youtube download [options] <target>
```

Download a YouTube video or audio track using yt-dlp and ffmpeg

Options:

- `--output-dir <path>`: Directory to write downloaded files into
- `--filename <template>`: yt-dlp output template, for example '%(title)s [%(id)s].%(ext)s'
- `--audio-only`: Extract audio only instead of video + audio
- `--audio-format <format>`: Audio format when using --audio-only (default: mp3)
- `--format <selector>`: Custom yt-dlp format selector
- `--account <name>`: Optional override for a specific saved YouTube session

### `upload`

Usage:
```bash
autocli social youtube upload [options] <mediaPath>
```

Upload a YouTube video through YouTube Studio using the saved session

Options:

- `--caption <text>`: Backward-compatible alias for --title
- `--title <text>`: Video title to set in YouTube Studio
- `--description <text>`: Video description to set in YouTube Studio
- `--visibility <mode>`: Visibility: private, unlisted, or public
- `--made-for-kids`: Mark the upload as made for kids
- `--not-made-for-kids`: Mark the upload as not made for kids (default)
- `--tags <csv>`: Comma-separated tags to add in the Studio metadata form
- `--playlist <name>`: Playlist name to select in the Studio playlist picker
- `--thumbnail <path>`: Optional thumbnail image to upload in Studio
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser upload flow to complete
- `--account <name>`: Optional override for a specific saved YouTube session

### `post`

Usage:
```bash
autocli social youtube post [options] <text>
```

YouTube text posting is not implemented in this CLI

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `search`

Usage:
```bash
autocli social youtube search [options] <query>
```

Search YouTube videos

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved YouTube session

### `videoid`

Usage:
```bash
autocli social youtube videoid [options] <target>
```

Aliases: `info`

Load exact YouTube video details by URL or 11-character video ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `channelid`

Usage:
```bash
autocli social youtube channelid [options] <target>
```

Aliases: `channel`

Load exact YouTube channel details by URL, @handle, or UC... channel ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `playlistid`

Usage:
```bash
autocli social youtube playlistid [options] <target>
```

Aliases: `playlist`

Load exact YouTube playlist details by URL or playlist ID

Options:

- `--limit <number>`: Maximum number of playlist items to show (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved YouTube session

### `related`

Usage:
```bash
autocli social youtube related [options] <target>
```

Load related YouTube videos for a given video URL or ID

Options:

- `--limit <number>`: Maximum number of related videos to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved YouTube session

### `captions`

Usage:
```bash
autocli social youtube captions [options] <target>
```

List available YouTube caption tracks for a video URL or ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `like`

Usage:
```bash
autocli social youtube like [options] <target>
```

Like a YouTube video by URL or 11-character video ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `dislike`

Usage:
```bash
autocli social youtube dislike [options] <target>
```

Dislike a YouTube video by URL or 11-character video ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `unlike`

Usage:
```bash
autocli social youtube unlike [options] <target>
```

Clear the current like/dislike state for a YouTube video

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `comment`

Usage:
```bash
autocli social youtube comment [options] <target> <text>
```

Comment on a YouTube video by URL or 11-character video ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `subscribe`

Usage:
```bash
autocli social youtube subscribe [options] <target>
```

Subscribe to a YouTube channel by URL, @handle, or UC... channel ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `unsubscribe`

Usage:
```bash
autocli social youtube unsubscribe [options] <target>
```

Unsubscribe from a YouTube channel by URL, @handle, or UC... channel ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube session

### `capabilities`

Usage:
```bash
autocli social youtube capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
