# QR

Generated from the real AutoCLI provider definition and command tree.

- Provider: `qr`
- Category: `tools`
- Command prefix: `autocli tools qr`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Generate shareable QR codes without any account setup

## Notes

- none

## Fast Start

- `autocli tools qr "https://example.com"`
- `autocli tools qr "https://example.com" --size 8 --margin 4`
- `autocli tools qr "hello world" --url`
- `autocli tools qr capabilities --json`

## Default Command

Usage:
```bash
autocli tools qr [options] [command] <text...>
```

Options:

- `--size <number>`: QR image size hint
- `--margin <number>`: QR image margin in modules
- `--url`: Print a public image URL too


## Commands

### `capabilities`

Usage:
```bash
autocli tools qr capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
