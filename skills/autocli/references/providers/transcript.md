# Transcript

Generated from the real AutoCLI provider definition and command tree.

- Provider: `transcript`
- Category: `tools`
- Command prefix: `autocli tools transcript`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Extract subtitles or transcripts from media URLs via yt-dlp

## Notes

- none

## Fast Start

- `autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --lang en --format srt`
- `autocli tools transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ --auto --format json --json`
- `autocli tools transcript capabilities --json`

## Default Command

Usage:
```bash
autocli tools transcript [options] [command] <target>
```

Options:

- `--lang <code>`: Preferred subtitle language code, for example en, hi, or es
- `--auto`: Prefer auto-generated captions when available
- `--format <format>`: Output format: txt, vtt, srt, or json
- `--timeout <ms>`: Request timeout in milliseconds


## Commands

### `capabilities`

Usage:
```bash
autocli tools transcript capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
