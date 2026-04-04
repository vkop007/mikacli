# RSS

Generated from the real AutoCLI provider definition and command tree.

- Provider: `rss`
- Category: `tools`
- Command prefix: `autocli tools rss`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Fetch and parse RSS or Atom feeds without any account setup

## Notes

- none

## Fast Start

- `autocli tools rss https://hnrss.org/frontpage`
- `autocli tools rss https://example.com/feed.xml --limit 5`
- `autocli tools rss https://example.com/feed.xml --summary --summary-limit 2`
- `autocli tools rss capabilities --json`

## Default Command

Usage:
```bash
autocli tools rss [options] [command] <feedUrl>
```

Options:

- `--limit <number>`: Maximum number of feed items to load (default: 10)
- `--summary`: Fetch article summaries for the first items when available
- `--summary-limit <number>`: Maximum items to summarize (default: 3)


## Commands

### `capabilities`

Usage:
```bash
autocli tools rss capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
