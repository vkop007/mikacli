# Timezone

Generated from the real MikaCLI provider definition and command tree.

- Provider: `timezone`
- Category: `tools`
- Command prefix: `mikacli tools timezone`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Resolve timezone metadata from a place, coordinates, or an IANA timezone

## Notes

- none

## Fast Start

- `mikacli tools timezone Asia/Kolkata`
- `mikacli tools timezone "Mumbai"`
- `mikacli tools timezone 19.0760,72.8777`
- `mikacli tools timezone capabilities --json`

## Default Command

Usage:
```bash
mikacli tools timezone [options] [command] [target]
```

Options:

- `--lat <number>`: Latitude
- `--lon <number>`: Longitude
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
mikacli tools timezone capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
