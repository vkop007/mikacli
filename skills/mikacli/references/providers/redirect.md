# Redirect

Generated from the real MikaCLI provider definition and command tree.

- Provider: `redirect`
- Category: `tools`
- Command prefix: `mikacli tools redirect`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Trace public HTTP redirect chains without any API key

## Notes

- none

## Fast Start

- `mikacli tools redirect https://example.com`
- `mikacli tools redirect github.com --method GET`
- `mikacli tools redirect https://example.com --max-hops 5`
- `mikacli tools redirect capabilities --json`

## Default Command

Usage:
```bash
mikacli tools redirect [options] [command] <target>
```

Options:

- `--method <method>`: HTTP method to use: HEAD or GET
- `--timeout <ms>`: Request timeout in milliseconds
- `--max-hops <number>`: Maximum redirect hops to follow


## Commands

### `capabilities`

Usage:
```bash
mikacli tools redirect capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
