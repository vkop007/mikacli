# Whois

Generated from the real MikaCLI provider definition and command tree.

- Provider: `whois`
- Category: `tools`
- Command prefix: `mikacli tools whois`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Load WHOIS / RDAP data from public no-key endpoints

## Notes

- none

## Fast Start

- `mikacli tools whois openai.com`
- `mikacli tools whois 8.8.8.8`
- `mikacli tools whois capabilities --json`

## Default Command

Usage:
```bash
mikacli tools whois [command] <target>
```

No root-only options.


## Commands

### `capabilities`

Usage:
```bash
mikacli tools whois capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
