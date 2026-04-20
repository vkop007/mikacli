# DNS

Generated from the real MikaCLI provider definition and command tree.

- Provider: `dns`
- Category: `tools`
- Command prefix: `mikacli tools dns`
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

- `mikacli tools dns openai.com`
- `mikacli tools dns openai.com --type MX`
- `mikacli tools dns capabilities --json`

## Default Command

Usage:
```bash
mikacli tools dns [options] [command] <name>
```

Options:

- `--type <value>`: DNS record type (A, AAAA, MX, TXT, CNAME, etc.)


## Commands

### `capabilities`

Usage:
```bash
mikacli tools dns capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
