# Subtitle Editor

Generated from the real MikaCLI provider definition and command tree.

- Provider: `subtitle`
- Category: `editor`
- Command prefix: `mikacli editor subtitle`
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

- `mikacli editor subtitle info ./captions.srt`
- `mikacli editor subtitle convert ./captions.srt --to vtt`
- `mikacli editor subtitle shift ./captions.vtt --by 2.5`
- `mikacli editor subtitle capabilities --json`

## Default Command

Usage:
```bash
mikacli editor subtitle [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
mikacli editor subtitle info [options] <inputPath>
```

Inspect a local subtitle file

No command-specific options.

### `convert`

Usage:
```bash
mikacli editor subtitle convert [options] <inputPath>
```

Convert a subtitle file between SRT and VTT

Options:

- `--to <format>`: Target format: srt or vtt
- `--output <path>`: Exact output file path

### `shift`

Usage:
```bash
mikacli editor subtitle shift [options] <inputPath>
```

Shift subtitle timestamps forward or backward

Options:

- `--by <value>`: Shift amount in seconds or hh:mm:ss(.ms)
- `--output <path>`: Exact output file path

### `sync`

Usage:
```bash
mikacli editor subtitle sync [options] <inputPath>
```

Synchronize subtitle timestamps using a fixed offset

Options:

- `--by <value>`: Sync offset in seconds or hh:mm:ss(.ms)
- `--output <path>`: Exact output file path

### `clean`

Usage:
```bash
mikacli editor subtitle clean [options] <inputPath>
```

Normalize subtitle cue ordering, spacing, and duplicates

Options:

- `--output <path>`: Exact output file path

### `merge`

Usage:
```bash
mikacli editor subtitle merge [options] <inputPath> [moreInputPaths...]
```

Merge subtitle files with the same format

Options:

- `--output <path>`: Exact output file path

### `burn`

Usage:
```bash
mikacli editor subtitle burn [options] <inputPath>
```

Burn a subtitle file into a local video using ffmpeg

Options:

- `--subtitle <path>`: Subtitle file path to burn into the video
- `--output <path>`: Exact output video path

### `capabilities`

Usage:
```bash
mikacli editor subtitle capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
