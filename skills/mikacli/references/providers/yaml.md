# YAML

Generated from the real MikaCLI provider definition and command tree.

- Provider: `yaml`
- Category: `data`
- Command prefix: `mikacli data yaml`
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

- `mikacli data yaml format ./config.yaml`
- `mikacli data yaml to-json ./config.yaml --output ./config.json`
- `mikacli data yaml capabilities --json`

## Default Command

Usage:
```bash
mikacli data yaml [command]
```

No root-only options.


## Commands

### `format`

Usage:
```bash
mikacli data yaml format [options] <source>
```

Format YAML from a file, raw string, or '-' stdin

Options:

- `--indent <spaces>`: Indent width from 1-8
- `--output <path>`: Write the formatted YAML to a file

### `to-json`

Usage:
```bash
mikacli data yaml to-json [options] <source>
```

Convert YAML into JSON

Options:

- `--indent <spaces>`: Indent width from 0-8
- `--output <path>`: Write the JSON output to a file

### `capabilities`

Usage:
```bash
mikacli data yaml capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
