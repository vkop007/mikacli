# SoundCloud

Generated from the real AutoCLI provider definition and command tree.

- Provider: `soundcloud`
- Category: `music`
- Command prefix: `autocli music soundcloud`
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

- `autocli music soundcloud search "dandelions"`
- `autocli music soundcloud search "avicii" --type user`
- `autocli music soundcloud track https://soundcloud.com/aditya-tanwar-714460659/ruth-b-dandelions-tiktok`
- `autocli music soundcloud capabilities --json`

## Default Command

Usage:
```bash
autocli music soundcloud [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli music soundcloud search [options] <query>
```

Search public SoundCloud tracks, playlists, users, or all result types

Options:

- `--type <kind>`: Result type: track, playlist, user, or all (default: track)
- `--limit <number>`: Maximum number of results to return (default: 5, max: 25)

### `track`

Usage:
```bash
autocli music soundcloud track [options] <target>
```

Aliases: `info`

Load a SoundCloud track by URL, numeric track ID, or search query

No command-specific options.

### `playlist`

Usage:
```bash
autocli music soundcloud playlist [options] <target>
```

Load a SoundCloud playlist by URL, numeric playlist ID, or search query

Options:

- `--limit <number>`: Maximum playlist tracks to print (default: 10, max: 50)

### `user`

Usage:
```bash
autocli music soundcloud user [options] <target>
```

Load a SoundCloud user by URL, numeric user ID, or search query

Options:

- `--limit <number>`: Maximum user tracks to print (default: 10, max: 25)

### `related`

Usage:
```bash
autocli music soundcloud related [options] <target>
```

Load related SoundCloud tracks for a track URL, ID, or search query

Options:

- `--limit <number>`: Maximum related tracks to return (default: 5, max: 25)

### `download`

Usage:
```bash
autocli music soundcloud download [options] <target>
```

Download a SoundCloud track by URL, ID, or search query

Options:

- `--output <path>`: Optional exact output file path
- `--output-dir <path>`: Optional output directory for the saved track

### `capabilities`

Usage:
```bash
autocli music soundcloud capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
