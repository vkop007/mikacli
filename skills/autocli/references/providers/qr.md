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

Generate QR codes and decode QR images without any account setup

## Notes

- none

## Fast Start

- `autocli tools qr encode "https://example.com"`
- `autocli tools qr encode "https://example.com" --size 8 --margin 4`
- `autocli tools qr decode ./qr-image.png --json`
- `autocli tools qr capabilities --json`

## Default Command

Usage:
```bash
autocli tools qr [options] [command] [text...]
```

Options:

- `--size <number>`: QR image size hint
- `--margin <number>`: QR image margin in modules
- `--url`: Print a public image URL too


## Commands

### `encode`

Usage:
```bash
autocli tools qr encode [options] <text...>
```

Generate a QR code from text

Options:

- `--size <number>`: QR image size hint
- `--margin <number>`: QR image margin in modules
- `--url`: Print a public image URL too

### `decode`

Usage:
```bash
autocli tools qr decode [options] <filePath>
```

Decode a QR code from an image file

No command-specific options.

### `capabilities`

Usage:
```bash
autocli tools qr capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
