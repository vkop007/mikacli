# QR

Generated from the real MikaCLI provider definition and command tree.

- Provider: `qr`
- Category: `tools`
- Command prefix: `mikacli tools qr`
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

- `mikacli tools qr encode "https://example.com"`
- `mikacli tools qr encode "https://example.com" --size 8 --margin 4`
- `mikacli tools qr decode ./qr-image.png --json`
- `mikacli tools qr capabilities --json`

## Default Command

Usage:
```bash
mikacli tools qr [options] [command] [text...]
```

Options:

- `--size <number>`: QR image size hint
- `--margin <number>`: QR image margin in modules
- `--url`: Print a public image URL too


## Commands

### `encode`

Usage:
```bash
mikacli tools qr encode [options] <text...>
```

Generate a QR code from text

Options:

- `--size <number>`: QR image size hint
- `--margin <number>`: QR image margin in modules
- `--url`: Print a public image URL too

### `decode`

Usage:
```bash
mikacli tools qr decode [options] <filePath>
```

Decode a QR code from an image file

No command-specific options.

### `capabilities`

Usage:
```bash
mikacli tools qr capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
