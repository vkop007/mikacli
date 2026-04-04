# Bandcamp

Generated from the real AutoCLI provider definition and command tree.

- Provider: `bandcamp`
- Category: `music`
- Command prefix: `autocli music bandcamp`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `partial`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Bandcamp artists, albums, and tracks through Bandcamp's live search and readable pages

## Notes

- none

## Fast Start

- `autocli music bandcamp search "radiohead"`
- `autocli music bandcamp search "radiohead" --type album`
- `autocli music bandcamp album https://radiohead.bandcamp.com/album/in-rainbows`
- `autocli music bandcamp capabilities --json`

## Default Command

Usage:
```bash
autocli music bandcamp [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli music bandcamp search [options] <query>
```

Search public Bandcamp artists, albums, tracks, or all result types

Options:

- `--type <kind>`: Result type: artist, album, track, or all (default: all)
- `--limit <number>`: Maximum number of results to return (default: 5, max: 25)

### `album`

Usage:
```bash
autocli music bandcamp album [options] <target>
```

Load a Bandcamp album by URL or search query

No command-specific options.

### `track`

Usage:
```bash
autocli music bandcamp track [options] <target>
```

Aliases: `info`

Load a Bandcamp track by URL or search query

No command-specific options.

### `artist`

Usage:
```bash
autocli music bandcamp artist [options] <target>
```

Aliases: `user`

Load a Bandcamp artist by URL or search query

Options:

- `--limit <number>`: Maximum artist releases to print (default: 10, max: 50)

### `capabilities`

Usage:
```bash
autocli music bandcamp capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
