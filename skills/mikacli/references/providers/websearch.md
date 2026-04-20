# Web Search

Generated from the real MikaCLI provider definition and command tree.

- Provider: `websearch`
- Category: `tools`
- Command prefix: `mikacli tools websearch`
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

- `mikacli tools websearch engines`
- `mikacli tools websearch search "bun cookies fetch"`
- `mikacli tools websearch search "bun cookies fetch" --summary`
- `mikacli tools websearch capabilities --json`

## Default Command

Usage:
```bash
mikacli tools websearch [command]
```

No root-only options.


## Commands

### `engines`

Usage:
```bash
mikacli tools websearch engines [options]
```

List supported web search engines

No command-specific options.

### `search`

Usage:
```bash
mikacli tools websearch search [options] <query>
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
mikacli tools websearch capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
