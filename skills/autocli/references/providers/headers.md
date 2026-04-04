# Headers

Generated from the real AutoCLI provider definition and command tree.

- Provider: `headers`
- Category: `tools`
- Command prefix: `autocli tools headers`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect HTTP response headers without any API key

## Notes

- none

## Fast Start

- `autocli tools headers https://example.com`
- `autocli tools headers openai.com --method GET`
- `autocli tools headers https://example.com --json`
- `autocli tools headers capabilities --json`

## Default Command

Usage:
```bash
autocli tools headers [options] [command] <target>
```

Options:

- `--method <method>`: HTTP method to use: HEAD or GET
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
autocli tools headers capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
