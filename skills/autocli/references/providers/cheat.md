# Cheat

Generated from the real AutoCLI provider definition and command tree.

- Provider: `cheat`
- Category: `tools`
- Command prefix: `autocli tools cheat`
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

- `autocli tools cheat git status`
- `autocli tools cheat --shell bash reverse list`
- `autocli tools cheat --lang python list comprehension`
- `autocli tools cheat capabilities --json`

## Default Command

Usage:
```bash
autocli tools cheat [options] [command] <topic...>
```

Options:

- `--shell <bash|zsh|fish|powershell>`: Optional shell context for the lookup
- `--lang <lang>`: Optional language or context prefix


## Commands

### `capabilities`

Usage:
```bash
autocli tools cheat capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
