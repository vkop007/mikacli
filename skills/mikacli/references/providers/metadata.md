# Metadata

Generated from the real MikaCLI provider definition and command tree.

- Provider: `metadata`
- Category: `tools`
- Command prefix: `mikacli tools metadata`
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

- `mikacli tools metadata https://example.com`
- `mikacli tools metadata openai.com`
- `mikacli tools metadata https://example.com --json`
- `mikacli tools metadata capabilities --json`

## Default Command

Usage:
```bash
mikacli tools metadata [options] [command] <target>
```

Options:

- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
mikacli tools metadata capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
