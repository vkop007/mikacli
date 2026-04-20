# Uptime

Generated from the real MikaCLI provider definition and command tree.

- Provider: `uptime`
- Category: `tools`
- Command prefix: `mikacli tools uptime`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Check whether a website is reachable and how quickly it responds

## Notes

- none

## Fast Start

- `mikacli tools uptime https://example.com`
- `mikacli tools uptime openai.com`
- `mikacli tools uptime https://example.com --method GET --timeout 15000`
- `mikacli tools uptime capabilities --json`

## Default Command

Usage:
```bash
mikacli tools uptime [options] [command] <target>
```

Options:

- `--method <method>`: HTTP method to use: HEAD or GET
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
mikacli tools uptime capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
