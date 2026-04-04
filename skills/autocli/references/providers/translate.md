# Translate

Generated from the real AutoCLI provider definition and command tree.

- Provider: `translate`
- Category: `tools`
- Command prefix: `autocli tools translate`
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

- `autocli tools translate "hello world"`
- `autocli tools translate "hello world" --to hi`
- `autocli tools translate "good morning" --from en --to es`
- `autocli tools translate capabilities --json`

## Default Command

Usage:
```bash
autocli tools translate [options] [command] <text...>
```

Options:

- `--from <lang>`: Source language code or auto/detect
- `--to <lang>`: Target language code


## Commands

### `capabilities`

Usage:
```bash
autocli tools translate capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
