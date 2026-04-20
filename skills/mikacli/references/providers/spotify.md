# Spotify

Generated from the real MikaCLI provider definition and command tree.

- Provider: `spotify`
- Category: `music`
- Command prefix: `mikacli music spotify`
- Aliases: none
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with Spotify using an imported browser session

## Notes

- none

## Fast Start

- `mikacli music spotify me --json`
- `mikacli music spotify capabilities --json`

## Default Command

Usage:
```bash
mikacli music spotify [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli music spotify login [options]
```

Save the Spotify session for future headless use. With no auth flags, MikaCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `me`

Usage:
```bash
mikacli music spotify me [options]
```

Load the authenticated Spotify account profile using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `search`

Usage:
```bash
mikacli music spotify search [options] <query>
```

Search Spotify tracks, albums, artists, or playlists using the saved session

Options:

- `--type <kind>`: Search result type: track, album, artist, or playlist (default: track)
- `--limit <number>`: Maximum number of results to return (1-50, default: 5)
- `--account <name>`: Optional override for a specific saved Spotify session

### `trackid`

Usage:
```bash
mikacli music spotify trackid [options] <target>
```

Aliases: `info`

Load exact Spotify track details by URL, spotify: URI, or 22-character track ID

No command-specific options.

### `albumid`

Usage:
```bash
mikacli music spotify albumid [options] <target>
```

Aliases: `album`

Load exact Spotify album details by URL, spotify: URI, or 22-character album ID

Options:

- `--limit <number>`: Maximum number of album tracks to show (1-50, default: 10)

### `artistid`

Usage:
```bash
mikacli music spotify artistid [options] <target>
```

Aliases: `artist`

Load exact Spotify artist details by URL, spotify: URI, or 22-character artist ID

Options:

- `--limit <number>`: Maximum number of top tracks to show (1-50, default: 5)

### `playlistid`

Usage:
```bash
mikacli music spotify playlistid [options] <target>
```

Aliases: `playlist`

Load exact Spotify playlist details by URL, spotify: URI, or 22-character playlist ID

Options:

- `--limit <number>`: Maximum number of playlist tracks to show (1-50, default: 10)

### `devices`

Usage:
```bash
mikacli music spotify devices [options]
```

List available Spotify Connect devices for the saved session

Options:

- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `status`

Usage:
```bash
mikacli music spotify status [options]
```

Show current Spotify playback state, active device, and current track

Options:

- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `recent`

Usage:
```bash
mikacli music spotify recent [options]
```

Show recently played Spotify tracks

Options:

- `--limit <number>`: Maximum number of tracks to return (1-50, default: 10)
- `--account <name>`: Optional override for a specific saved Spotify session

### `top`

Usage:
```bash
mikacli music spotify top [options] <type>
```

Show top Spotify tracks or artists for the authenticated account

Options:

- `--range <range>`: Time range: short_term, medium_term, or long_term (default: medium_term)
- `--limit <number>`: Maximum number of items to return (1-50, default: 10)
- `--account <name>`: Optional override for a specific saved Spotify session

### `savedtracks`

Usage:
```bash
mikacli music spotify savedtracks [options]
```

Aliases: `likedtracks`, `likes`

List saved Spotify tracks from your library

Options:

- `--limit <number>`: Maximum number of tracks to return (1-50, default: 10)
- `--offset <number>`: Offset for pagination
- `--account <name>`: Optional override for a specific saved Spotify session

### `playlists`

Usage:
```bash
mikacli music spotify playlists [options]
```

List the authenticated Spotify user's playlists

Options:

- `--limit <number>`: Maximum number of playlists to return (1-50, default: 10)
- `--offset <number>`: Offset for pagination
- `--account <name>`: Optional override for a specific saved Spotify session

### `playlistcreate`

Usage:
```bash
mikacli music spotify playlistcreate [options] <name>
```

Aliases: `playlist-create`

Create a Spotify playlist in the authenticated account

Options:

- `--description <text>`: Optional playlist description
- `--public`: Create the playlist as public
- `--collaborative`: Create the playlist as collaborative
- `--account <name>`: Optional override for a specific saved Spotify session

### `playlisttracks`

Usage:
```bash
mikacli music spotify playlisttracks [options] <target>
```

