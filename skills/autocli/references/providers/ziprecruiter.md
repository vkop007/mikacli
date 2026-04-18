# ZipRecruiter

Generated from the real AutoCLI provider definition and command tree.

- Provider: `ziprecruiter`
- Category: `careers`
- Command prefix: `autocli careers ziprecruiter`
- Aliases: none
- Auth: `none`
- Stability: `unknown`
- Discovery: `unknown`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search and browse job listings from ZipRecruiter, America's largest job marketplace

## Notes

- none

## Fast Start

- `autocli careers ziprecruiter search "software engineer"`
- `autocli careers ziprecruiter search "product manager" --location "Austin"`
- `autocli careers ziprecruiter search "marketing manager" --limit 15`
- `autocli careers ziprecruiter capabilities --json`

## Default Command

Usage:
```bash
autocli careers ziprecruiter [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli careers ziprecruiter search [options] <query>
```

Search for jobs on ZipRecruiter

Options:

- `--location <location>`: Filter jobs by location (e.g., 'San Francisco', 'New York')
- `--limit <number>`: Maximum number of results to return (1-50, default: 10)
- `--job-type <type>`: Filter by job type (full-time, part-time, contract, temporary)

### `capabilities`

Usage:
```bash
autocli careers ziprecruiter capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
