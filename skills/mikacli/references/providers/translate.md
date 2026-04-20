# Translate

Generated from the real MikaCLI provider definition and command tree.

- Provider: `translate`
- Category: `tools`
- Command prefix: `mikacli tools translate`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Translate text from the terminal using a no-key public endpoint

## Notes

- none

## Fast Start

- `mikacli tools translate "hello world"`
- `mikacli tools translate "hello world" --to hi`
- `mikacli tools translate "good morning" --from en --to es`
- `mikacli tools translate capabilities --json`

## Default Command

Usage:
```bash
mikacli tools translate [options] [command] <text...>
```

Options:

- `--from <lang>`: Source language code or auto/detect
- `--to <lang>`: Target language code


## Commands

### `capabilities`

Usage:
```bash
mikacli tools translate capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
