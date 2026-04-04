# IMDb

Generated from the real AutoCLI provider definition and command tree.

- Provider: `imdb`
- Category: `movie`
- Command prefix: `autocli movie imdb`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search IMDb titles from the terminal using the public suggestion feed

## Notes

- none

## Fast Start

- `autocli movie imdb search "inception"`
- `autocli movie imdb title tt1375666`
- `autocli movie imdb info https://www.imdb.com/title/tt1375666/`
- `autocli movie imdb capabilities --json`

## Default Command

Usage:
```bash
autocli movie imdb [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli movie imdb search [options] <query>
```

Search IMDb titles through the public suggestion feed

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `title`

Usage:
```bash
autocli movie imdb title [options] <target>
```

Aliases: `info`

Load an IMDb title by URL, title ID, or query

No command-specific options.

### `capabilities`

Usage:
```bash
autocli movie imdb capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
