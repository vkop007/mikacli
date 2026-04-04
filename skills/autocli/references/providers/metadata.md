# Metadata

Generated from the real AutoCLI provider definition and command tree.

- Provider: `metadata`
- Category: `tools`
- Command prefix: `autocli tools metadata`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Extract HTML metadata from a public webpage with no API key

## Notes

- none

## Fast Start

- `autocli tools metadata https://example.com`
- `autocli tools metadata openai.com`
- `autocli tools metadata https://example.com --json`
- `autocli tools metadata capabilities --json`

## Default Command

Usage:
```bash
autocli tools metadata [options] [command] <target>
```

Options:

- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
autocli tools metadata capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
