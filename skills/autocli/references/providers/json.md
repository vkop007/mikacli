# JSON

Generated from the real AutoCLI provider definition and command tree.

- Provider: `json`
- Category: `data`
- Command prefix: `autocli data json`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Format, query, and merge JSON without leaving the terminal

## Notes

- none

## Fast Start

- `autocli data json format ./payload.json`
- `autocli data json query ./payload.json data.items[0].title`
- `autocli data json merge ./base.json ./override.json --sort-keys`
- `autocli data json capabilities --json`

## Default Command

Usage:
```bash
autocli data json [command]
```

No root-only options.


## Commands

### `format`

Usage:
```bash
autocli data json format [options] <source>
```

Format JSON from a file, raw string, or '-' stdin

Options:

- `--indent <spaces>`: Indent width from 0-8
- `--sort-keys`: Sort object keys recursively
- `--output <path>`: Write the formatted result to a file

### `query`

Usage:
```bash
autocli data json query [options] <source> <path>
```

Resolve a JSON path like data.items[0].title

Options:

- `--output <path>`: Write the resolved value to a file

### `merge`

Usage:
```bash
autocli data json merge [options] <sources...>
```

Merge multiple JSON documents deeply; later inputs override earlier keys

Options:

- `--indent <spaces>`: Indent width from 0-8
- `--sort-keys`: Sort object keys recursively
- `--output <path>`: Write the merged result to a file

### `capabilities`

Usage:
```bash
autocli data json capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
