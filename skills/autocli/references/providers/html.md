# HTML

Generated from the real AutoCLI provider definition and command tree.

- Provider: `html`
- Category: `data`
- Command prefix: `autocli data html`
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

- `autocli data html text ./page.html`
- `autocli data html to-markdown ./page.html --output ./page.md`
- `autocli data html capabilities --json`

## Default Command

Usage:
```bash
autocli data html [command]
```

No root-only options.


## Commands

### `text`

Usage:
```bash
autocli data html text [options] <source>
```

Extract plain text from HTML

Options:

- `--output <path>`: Write the plain-text result to a file

### `to-markdown`

Usage:
```bash
autocli data html to-markdown [options] <source>
```

Convert HTML into Markdown

Options:

- `--output <path>`: Write the Markdown result to a file

### `capabilities`

Usage:
```bash
autocli data html capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
