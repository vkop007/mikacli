# Kitsu

Generated from the real AutoCLI provider definition and command tree.

- Provider: `kitsu`
- Category: `movie`
- Command prefix: `autocli movie kitsu`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search anime and inspect titles through Kitsu's public API

## Notes

- none

## Fast Start

- `autocli movie kitsu search "naruto"`
- `autocli movie kitsu title 1555`
- `autocli movie kitsu info https://kitsu.io/anime/naruto-shippuden`
- `autocli movie kitsu capabilities --json`

## Default Command

Usage:
```bash
autocli movie kitsu [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli movie kitsu search [options] <query>
```

Search Kitsu anime titles through the public JSON:API endpoint

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `title`

Usage:
```bash
autocli movie kitsu title [options] <target>
```

Aliases: `info`

Load a Kitsu anime by URL, anime ID, or query

No command-specific options.

### `capabilities`

Usage:
```bash
autocli movie kitsu capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
