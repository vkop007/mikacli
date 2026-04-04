# GIF Editor

Generated from the real AutoCLI provider definition and command tree.

- Provider: `gif`
- Category: `editor`
- Command prefix: `autocli editor gif`
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

- `autocli editor gif info ./clip.gif`
- `autocli editor gif create ./clip.mp4 --start 00:00:01 --duration 2`
- `autocli editor gif optimize ./clip.gif --width 480`
- `autocli editor gif capabilities --json`

## Default Command

Usage:
```bash
autocli editor gif [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli editor gif info [options] <inputPath>
```

Inspect a GIF or GIF-like animation file

No command-specific options.

### `create`

Usage:
```bash
autocli editor gif create [options] <inputPath>
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
autocli editor gif optimize [options] <inputPath>
```

Re-encode and optimize a GIF

Options:

- `--fps <value>`: Target frame rate
- `--width <px>`: Target width in pixels
- `--output <path>`: Exact output file path

### `to-video`

Usage:
```bash
autocli editor gif to-video [options] <inputPath>
```

Convert a GIF to a regular video file

Options:

- `--to <format>`: Target video format: mp4, mov, webm
- `--output <path>`: Exact output file path

### `capabilities`

Usage:
```bash
autocli editor gif capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
