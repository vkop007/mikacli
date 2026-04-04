# Markdown Fetch

Generated from the real AutoCLI provider definition and command tree.

- Provider: `markdown-fetch`
- Category: `tools`
- Command prefix: `autocli tools markdown-fetch`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Fetch a web page and convert it to readable markdown without any account setup

## Notes

- none

## Fast Start

- `autocli tools markdown-fetch https://example.com`
- `autocli tools markdown-fetch https://news.ycombinator.com --include-links`
- `autocli tools markdown-fetch https://example.com/article --max-chars 12000`
- `autocli tools markdown-fetch capabilities --json`

## Default Command

Usage:
```bash
autocli tools markdown-fetch [options] [command] <url>
```

Options:

- `--max-chars <number>`: Maximum markdown characters to keep (default: 6000)
- `--include-links`: Preserve inline links in markdown output


## Commands

### `capabilities`

Usage:
```bash
autocli tools markdown-fetch capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
