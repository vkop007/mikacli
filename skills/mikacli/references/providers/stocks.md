# Stocks

Generated from the real MikaCLI provider definition and command tree.

- Provider: `stocks`
- Category: `finance`
- Command prefix: `mikacli finance stocks`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Load stock quotes from the public Stooq endpoint without any account setup

## Notes

- none

## Fast Start

- `mikacli finance stocks AAPL`
- `mikacli finance stocks TSLA`
- `mikacli finance stocks RYCEY --market l`
- `mikacli finance stocks capabilities --json`

## Default Command

Usage:
```bash
mikacli finance stocks [options] [command] <symbol>
```

Options:

- `--market <code>`: Market suffix for symbols without an exchange suffix (default: us)


## Commands

### `capabilities`

Usage:
```bash
mikacli finance stocks capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
