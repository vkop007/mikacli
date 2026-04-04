# AniList

Generated from the real AutoCLI provider definition and command tree.

- Provider: `anilist`
- Category: `movie`
- Command prefix: `autocli movie anilist`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search anime and inspect titles through AniList's public API

## Notes

- none

## Fast Start

- `autocli movie anilist search "frieren"`
- `autocli movie anilist trending --limit 10`
- `autocli movie anilist title 52991`
- `autocli movie anilist capabilities --json`

## Default Command

Usage:
```bash
autocli movie anilist [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli movie anilist search [options] <query>
```

Search AniList anime titles through the public GraphQL API

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `title`

Usage:
```bash
autocli movie anilist title [options] <target>
```

Aliases: `info`

Load an AniList anime by URL, anime ID, or query

No command-specific options.

### `recommendations`

Usage:
```bash
autocli movie anilist recommendations [options] <target>
```

Aliases: `recs`

Load AniList recommendations for an anime

Options:

- `--limit <number>`: Maximum recommendations to return (default: 5)

### `trending`

Usage:
```bash
autocli movie anilist trending [options]
```

Load trending anime titles through AniList's public GraphQL API

Options:

- `--limit <number>`: Maximum titles to return (default: 5)

### `capabilities`

Usage:
```bash
autocli movie anilist capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
