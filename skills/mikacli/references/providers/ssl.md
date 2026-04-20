# SSL

Generated from the real MikaCLI provider definition and command tree.

- Provider: `ssl`
- Category: `tools`
- Command prefix: `mikacli tools ssl`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect TLS certificate and protocol details without any API key

## Notes

- none

## Fast Start

- `mikacli tools ssl https://example.com`
- `mikacli tools ssl openai.com`
- `mikacli tools ssl https://example.com --json`
- `mikacli tools ssl capabilities --json`

## Default Command

Usage:
```bash
mikacli tools ssl [options] [command] <target>
```

Options:

- `--timeout <ms>`: TLS connection timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
mikacli tools ssl capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
