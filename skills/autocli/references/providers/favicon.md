# Favicon

Generated from the real AutoCLI provider definition and command tree.

- Provider: `favicon`
- Category: `tools`
- Command prefix: `autocli tools favicon`
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

- `autocli tools favicon https://example.com`
- `autocli tools favicon openai.com`
- `autocli tools favicon https://example.com --json`
- `autocli tools favicon capabilities --json`

## Default Command

Usage:
```bash
autocli tools favicon [options] [command] <target>
```

Options:

- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
autocli tools favicon capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
