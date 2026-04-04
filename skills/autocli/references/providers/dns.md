# DNS

Generated from the real AutoCLI provider definition and command tree.

- Provider: `dns`
- Category: `tools`
- Command prefix: `autocli tools dns`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Resolve DNS records from public DNS-over-HTTPS endpoints without any account setup

## Notes

- none

## Fast Start

- `autocli tools dns openai.com`
- `autocli tools dns openai.com --type MX`
- `autocli tools dns capabilities --json`

## Default Command

Usage:
```bash
autocli tools dns [options] [command] <name>
```

Options:

- `--type <value>`: DNS record type (A, AAAA, MX, TXT, CNAME, etc.)


## Commands

### `capabilities`

Usage:
```bash
autocli tools dns capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
