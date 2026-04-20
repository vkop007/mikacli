# GIF Editor

Generated from the real MikaCLI provider definition and command tree.

- Provider: `gif`
- Category: `editor`
- Command prefix: `mikacli editor gif`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Create, optimize, and convert GIFs using ffmpeg

## Notes

- none

## Fast Start

- `mikacli editor gif info ./clip.gif`
- `mikacli editor gif create ./clip.mp4 --start 00:00:01 --duration 2`
- `mikacli editor gif optimize ./clip.gif --width 480`
- `mikacli editor gif capabilities --json`

## Default Command

Usage:
```bash
mikacli editor gif [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
mikacli editor gif info [options] <inputPath>
```

Inspect a GIF or GIF-like animation file

No command-specific options.

### `create`

Usage:
```bash
mikacli editor gif create [options] <inputPath>
```

Aliases: `from-video`

Create a GIF from a video segment

Options:

- `--start <time>`: GIF start time
- `--duration <time>`: GIF duration
- `--fps <value>`: GIF frame rate
- `--width <px>`: GIF width in pixels
- `--output <path>`: Exact output file path

### `optimize`

Usage:
```bash
mikacli editor gif optimize [options] <inputPath>
```

Re-encode and optimize a GIF

Options:

- `--fps <value>`: Target frame rate
- `--width <px>`: Target width in pixels
- `--output <path>`: Exact output file path

### `to-video`

Usage:
```bash
mikacli editor gif to-video [options] <inputPath>
```

Convert a GIF to a regular video file

Options:

- `--to <format>`: Target video format: mp4, mov, webm
- `--output <path>`: Exact output file path

### `capabilities`

Usage:
```bash
mikacli editor gif capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
