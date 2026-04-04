# TMDb

Generated from the real AutoCLI provider definition and command tree.

- Provider: `tmdb`
- Category: `movie`
- Command prefix: `autocli movie tmdb`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public movie and TV titles through TMDb's live web catalog

## Notes

- none

## Fast Start

- `autocli movie tmdb search "inception"`
- `autocli movie tmdb title 27205`
- `autocli movie tmdb recommendations https://www.themoviedb.org/movie/27205-inception`
- `autocli movie tmdb capabilities --json`

## Default Command

Usage:
```bash
autocli movie tmdb [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli movie tmdb search [options] <query>
```

Search public TMDb movie and TV titles

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `title`

Usage:
```bash
autocli movie tmdb title [options] <target>
```

Aliases: `info`

Load a TMDb title by URL, numeric movie ID, or query

No command-specific options.

### `recommendations`

Usage:
```bash
autocli movie tmdb recommendations [options] <target>
```

Aliases: `recs`

Load TMDb recommendations for a title

Options:

- `--limit <number>`: Maximum recommendations to return (default: 5)

### `trending`

Usage:
```bash
autocli movie tmdb trending [options]
```

Load popular TMDb movies from the live catalog

Options:

- `--limit <number>`: Maximum titles to return (default: 5)

### `capabilities`

Usage:
```bash
autocli movie tmdb capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
