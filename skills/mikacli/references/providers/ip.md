# IP

Generated from the real MikaCLI provider definition and command tree.

- Provider: `ip`
- Category: `tools`
- Command prefix: `mikacli tools ip`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Resolve your public IP address and optional location/network details

## Notes

- none

## Fast Start

- `mikacli tools ip`
- `mikacli tools ip --version 4`
- `mikacli tools ip --version 6`
- `mikacli tools ip capabilities --json`

## Default Command

Usage:
```bash
mikacli tools ip [options] [command]
```

Options:

- `--version <value>`: IP version preference: 4, 6, any (default: any)
- `--details`: Include country/city/org details when available


## Commands

### `capabilities`

Usage:
```bash
mikacli tools ip capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
