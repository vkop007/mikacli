# SoundCloud

Generated from the real MikaCLI provider definition and command tree.

- Provider: `soundcloud`
- Category: `music`
- Command prefix: `mikacli music soundcloud`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `partial`
- Browser login: `partial`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public SoundCloud tracks, playlists, users, and download track audio

## Notes

- none

## Fast Start

- `mikacli music soundcloud search "dandelions"`
- `mikacli music soundcloud search "avicii" --type user`
- `mikacli music soundcloud track https://soundcloud.com/aditya-tanwar-714460659/ruth-b-dandelions-tiktok`
- `mikacli music soundcloud capabilities --json`

## Default Command

Usage:
```bash
mikacli music soundcloud [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
mikacli music soundcloud search [options] <query>
```

Search public SoundCloud tracks, playlists, users, or all result types

Options:

- `--type <kind>`: Result type: track, playlist, user, or all (default: track)
- `--limit <number>`: Maximum number of results to return (default: 5, max: 25)

### `track`

Usage:
```bash
mikacli music soundcloud track [options] <target>
```

Aliases: `info`

Load a SoundCloud track by URL, numeric track ID, or search query

No command-specific options.

### `playlist`

Usage:
```bash
mikacli music soundcloud playlist [options] <target>
```

Load a SoundCloud playlist by URL, numeric playlist ID, or search query

Options:

- `--limit <number>`: Maximum playlist tracks to print (default: 10, max: 50)

### `user`

Usage:
```bash
mikacli music soundcloud user [options] <target>
```

Load a SoundCloud user by URL, numeric user ID, or search query

Options:

- `--limit <number>`: Maximum user tracks to print (default: 10, max: 25)

### `related`

Usage:
```bash
mikacli music soundcloud related [options] <target>
```

Load related SoundCloud tracks for a track URL, ID, or search query

Options:

- `--limit <number>`: Maximum related tracks to return (default: 5, max: 25)

### `download`

Usage:
```bash
mikacli music soundcloud download [options] <target>
```

Download a SoundCloud track by URL, ID, or search query

Options:

- `--output <path>`: Optional exact output file path
- `--output-dir <path>`: Optional output directory for the saved track

### `capabilities`

Usage:
```bash
mikacli music soundcloud capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
