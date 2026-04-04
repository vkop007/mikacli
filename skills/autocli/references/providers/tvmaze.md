# TVMaze

Generated from the real AutoCLI provider definition and command tree.

- Provider: `tvmaze`
- Category: `movie`
- Command prefix: `autocli movie tvmaze`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public TV and anime titles through TVMaze

## Notes

- none

## Fast Start

- `autocli movie tvmaze search "naruto"`
- `autocli movie tvmaze title 82`
- `autocli movie tvmaze episodes 82 --season 1`
- `autocli movie tvmaze capabilities --json`

## Default Command

Usage:
```bash
autocli movie tvmaze [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli movie tvmaze search [options] <query>
```

Search public TVMaze titles

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `title`

Usage:
```bash
autocli movie tvmaze title [options] <target>
```

Aliases: `info`

Load a TVMaze title by URL, show ID, or query

No command-specific options.

### `episodes`

Usage:
```bash
autocli movie tvmaze episodes [options] <target>
```

Aliases: `season`

Load TVMaze episode details for a show

Options:

- `--season <number>`: Optional season number to filter
- `--limit <number>`: Maximum episodes to return

### `capabilities`

Usage:
```bash
autocli movie tvmaze capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
