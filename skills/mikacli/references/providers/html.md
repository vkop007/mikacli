# HTML

Generated from the real MikaCLI provider definition and command tree.

- Provider: `html`
- Category: `data`
- Command prefix: `mikacli data html`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Transform HTML into plain text or Markdown

## Notes

- none

## Fast Start

- `mikacli data html text ./page.html`
- `mikacli data html to-markdown ./page.html --output ./page.md`
- `mikacli data html capabilities --json`

## Default Command

Usage:
```bash
mikacli data html [command]
```

No root-only options.


## Commands

### `text`

Usage:
```bash
mikacli data html text [options] <source>
```

Extract plain text from HTML

Options:

- `--output <path>`: Write the plain-text result to a file

### `to-markdown`

Usage:
```bash
mikacli data html to-markdown [options] <source>
```

Convert HTML into Markdown

Options:

- `--output <path>`: Write the Markdown result to a file

### `capabilities`

Usage:
```bash
mikacli data html capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
