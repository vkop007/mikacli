# Download

Generated from the real AutoCLI provider definition and command tree.

- Provider: `download`
- Category: `tools`
- Command prefix: `autocli tools download`
- Aliases: none
- Auth: `none`, `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Download media from most URLs supported by yt-dlp, with optional saved-session cookies from AutoCLI

## Notes

- none

## Fast Start

- `autocli tools download info https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `autocli tools download stream https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `autocli tools download info 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' --playlist --limit 5`
- `autocli tools download capabilities --json`

## Default Command

Usage:
```bash
autocli tools download [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli tools download info [options] <url>
```

Inspect media info and available formats for a URL

Options:

- `--cookies <path>`: Path to cookies.txt or a yt-dlp-compatible cookies file
- `--platform <provider>`: Reuse a saved AutoCLI session for this provider as yt-dlp cookies
- `--account <name>`: Saved AutoCLI session account to use with --platform
- `--playlist`: Allow playlist or multi-item URLs instead of forcing a single item
- `--limit <number>`: Maximum playlist items to inspect or download (1-100)

### `stream`

Usage:
```bash
autocli tools download stream [options] <url>
```

Resolve a direct media stream URL instead of downloading the file

Options:

- `--cookies <path>`: Path to cookies.txt or a yt-dlp-compatible cookies file
- `--platform <provider>`: Reuse a saved AutoCLI session for this provider as yt-dlp cookies
- `--account <name>`: Saved AutoCLI session account to use with --platform
- `--quality <resolution>`: Preferred max resolution for a single-file video stream, for example 720p or 1080
- `--format <selector>`: Custom yt-dlp format selector
- `--audio`: Resolve an audio stream URL instead of a video stream URL

### `channel`

Usage:
```bash
autocli tools download channel [options] <target>
```

Inspect or download all videos from a YouTube channel automatically

Options:

- `--mode <mode>`: Channel mode: info, video, or audio
- `--cookies <path>`: Path to cookies.txt or a yt-dlp-compatible cookies file
- `--platform <provider>`: Reuse a saved AutoCLI session for this provider as yt-dlp cookies
- `--account <name>`: Saved AutoCLI session account to use with --platform
- `--output-dir <path>`: Directory to save downloaded files
- `--filename <template>`: yt-dlp output template, for example '%(title)s [%(id)s].%(ext)s'
- `--limit <number>`: Maximum channel videos to inspect or download (1-100)
- `--quality <resolution>`: Preferred max resolution in video mode, for example 720p or 1080
- `--format <selector>`: Custom yt-dlp format selector
- `--audio-format <format>`: Extracted audio format in audio mode (default: mp3)

### `video`

Usage:
```bash
autocli tools download video [options] <url>
```

Download video from a supported URL

Options:

- `--cookies <path>`: Path to cookies.txt or a yt-dlp-compatible cookies file
- `--platform <provider>`: Reuse a saved AutoCLI session for this provider as yt-dlp cookies
- `--account <name>`: Saved AutoCLI session account to use with --platform
- `--output-dir <path>`: Directory to save downloaded files
- `--filename <template>`: yt-dlp output template, for example '%(title)s [%(id)s].%(ext)s'
- `--playlist`: Allow playlist or multi-item URLs instead of forcing a single item
- `--limit <number>`: Maximum playlist items to inspect or download (1-100)
- `--quality <resolution>`: Preferred max resolution, for example 720p or 1080
- `--format <selector>`: Custom yt-dlp format selector

### `audio`

Usage:
```bash
autocli tools download audio [options] <url>
```

Download audio from a supported URL

Options:

- `--cookies <path>`: Path to cookies.txt or a yt-dlp-compatible cookies file
- `--platform <provider>`: Reuse a saved AutoCLI session for this provider as yt-dlp cookies
- `--account <name>`: Saved AutoCLI session account to use with --platform
- `--output-dir <path>`: Directory to save downloaded files
- `--filename <template>`: yt-dlp output template, for example '%(title)s [%(id)s].%(ext)s'
- `--playlist`: Allow playlist or multi-item URLs instead of forcing a single item
- `--limit <number>`: Maximum playlist items to inspect or download (1-100)
- `--audio-format <format>`: Extracted audio format (default: mp3)
- `--format <selector>`: Custom yt-dlp format selector

### `batch`

Usage:
```bash
autocli tools download batch [options] <inputFile>
```

Run yt-dlp info or downloads for a newline-delimited or JSON array input file

Options:

- `--mode <mode>`: Batch mode: info, video, or audio
- `--cookies <path>`: Path to cookies.txt or a yt-dlp-compatible cookies file
- `--platform <provider>`: Reuse a saved AutoCLI session for this provider as yt-dlp cookies
- `--account <name>`: Saved AutoCLI session account to use with --platform
- `--output-dir <path>`: Directory to save downloaded files
- `--filename <template>`: yt-dlp output template, for example '%(title)s [%(id)s].%(ext)s'
- `--playlist`: Allow playlist or multi-item URLs instead of forcing a single item
- `--limit <number>`: Maximum playlist items to inspect or download (1-100)
- `--quality <resolution>`: Preferred max resolution in video mode, for example 720p or 1080
- `--format <selector>`: Custom yt-dlp format selector
- `--audio-format <format>`: Extracted audio format in audio mode (default: mp3)
- `--fail-fast`: Stop after the first failed URL

### `capabilities`

Usage:
```bash
autocli tools download capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
