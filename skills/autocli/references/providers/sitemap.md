# Sitemap

Generated from the real AutoCLI provider definition and command tree.

- Provider: `sitemap`
- Category: `tools`
- Command prefix: `autocli tools sitemap`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Fetch and parse sitemap.xml files without any account setup

## Notes

- none

## Fast Start

- `autocli tools sitemap https://example.com/sitemap.xml`
- `autocli tools sitemap https://example.com --limit 250`
- `autocli tools sitemap https://example.com --depth 2`
- `autocli tools sitemap capabilities --json`

## Default Command

Usage:
```bash
autocli tools sitemap [options] [command] <url>
```

Options:

- `--limit <number>`: Maximum number of URLs to return (default: 100)
- `--depth <number>`: How many sitemap index levels to follow (default: 1)


## Commands

### `capabilities`

Usage:
```bash
autocli tools sitemap capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
