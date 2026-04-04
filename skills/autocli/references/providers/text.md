# Text

Generated from the real AutoCLI provider definition and command tree.

- Provider: `text`
- Category: `data`
- Command prefix: `autocli data text`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Analyze and transform plain text

## Notes

- none

## Fast Start

- `autocli data text stats ./notes.txt`
- `autocli data text replace ./notes.txt --find draft --replace final`
- `autocli data text dedupe-lines ./list.txt --output ./list.cleaned.txt`
- `autocli data text capabilities --json`

## Default Command

Usage:
```bash
autocli data text [command]
```

No root-only options.


## Commands

### `stats`

Usage:
```bash
autocli data text stats [options] <source>
```

Count characters, words, and lines

No command-specific options.

### `replace`

Usage:
```bash
autocli data text replace [options] <source>
```

Replace text or regex matches

Options:

- `--find <value>`: Text or regex pattern to replace
- `--replace <value>`: Replacement text
- `--regex`: Treat --find as a regular expression
- `--flags <value>`: Regex flags, defaults to g
- `--output <path>`: Write the result to a file

### `dedupe-lines`

Usage:
```bash
autocli data text dedupe-lines [options] <source>
```

Remove duplicate lines while preserving the first occurrence

Options:

- `--ignore-case`: Treat lines with different case as duplicates
- `--output <path>`: Write the cleaned text to a file

### `capabilities`

Usage:
```bash
autocli data text capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
