# Cheat

Generated from the real MikaCLI provider definition and command tree.

- Provider: `cheat`
- Category: `tools`
- Command prefix: `mikacli tools cheat`
- Aliases: `cht`
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Look up quick cheat sheet snippets from cht.sh without any account setup

## Notes

- none

## Fast Start

- `mikacli tools cheat git status`
- `mikacli tools cheat --shell bash reverse list`
- `mikacli tools cheat --lang python list comprehension`
- `mikacli tools cheat capabilities --json`

## Default Command

Usage:
```bash
mikacli tools cheat [options] [command] <topic...>
```

Options:

- `--shell <bash|zsh|fish|powershell>`: Optional shell context for the lookup
- `--lang <lang>`: Optional language or context prefix


## Commands

### `capabilities`

Usage:
```bash
mikacli tools cheat capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
