# IP

Generated from the real AutoCLI provider definition and command tree.

- Provider: `ip`
- Category: `tools`
- Command prefix: `autocli tools ip`
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

- `autocli tools ip`
- `autocli tools ip --version 4`
- `autocli tools ip --version 6`
- `autocli tools ip capabilities --json`

## Default Command

Usage:
```bash
autocli tools ip [options] [command]
```

Options:

- `--version <value>`: IP version preference: 4, 6, any (default: any)
- `--details`: Include country/city/org details when available


## Commands

### `capabilities`

Usage:
```bash
autocli tools ip capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
