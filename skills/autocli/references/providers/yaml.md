# YAML

Generated from the real AutoCLI provider definition and command tree.

- Provider: `yaml`
- Category: `data`
- Command prefix: `autocli data yaml`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Format YAML and convert it to JSON

## Notes

- none

## Fast Start

- `autocli data yaml format ./config.yaml`
- `autocli data yaml to-json ./config.yaml --output ./config.json`
- `autocli data yaml capabilities --json`

## Default Command

Usage:
```bash
autocli data yaml [command]
```

No root-only options.


## Commands

### `format`

Usage:
```bash
autocli data yaml format [options] <source>
```

Format YAML from a file, raw string, or '-' stdin

Options:

- `--indent <spaces>`: Indent width from 1-8
- `--output <path>`: Write the formatted YAML to a file

### `to-json`

Usage:
```bash
autocli data yaml to-json [options] <source>
```

Convert YAML into JSON

Options:

- `--indent <spaces>`: Indent width from 0-8
- `--output <path>`: Write the JSON output to a file

### `capabilities`

Usage:
```bash
autocli data yaml capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
