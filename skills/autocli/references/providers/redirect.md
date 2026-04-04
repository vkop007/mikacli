# Redirect

Generated from the real AutoCLI provider definition and command tree.

- Provider: `redirect`
- Category: `tools`
- Command prefix: `autocli tools redirect`
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

- `autocli tools redirect https://example.com`
- `autocli tools redirect github.com --method GET`
- `autocli tools redirect https://example.com --max-hops 5`
- `autocli tools redirect capabilities --json`

## Default Command

Usage:
```bash
autocli tools redirect [options] [command] <target>
```

Options:

- `--method <method>`: HTTP method to use: HEAD or GET
- `--timeout <ms>`: Request timeout in milliseconds
- `--max-hops <number>`: Maximum redirect hops to follow


## Commands

### `capabilities`

Usage:
```bash
autocli tools redirect capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
