# Currency

Generated from the real MikaCLI provider definition and command tree.

- Provider: `currency`
- Category: `finance`
- Command prefix: `mikacli finance currency`
- Aliases: `forex`
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Convert currencies and forex pairs from the terminal using a no-key public endpoint

## Notes

- none

## Fast Start

- `mikacli finance currency 100 USD INR`
- `mikacli finance forex 100 USD INR`
- `mikacli finance currency 100 USD EUR GBP`
- `mikacli finance currency capabilities --json`

## Default Command

Usage:
```bash
mikacli finance currency [command] <amount> <from> <to...>
```

No root-only options.


## Commands

### `capabilities`

Usage:
```bash
mikacli finance currency capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
