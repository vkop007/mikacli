# Indeed

Generated from the real AutoCLI provider definition and command tree.

- Provider: `indeed`
- Category: `careers`
- Command prefix: `autocli careers indeed`
- Aliases: none
- Auth: `none`
- Stability: `unknown`
- Discovery: `unknown`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search job listings on Indeed, the world's largest job board

## Notes

- none

## Fast Start

- `autocli careers indeed search "software engineer"`
- `autocli careers indeed search "data scientist" --location "New York"`
- `autocli careers indeed search "frontend developer" --limit 10`
- `autocli careers indeed capabilities --json`

## Default Command

Usage:
```bash
autocli careers indeed [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli careers indeed search [options] <query>
```

Search for jobs on Indeed

Options:

- `--location <location>`: Filter jobs by location (e.g., 'San Francisco', 'New York')
- `--limit <number>`: Maximum number of results to return (1-50, default: 10)
- `--job-type <type>`: Filter by job type (full-time, part-time, contract, temporary)

### `capabilities`

Usage:
```bash
autocli careers indeed capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
