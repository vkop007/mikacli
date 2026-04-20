# ZipRecruiter

Generated from the real MikaCLI provider definition and command tree.

- Provider: `ziprecruiter`
- Category: `careers`
- Command prefix: `mikacli careers ziprecruiter`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search and browse job listings from ZipRecruiter, America's largest job marketplace

## Notes

- none

## Fast Start

- `mikacli careers ziprecruiter search "software engineer"`
- `mikacli careers ziprecruiter search "product manager" --location "Austin"`
- `mikacli careers ziprecruiter search "marketing manager" --limit 15`
- `mikacli careers ziprecruiter capabilities --json`

## Default Command

Usage:
```bash
mikacli careers ziprecruiter [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
mikacli careers ziprecruiter search [options] <query>
```

Search for jobs on ZipRecruiter

Options:

- `--location <location>`: Filter jobs by location (e.g., 'San Francisco', 'New York')
- `--limit <number>`: Maximum number of results to return (1-50, default: 10)
- `--job-type <type>`: Filter by job type (full-time, part-time, contract, temporary)

### `capabilities`

Usage:
```bash
mikacli careers ziprecruiter capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