Aliases: `playlist-tracks`

List tracks inside a Spotify playlist

Options:

- `--limit <number>`: Maximum number of tracks to return (1-50, default: 10)
- `--offset <number>`: Offset for pagination
- `--account <name>`: Optional override for a specific saved Spotify session

### `playlistadd`

Usage:
```bash
mikacli music spotify playlistadd [options] <playlist> <targets...>
```

Aliases: `playlist-add`

Add one or more Spotify tracks to a playlist

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `playlistremove`

Usage:
```bash
mikacli music spotify playlistremove [options] <playlist> <targets...>
```

Aliases: `playlist-remove`

Remove one or more Spotify tracks from a playlist

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `device`

Usage:
```bash
mikacli music spotify device [options] <target>
```

Aliases: `transfer`

Transfer Spotify playback to a device id or matching device name

Options:

- `--play`: Resume playback on the destination device after transfer
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `play`

Usage:
```bash
mikacli music spotify play [options] [target]
```

Resume playback or start a Spotify track, album, artist, or playlist

Options:

- `--device <target>`: Optional device id or name to target
- `--type <kind>`: Interpret a raw id as track, album, artist, or playlist
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `pause`

Usage:
```bash
mikacli music spotify pause [options]
```

Pause Spotify playback on the active or chosen device

Options:

- `--device <target>`: Optional device id or name to target
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `next`

Usage:
```bash
mikacli music spotify next [options]
```

Skip to the next Spotify track

Options:

- `--device <target>`: Optional device id or name to target
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `previous`

Usage:
```bash
mikacli music spotify previous [options]
```

Aliases: `prev`

Go back to the previous Spotify track

Options:

- `--device <target>`: Optional device id or name to target
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `seek`

Usage:
```bash
mikacli music spotify seek [options] <position>
```

Seek Spotify playback to a position in milliseconds or mm:ss

Options:

- `--device <target>`: Optional device id or name to target
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `volume`

Usage:
```bash
mikacli music spotify volume [options] <percent>
```

Set Spotify playback volume from 0 to 100

Options:

- `--device <target>`: Optional device id or name to target
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `shuffle`

Usage:
```bash
mikacli music spotify shuffle [options] <state>
```

Turn Spotify shuffle on or off

Options:

- `--device <target>`: Optional device id or name to target
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `repeat`

Usage:
```bash
mikacli music spotify repeat [options] <state>
```

Set Spotify repeat mode to off, track, or context

Options:

- `--device <target>`: Optional device id or name to target
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `queue`

Usage:
```bash
mikacli music spotify queue [options]
```

Show the current Spotify queue

Options:

- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `queueadd`

Usage:
```bash
mikacli music spotify queueadd [options] <target>
```

Aliases: `queue-add`

Add a Spotify track to the playback queue

Options:

- `--device <target>`: Optional device id or name to target
- `--engine <mode>`: Spotify playback engine: auto, connect, or web (default: auto)
- `--account <name>`: Optional override for a specific saved Spotify session

### `like`

Usage:
```bash
mikacli music spotify like [options] <target>
```

Save a Spotify track to your library by URL, spotify: URI, or 22-character track ID

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `unlike`

Usage:
```bash
mikacli music spotify unlike [options] <target>
```

Remove a Spotify track from your library

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `followartist`

Usage:
```bash
mikacli music spotify followartist [options] <target>
```

Aliases: `follow-artist`

Follow a Spotify artist by URL, spotify: URI, or 22-character artist ID

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `unfollowartist`

Usage:
```bash
mikacli music spotify unfollowartist [options] <target>
```

Aliases: `unfollow-artist`

Unfollow a Spotify artist

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `followplaylist`

Usage:
```bash
mikacli music spotify followplaylist [options] <target>
```

Aliases: `follow-playlist`

Follow a Spotify playlist by URL, spotify: URI, or 22-character playlist ID

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `unfollowplaylist`

Usage:
```bash
mikacli music spotify unfollowplaylist [options] <target>
```

Aliases: `unfollow-playlist`

Unfollow a Spotify playlist

Options:

- `--account <name>`: Optional override for a specific saved Spotify session

### `capabilities`

Usage:
```bash
mikacli music spotify capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
