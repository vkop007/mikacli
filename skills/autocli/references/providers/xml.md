# XML

Generated from the real AutoCLI provider definition and command tree.

- Provider: `xml`
- Category: `data`
- Command prefix: `autocli data xml`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Format XML and convert it to JSON

## Notes

- none

## Fast Start

- `autocli data xml format ./feed.xml`
- `autocli data xml to-json ./feed.xml --output ./feed.json`
- `autocli data xml capabilities --json`

## Default Command

Usage:
```bash
autocli data xml [command]
```

No root-only options.


## Commands

### `format`

Usage:
```bash
autocli data xml format [options] <source>
```

Format XML from a file, raw string, or '-' stdin

Options:

- `--indent <spaces>`: Indent width from 1-8
- `--output <path>`: Write the formatted XML to a file

### `to-json`

Usage:
```bash
autocli data xml to-json [options] <source>
```

Convert XML into JSON

Options:

- `--indent <spaces>`: Indent width from 0-8
- `--output <path>`: Write the JSON output to a file

### `capabilities`

Usage:
```bash
autocli data xml capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
