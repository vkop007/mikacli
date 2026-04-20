# oEmbed

Generated from the real MikaCLI provider definition and command tree.

- Provider: `oembed`
- Category: `tools`
- Command prefix: `mikacli tools oembed`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Resolve embeddable media/page metadata from public URLs

## Notes

- none

## Fast Start

- `mikacli tools oembed https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `mikacli tools oembed https://vimeo.com/76979871 --format json`
- `mikacli tools oembed https://www.flickr.com/photos/bees/2341623661 --json`
- `mikacli tools oembed capabilities --json`

## Default Command

Usage:
```bash
mikacli tools oembed [options] [command] <target>
```

Options:

- `--format <format>`: Preferred response format: auto, json, or xml
- `--maxwidth <number>`: Optional max embed width
- `--maxheight <number>`: Optional max embed height
- `--discover-only`: Use only page-discovered oEmbed endpoints, without public fallback
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
mikacli tools oembed capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
