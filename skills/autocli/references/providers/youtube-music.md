# YouTube Music

Generated from the real AutoCLI provider definition and command tree.

- Provider: `youtube-music`
- Category: `music`
- Command prefix: `autocli music youtube-music`
- Aliases: `ytmusic`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with YouTube Music using an imported browser session

## Notes

- none

## Fast Start

- `autocli music youtube-music login`
- `autocli music youtube-music login --cookies ./cookiestest/youtube.json`
- `autocli music youtube-music play HZbsLxL7GeM`
- `autocli music youtube-music capabilities --json`

## Default Command

Usage:
```bash
autocli music youtube-music [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli music youtube-music login [options]
```

Save the YouTube Music session for future headless use. With no auth flags, AutoCLI opens browser login by default

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
autocli music youtube-music status [options]
```

Show the local YouTube Music playback controller state

No command-specific options.

### `play`

Usage:
```bash
autocli music youtube-music play [options] [target]
```

Start or resume local YouTube Music playback from a track, album, playlist, artist, or search query

Options:

- `--type <kind>`: Interpret the target as song, video, album, artist, or playlist
- `--limit <number>`: Maximum number of items to queue for collection or search targets (1-25, default: 5)
- `--account <name>`: Optional session to use while resolving protected YouTube Music targets

### `pause`

Usage:
```bash
autocli music youtube-music pause [options]
```

Pause the local YouTube Music playback controller

No command-specific options.

### `stop`

Usage:
```bash
autocli music youtube-music stop [options]
```

Stop the local YouTube Music playback controller

No command-specific options.

### `next`

Usage:
```bash
autocli music youtube-music next [options]
```

Skip to the next item in the local YouTube Music queue

No command-specific options.

### `previous`

Usage:
```bash
autocli music youtube-music previous [options]
```

Aliases: `prev`

Go to the previous item in the local YouTube Music queue

No command-specific options.

### `queue`

Usage:
```bash
autocli music youtube-music queue [options]
```

Show the local YouTube Music playback queue

No command-specific options.

### `queueadd`

Usage:
```bash
autocli music youtube-music queueadd [options] <target>
```

Add a YouTube Music track, album, playlist, artist, or search query to the local queue

Options:

- `--type <kind>`: Interpret the target as song, video, album, artist, or playlist
- `--limit <number>`: Maximum number of items to queue for collection or search targets (1-25, default: 5)
- `--account <name>`: Optional session to use while resolving protected YouTube Music targets

### `search`

Usage:
```bash
autocli music youtube-music search [options] <query>
```

Search YouTube Music songs, videos, albums, artists, or playlists

Options:

- `--type <kind>`: Optional result type filter: song, video, album, artist, or playlist
- `--limit <number>`: Maximum number of results to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved YouTube Music session

### `songid`

Usage:
```bash
autocli music youtube-music songid [options] <target>
```

Aliases: `info`

Load exact YouTube Music song or music-video details by URL or YouTube video ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube Music session

### `related`

Usage:
```bash
autocli music youtube-music related [options] <target>
```

Load related YouTube Music items for a song or music-video URL or ID

Options:

- `--limit <number>`: Maximum number of related items to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved YouTube Music session

### `albumid`

Usage:
```bash
autocli music youtube-music albumid [options] <target>
```

Load exact YouTube Music album details by browse URL or MPRE... album ID

Options:

- `--limit <number>`: Maximum number of album tracks to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved YouTube Music session

### `artistid`

Usage:
```bash
autocli music youtube-music artistid [options] <target>
```

Load exact YouTube Music artist details by browse URL or UC... artist ID

Options:

- `--limit <number>`: Maximum number of results to return per artist section (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved YouTube Music session

### `playlistid`

Usage:
```bash
autocli music youtube-music playlistid [options] <target>
```

Load exact YouTube Music playlist details by URL, playlist ID, or VL... browse ID

Options:

- `--limit <number>`: Maximum number of playlist items to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved YouTube Music session

### `like`

Usage:
```bash
autocli music youtube-music like [options] <target>
```

Like a YouTube Music song or music-video by URL or ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube Music session

### `dislike`

Usage:
```bash
autocli music youtube-music dislike [options] <target>
```

Dislike a YouTube Music song or music-video by URL or ID

Options:

- `--account <name>`: Optional override for a specific saved YouTube Music session

### `unlike`

Usage:
```bash
autocli music youtube-music unlike [options] <target>
```

Clear the current like/dislike state for a YouTube Music song or music-video

Options:

- `--account <name>`: Optional override for a specific saved YouTube Music session

### `capabilities`

Usage:
```bash
autocli music youtube-music capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
