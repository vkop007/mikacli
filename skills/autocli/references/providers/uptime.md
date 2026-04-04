# Uptime

Generated from the real AutoCLI provider definition and command tree.

- Provider: `uptime`
- Category: `tools`
- Command prefix: `autocli tools uptime`
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

- `autocli tools uptime https://example.com`
- `autocli tools uptime openai.com`
- `autocli tools uptime https://example.com --method GET --timeout 15000`
- `autocli tools uptime capabilities --json`

## Default Command

Usage:
```bash
autocli tools uptime [options] [command] <target>
```

Options:

- `--method <method>`: HTTP method to use: HEAD or GET
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
autocli tools uptime capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
