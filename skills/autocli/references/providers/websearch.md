# Web Search

Generated from the real AutoCLI provider definition and command tree.

- Provider: `websearch`
- Category: `tools`
- Command prefix: `autocli tools websearch`
- Aliases: `web`
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search the web across multiple search engines without any account setup

## Notes

- none

## Fast Start

- `autocli tools websearch engines`
- `autocli tools websearch search "bun cookies fetch"`
- `autocli tools websearch search "bun cookies fetch" --summary`
- `autocli tools websearch capabilities --json`

## Default Command

Usage:
```bash
autocli tools websearch [command]
```

No root-only options.


## Commands

### `engines`

Usage:
```bash
autocli tools websearch engines [options]
```

List supported web search engines

No command-specific options.

### `search`

Usage:
```bash
autocli tools websearch search [options] <query>
```

Search the web using one engine or query all supported engines at once

Options:

- `--engine <engine>`: Search engine: duckduckgo, bing, brave, google, yahoo, yandex, baidu
- `--all`: Search all supported engines and group the results
- `--limit <number>`: Maximum results per engine (default: 10)
- `--summary`: Fetch and extract page summaries for the first few results
- `--summary-limit <number>`: Maximum fetched summaries per engine (default: 3)

### `capabilities`

Usage:
```bash
autocli tools websearch capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
