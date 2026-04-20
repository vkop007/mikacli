# Weather

Generated from the real MikaCLI provider definition and command tree.

- Provider: `weather`
- Category: `tools`
- Command prefix: `mikacli tools weather`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Get weather conditions and forecasts from wttr.in without any account setup

## Notes

- none

## Fast Start

- `mikacli tools weather`
- `mikacli tools weather London`
- `mikacli tools weather "San Francisco" --days 3`
- `mikacli tools weather capabilities --json`

## Default Command

Usage:
```bash
mikacli tools weather [options] [command] [location]
```

Options:

- `--days <number>`: Forecast days to include (1-3, default: 1)
- `--lang <code>`: Response language code, for example en, es, fr, hi


## Commands

### `capabilities`

Usage:
```bash
mikacli tools weather capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
