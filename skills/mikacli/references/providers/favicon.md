# Favicon

Generated from the real MikaCLI provider definition and command tree.

- Provider: `favicon`
- Category: `tools`
- Command prefix: `mikacli tools favicon`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Find and verify favicon candidates for a public webpage

## Notes

- none

## Fast Start

- `mikacli tools favicon https://example.com`
- `mikacli tools favicon openai.com`
- `mikacli tools favicon https://example.com --json`
- `mikacli tools favicon capabilities --json`

## Default Command

Usage:
```bash
mikacli tools favicon [options] [command] <target>
```

Options:

- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
mikacli tools favicon capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
