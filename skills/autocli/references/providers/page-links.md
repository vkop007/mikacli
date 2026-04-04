# Page Links

Generated from the real AutoCLI provider definition and command tree.

- Provider: `page-links`
- Category: `tools`
- Command prefix: `autocli tools page-links`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Extract normalized internal and external links from a public webpage

## Notes

- none

## Fast Start

- `autocli tools page-links https://example.com`
- `autocli tools page-links openai.com --type external`
- `autocli tools page-links https://example.com --limit 20 --json`
- `autocli tools page-links capabilities --json`

## Default Command

Usage:
```bash
autocli tools page-links [options] [command] <target>
```

Options:

- `--type <type>`: Link type to return: all, internal, or external
- `--limit <number>`: Maximum links to return (default: 100)
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
autocli tools page-links capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
