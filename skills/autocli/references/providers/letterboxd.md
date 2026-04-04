# Letterboxd

Generated from the real AutoCLI provider definition and command tree.

- Provider: `letterboxd`
- Category: `movie`
- Command prefix: `autocli movie letterboxd`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Letterboxd films and inspect film, profile, and diary data from readable pages and RSS

## Notes

- none

## Fast Start

- `autocli movie letterboxd search "inception"`
- `autocli movie letterboxd title https://letterboxd.com/film/inception/`
- `autocli movie letterboxd profile darrencb`
- `autocli movie letterboxd capabilities --json`

## Default Command

Usage:
```bash
autocli movie letterboxd [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli movie letterboxd search [options] <query>
```

Search public Letterboxd film pages by query

Options:

- `--limit <number>`: Maximum number of results to return (default: 5)

### `title`

Usage:
```bash
autocli movie letterboxd title [options] <target>
```

Aliases: `info`

Load a Letterboxd film by URL or search query

No command-specific options.

### `profile`

Usage:
```bash
autocli movie letterboxd profile [options] <target>
```

Aliases: `user`

Load a public Letterboxd profile by URL or username

No command-specific options.

### `diary`

Usage:
```bash
autocli movie letterboxd diary [options] <target>
```

Aliases: `feed`

Load recent diary entries from a public Letterboxd profile

Options:

- `--limit <number>`: Maximum diary entries to return (default: 5)

### `capabilities`

Usage:
```bash
autocli movie letterboxd capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
