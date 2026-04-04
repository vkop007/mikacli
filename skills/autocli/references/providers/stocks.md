# Stocks

Generated from the real AutoCLI provider definition and command tree.

- Provider: `stocks`
- Category: `finance`
- Command prefix: `autocli finance stocks`
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

- `autocli finance stocks AAPL`
- `autocli finance stocks TSLA`
- `autocli finance stocks RYCEY --market l`
- `autocli finance stocks capabilities --json`

## Default Command

Usage:
```bash
autocli finance stocks [options] [command] <symbol>
```

Options:

- `--market <code>`: Market suffix for symbols without an exchange suffix (default: us)


## Commands

### `capabilities`

Usage:
```bash
autocli finance stocks capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
