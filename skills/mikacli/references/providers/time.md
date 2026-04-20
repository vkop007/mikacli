# Time

Generated from the real MikaCLI provider definition and command tree.

- Provider: `time`
- Category: `tools`
- Command prefix: `mikacli tools time`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Get local date/time info from worldtimeapi.org by IP or timezone

## Notes

- none

## Fast Start

- `mikacli tools time`
- `mikacli tools time Asia/Kolkata`
- `mikacli tools time America/New_York`
- `mikacli tools time capabilities --json`

## Default Command

Usage:
```bash
mikacli tools time [command] [timezone]
```

No root-only options.


## Commands

### `capabilities`

Usage:
```bash
mikacli tools time capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
