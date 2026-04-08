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

Interact with YouTube using an imported browser session for public lookup, engagement, and Studio uploads. Use `autocli tools download` for cross-site media downloads.

## Notes

- Studio uploads are browser-backed. Watch-page likes, dislikes, comments, and subscriptions still use request tokens from the saved session.

## Fast Start

- `autocli social youtube login`
- `autocli social youtube login --cookies ./cookiestest/youtube.json`
- `autocli social youtube status`
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

### `status`

Usage:
```bash
autocli social youtube status [options]
```

Show the saved YouTube session status

Options:

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

Publish a YouTube community post, optionally with one image, through a browser-backed Community tab flow

Options:

- `--account <name>`: Optional override for a specific saved YouTube session
- `--image <path>`: Attach one image to the YouTube community post
- `--browser`: Force the post through the shared AutoCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

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

### `delete`

Usage:
```bash
autocli social youtube delete [options] <target>
```

Aliases: `remove`

Delete your own YouTube community post by /post URL, community?lb= URL, or post ID through a browser-backed flow

Options:

- `--account <name>`: Optional override for a specific saved YouTube session
- `--browser`: Force the delete through the shared AutoCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

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
