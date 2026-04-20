# Markdown Fetch

Generated from the real MikaCLI provider definition and command tree.

- Provider: `markdown-fetch`
- Category: `tools`
- Command prefix: `mikacli tools markdown-fetch`
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

- `mikacli tools markdown-fetch https://example.com`
- `mikacli tools markdown-fetch https://news.ycombinator.com --include-links`
- `mikacli tools markdown-fetch https://example.com/article --max-chars 12000`
- `mikacli tools markdown-fetch capabilities --json`

## Default Command

Usage:
```bash
mikacli tools markdown-fetch [options] [command] <url>
```

Options:

- `--max-chars <number>`: Maximum markdown characters to keep (default: 6000)
- `--include-links`: Preserve inline links in markdown output


## Commands

### `capabilities`

Usage:
```bash
mikacli tools markdown-fetch capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
