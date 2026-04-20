# Deezer

Generated from the real MikaCLI provider definition and command tree.

- Provider: `deezer`
- Category: `music`
- Command prefix: `mikacli music deezer`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `partial`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Deezer tracks, albums, artists, and playlists through Deezer's public API

## Notes

- none

## Fast Start

- `mikacli music deezer search "radiohead"`
- `mikacli music deezer search "radiohead" --type album`
- `mikacli music deezer track 3135556`
- `mikacli music deezer capabilities --json`

## Default Command

Usage:
```bash
mikacli music deezer [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
mikacli music deezer search [options] <query>
```

Search public Deezer tracks, albums, artists, playlists, or all result types

Options:

- `--type <kind>`: Result type: track, album, artist, playlist, or all (default: all)
- `--limit <number>`: Maximum number of results to return (default: 5, max: 25)

### `track`

Usage:
```bash
mikacli music deezer track [options] <target>
```

Aliases: `info`

Load a Deezer track by URL, numeric track ID, or search query

No command-specific options.

### `album`

Usage:
```bash
mikacli music deezer album [options] <target>
```

Load a Deezer album by URL, numeric album ID, or search query

No command-specific options.

### `artist`

Usage:
```bash
mikacli music deezer artist [options] <target>
```

Aliases: `user`

Load a Deezer artist by URL, numeric artist ID, or search query

Options:

- `--limit <number>`: Maximum top tracks and releases to print (default: 10, max: 50)

### `playlist`

Usage:
```bash
mikacli music deezer playlist [options] <target>
```

Load a Deezer playlist by URL, numeric playlist ID, or search query

Options:

- `--limit <number>`: Maximum playlist tracks to print (default: 10, max: 50)

### `capabilities`

Usage:
```bash
mikacli music deezer capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
