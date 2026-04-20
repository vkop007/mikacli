# Letterboxd

Generated from the real MikaCLI provider definition and command tree.

- Provider: `letterboxd`
- Category: `movie`
- Command prefix: `mikacli movie letterboxd`
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

- `mikacli movie letterboxd search "inception"`
- `mikacli movie letterboxd title https://letterboxd.com/film/inception/`
- `mikacli movie letterboxd profile darrencb`
- `mikacli movie letterboxd capabilities --json`

## Default Command

Usage:
```bash
mikacli movie letterboxd [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
mikacli movie letterboxd search [options] <query>
```

Search public Letterboxd film pages by query

Options:

- `--limit <number>`: Maximum number of results to return (default: 5)

### `title`

Usage:
```bash
mikacli movie letterboxd title [options] <target>
```

Aliases: `info`

Load a Letterboxd film by URL or search query

No command-specific options.

### `profile`

Usage:
```bash
mikacli movie letterboxd profile [options] <target>
```

Aliases: `user`

Load a public Letterboxd profile by URL or username

No command-specific options.

### `diary`

Usage:
```bash
mikacli movie letterboxd diary [options] <target>
```

Aliases: `feed`

Load recent diary entries from a public Letterboxd profile

Options:

- `--limit <number>`: Maximum diary entries to return (default: 5)

### `capabilities`

Usage:
```bash
mikacli movie letterboxd capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
