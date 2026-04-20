# Robots

Generated from the real MikaCLI provider definition and command tree.

- Provider: `robots`
- Category: `tools`
- Command prefix: `mikacli tools robots`
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

- `mikacli tools robots https://example.com`
- `mikacli tools robots https://example.com/robots.txt`
- `mikacli tools robots capabilities --json`

## Default Command

Usage:
```bash
mikacli tools robots [options] [command] <url>
```

Options:

- `--follow-sitemaps`: Return sitemap directives in the parsed data


## Commands

### `capabilities`

Usage:
```bash
mikacli tools robots capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
