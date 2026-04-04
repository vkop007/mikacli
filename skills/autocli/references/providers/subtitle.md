# Subtitle Editor

Generated from the real AutoCLI provider definition and command tree.

- Provider: `subtitle`
- Category: `editor`
- Command prefix: `autocli editor subtitle`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Edit local subtitle files

## Notes

- none

## Fast Start

- `autocli editor subtitle info ./captions.srt`
- `autocli editor subtitle convert ./captions.srt --to vtt`
- `autocli editor subtitle shift ./captions.vtt --by 2.5`
- `autocli editor subtitle capabilities --json`

## Default Command

Usage:
```bash
autocli editor subtitle [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli editor subtitle info [options] <inputPath>
```

Inspect a local subtitle file

No command-specific options.

### `convert`

Usage:
```bash
autocli editor subtitle convert [options] <inputPath>
```

Convert a subtitle file between SRT and VTT

Options:

- `--to <format>`: Target format: srt or vtt
- `--output <path>`: Exact output file path

### `shift`

Usage:
```bash
autocli editor subtitle shift [options] <inputPath>
```

Shift subtitle timestamps forward or backward

Options:

- `--by <value>`: Shift amount in seconds or hh:mm:ss(.ms)
- `--output <path>`: Exact output file path

### `sync`

Usage:
```bash
autocli editor subtitle sync [options] <inputPath>
```

Synchronize subtitle timestamps using a fixed offset

Options:

- `--by <value>`: Sync offset in seconds or hh:mm:ss(.ms)
- `--output <path>`: Exact output file path

### `clean`

Usage:
```bash
autocli editor subtitle clean [options] <inputPath>
```

Normalize subtitle cue ordering, spacing, and duplicates

Options:

- `--output <path>`: Exact output file path

### `merge`

Usage:
```bash
autocli editor subtitle merge [options] <inputPath> [moreInputPaths...]
```

Merge subtitle files with the same format

Options:

- `--output <path>`: Exact output file path

### `burn`

Usage:
```bash
autocli editor subtitle burn [options] <inputPath>
```

Burn a subtitle file into a local video using ffmpeg

Options:

- `--subtitle <path>`: Subtitle file path to burn into the video
- `--output <path>`: Exact output video path

### `capabilities`

Usage:
```bash
autocli editor subtitle capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
