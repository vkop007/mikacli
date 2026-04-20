# CSV

Generated from the real MikaCLI provider definition and command tree.

- Provider: `csv`
- Category: `data`
- Command prefix: `mikacli data csv`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect, filter, and convert CSV without leaving the terminal

## Notes

- none

## Fast Start

- `mikacli data csv info ./users.csv`
- `mikacli data csv to-json ./orders.csv --output ./orders.json`
- `mikacli data csv filter ./orders.csv --where 'status=paid'`
- `mikacli data csv capabilities --json`

## Default Command

Usage:
```bash
mikacli data csv [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
mikacli data csv info [options] <source>
```

Inspect CSV columns, row count, and a small preview

No command-specific options.

### `to-json`

Usage:
```bash
mikacli data csv to-json [options] <source>
```

Convert CSV into a JSON array

Options:

- `--indent <spaces>`: Indent width from 0-8
- `--output <path>`: Write the JSON output to a file

### `filter`

Usage:
```bash
mikacli data csv filter [options] <source>
```

Filter CSV rows with expressions like status=done or amount>10

Options:

- `--where <expression>`: Filter expression like status=paid or amount>100
- `--as <format>`: Output format: csv or json
- `--output <path>`: Write the filtered result to a file

### `capabilities`

Usage:
```bash
mikacli data csv capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
