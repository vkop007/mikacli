# Screenshot

Generated from the real AutoCLI provider definition and command tree.

- Provider: `screenshot`
- Category: `tools`
- Command prefix: `autocli tools screenshot`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Capture a website screenshot using a public no-key rendering service

## Notes

- none

## Fast Start

- `autocli tools screenshot https://example.com`
- `autocli tools screenshot openai.com --output-dir ./shots`
- `autocli tools screenshot https://news.ycombinator.com --output ./hn.png`
- `autocli tools screenshot capabilities --json`

## Default Command

Usage:
```bash
autocli tools screenshot [options] [command] <target>
```

Options:

- `--output <path>`: Write the screenshot to an exact file path
- `--output-dir <path>`: Directory to write the screenshot into
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
autocli tools screenshot capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
