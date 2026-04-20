# Headers

Generated from the real MikaCLI provider definition and command tree.

- Provider: `headers`
- Category: `tools`
- Command prefix: `mikacli tools headers`
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

- `mikacli tools headers https://example.com`
- `mikacli tools headers openai.com --method GET`
- `mikacli tools headers https://example.com --json`
- `mikacli tools headers capabilities --json`

## Default Command

Usage:
```bash
mikacli tools headers [options] [command] <target>
```

Options:

- `--method <method>`: HTTP method to use: HEAD or GET
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
mikacli tools headers capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
