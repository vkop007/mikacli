# MyAnimeList

Generated from the real AutoCLI provider definition and command tree.

- Provider: `myanimelist`
- Category: `movie`
- Command prefix: `autocli movie myanimelist`
- Aliases: none
- Auth: `cookies`, `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search anime, inspect titles, and load anime lists using MyAnimeList

## Notes

- none

## Fast Start

- `autocli movie myanimelist login`
- `autocli movie myanimelist search "naruto"`
- `autocli movie myanimelist title 20`
- `autocli movie myanimelist capabilities --json`

## Default Command

Usage:
```bash
autocli movie myanimelist [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli movie myanimelist login [options]
```

Save the MyAnimeList session for future CLI use. With no auth flags, AutoCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `status`

Usage:
```bash
autocli movie myanimelist status [options]
```

Show the saved MyAnimeList session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `search`

Usage:
```bash
autocli movie myanimelist search [options] <query>
```

Search MyAnimeList titles

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `title`

Usage:
```bash
autocli movie myanimelist title [options] <target>
```

Aliases: `info`

Load MyAnimeList details by URL, ID, or query

Options:

- `--account <name>`: Optional saved session name to use

### `list`

Usage:
```bash
autocli movie myanimelist list [options] [username]
```

Aliases: `watchlist`, `animelist`

Load a MyAnimeList list

Options:

- `--account <name>`: Optional saved session name to use
- `--status <value>`: Optional list status filter
- `--limit <number>`: Maximum items to return (default: 25)

### `capabilities`

Usage:
```bash
autocli movie myanimelist capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
