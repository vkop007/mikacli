# JustWatch

Generated from the real MikaCLI provider definition and command tree.

- Provider: `justwatch`
- Category: `movie`
- Command prefix: `mikacli movie justwatch`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Track where movies and shows are streaming with JustWatch's public pages

## Notes

- none

## Fast Start

- `mikacli movie justwatch title https://www.justwatch.com/us/movie/inception`
- `mikacli movie justwatch availability /us/movie/inception`
- `mikacli movie justwatch trending --country US --type movie`
- `mikacli movie justwatch capabilities --json`

## Default Command

Usage:
```bash
mikacli movie justwatch [command]
```

No root-only options.


## Commands

### `title`

Usage:
```bash
mikacli movie justwatch title [options] <target>
```

Aliases: `info`

Load a JustWatch title by URL or slug

Options:

- `--country <code>`: 2-letter country code when using a short slug like movie/inception
- `--type <movie|show>`: Optional type hint when using a short slug

### `availability`

Usage:
```bash
mikacli movie justwatch availability [options] <target>
```

Aliases: `where-to-watch`

Load streaming, rental, and purchase offers for a JustWatch title

Options:

- `--country <code>`: 2-letter country code when using a short slug like movie/inception
- `--type <movie|show>`: Optional type hint when using a short slug
- `--limit <number>`: Maximum offers to return (default: 12)

### `trending`

Usage:
```bash
mikacli movie justwatch trending [options]
```

Load trending JustWatch titles for a country and type

Options:

- `--country <code>`: 2-letter country code (default: US)
- `--type <movie|show>`: Title type to load (default: movie)
- `--limit <number>`: Maximum titles to return (default: 10)

### `new`

Usage:
```bash
mikacli movie justwatch new [options]
```

Aliases: `latest`, `recent`

Load newly added JustWatch titles for a country

Options:

- `--country <code>`: 2-letter country code (default: US)
- `--type <movie|show|all>`: Title type to keep (default: all)
- `--limit <number>`: Maximum titles to return (default: 10)

### `capabilities`

Usage:
```bash
mikacli movie justwatch capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
