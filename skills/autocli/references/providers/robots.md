# Robots

Generated from the real AutoCLI provider definition and command tree.

- Provider: `robots`
- Category: `tools`
- Command prefix: `autocli tools robots`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Fetch and parse robots.txt files without any account setup

## Notes

- none

## Fast Start

- `autocli tools robots https://example.com`
- `autocli tools robots https://example.com/robots.txt`
- `autocli tools robots capabilities --json`

## Default Command

Usage:
```bash
autocli tools robots [options] [command] <url>
```

Options:

- `--follow-sitemaps`: Return sitemap directives in the parsed data


## Commands

### `capabilities`

Usage:
```bash
autocli tools robots capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
