# Markdown

Generated from the real MikaCLI provider definition and command tree.

- Provider: `markdown`
- Category: `data`
- Command prefix: `mikacli data markdown`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Transform Markdown into HTML or plain text

## Notes

- none

## Fast Start

- `mikacli data markdown to-html ./notes.md`
- `mikacli data markdown text ./notes.md --output ./notes.txt`
- `mikacli data markdown capabilities --json`

## Default Command

Usage:
```bash
mikacli data markdown [command]
```

No root-only options.


## Commands

### `to-html`

Usage:
```bash
mikacli data markdown to-html [options] <source>
```

Convert Markdown into HTML

Options:

- `--output <path>`: Write the HTML result to a file

### `text`

Usage:
```bash
mikacli data markdown text [options] <source>
```

Convert Markdown into plain text

Options:

- `--output <path>`: Write the plain-text result to a file

### `capabilities`

Usage:
```bash
mikacli data markdown capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
