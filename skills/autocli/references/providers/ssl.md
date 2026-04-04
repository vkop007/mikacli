# SSL

Generated from the real AutoCLI provider definition and command tree.

- Provider: `ssl`
- Category: `tools`
- Command prefix: `autocli tools ssl`
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

- `autocli tools ssl https://example.com`
- `autocli tools ssl openai.com`
- `autocli tools ssl https://example.com --json`
- `autocli tools ssl capabilities --json`

## Default Command

Usage:
```bash
autocli tools ssl [options] [command] <target>
```

Options:

- `--timeout <ms>`: TLS connection timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
autocli tools ssl capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
