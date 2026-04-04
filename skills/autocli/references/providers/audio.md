# Audio Editor

Generated from the real AutoCLI provider definition and command tree.

- Provider: `audio`
- Category: `editor`
- Command prefix: `autocli editor audio`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Edit local audio files using ffmpeg

## Notes

- none

## Fast Start

- `autocli editor audio info ./song.mp3`
- `autocli editor audio trim ./song.mp3 --start 00:00:10 --duration 30`
- `autocli editor audio convert ./song.wav --to mp3`
- `autocli editor audio capabilities --json`

## Default Command

Usage:
```bash
autocli editor audio [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli editor audio info [options] <inputPath>
```

Inspect a local audio file

No command-specific options.

### `trim`

Usage:
```bash
autocli editor audio trim [options] <inputPath>
```

Trim a local audio file

Options:

- `--start <time>`: Trim start time
- `--end <time>`: Trim end time
- `--duration <time>`: Trim duration
- `--output <path>`: Exact output file path

### `convert`

Usage:
```bash
autocli editor audio convert [options] <inputPath>
```

Convert a local audio file to another format

Options:

- `--to <format>`: Target format: mp3, m4a, aac, wav, flac, ogg, opus
- `--output <path>`: Exact output file path

### `compress`

Usage:
```bash
autocli editor audio compress [options] <inputPath>
```

Compress an audio file to a lower bitrate

Options:

- `--bitrate <kbps>`: Target bitrate in kbps
- `--output <path>`: Exact output file path

### `merge`

Usage:
```bash
autocli editor audio merge [options] <inputPaths...>
```

Merge multiple audio files in order

Options:

- `--output <path>`: Exact output file path

### `fade-in`

Usage:
```bash
autocli editor audio fade-in [options] <inputPath>
```

Apply a fade-in to an audio file

Options:

- `--duration <seconds>`: Fade duration in seconds
- `--output <path>`: Exact output file path

### `fade-out`

Usage:
```bash
autocli editor audio fade-out [options] <inputPath>
```

Apply a fade-out to an audio file

Options:

- `--duration <seconds>`: Fade duration in seconds
- `--start <seconds>`: Optional fade start time in seconds
- `--output <path>`: Exact output file path

### `trim-silence`

Usage:
```bash
autocli editor audio trim-silence [options] <inputPath>
```

Remove leading and trailing silence from an audio file

Options:

- `--threshold <value>`: Silence threshold, e.g. -45dB
- `--duration <seconds>`: Minimum silence duration
- `--output <path>`: Exact output file path

### `normalize`

Usage:
```bash
autocli editor audio normalize [options] <inputPath>
```

Normalize audio loudness

Options:

- `--loudness <lufs>`: Target loudness value
- `--output <path>`: Exact output file path

### `silence-detect`

Usage:
```bash
autocli editor audio silence-detect [options] <inputPath>
```

Detect silent segments in an audio file

Options:

- `--threshold <value>`: Silence threshold, e.g. -45dB
- `--duration <seconds>`: Minimum silence duration

### `loudness-report`

Usage:
```bash
autocli editor audio loudness-report [options] <inputPath>
```

Measure loudness and normalization stats for an audio file

Options:

- `--target-lufs <value>`: Target loudness value
- `--true-peak <value>`: Target true peak in dBFS
- `--lra <value>`: Target loudness range

### `volume`

Usage:
```bash
autocli editor audio volume [options] <inputPath>
```

Adjust audio volume by decibels

Options:

- `--db <value>`: Volume change in decibels
- `--output <path>`: Exact output file path

### `denoise`

Usage:
```bash
autocli editor audio denoise [options] <inputPath>
```

Reduce steady background noise in an audio file

Options:

- `--reduction <value>`: Noise reduction strength from 0.1 to 97
- `--noise-floor <value>`: Estimated noise floor in dB, e.g. -50
- `--output <path>`: Exact output file path

### `waveform`

Usage:
```bash
autocli editor audio waveform [options] <inputPath>
```

Generate a waveform image from an audio file

Options:

- `--width <px>`: Output image width in pixels
- `--height <px>`: Output image height in pixels
- `--output <path>`: Exact output file path

### `spectrogram`

Usage:
```bash
autocli editor audio spectrogram [options] <inputPath>
```

Generate a spectrogram image from an audio file

Options:

- `--width <px>`: Output image width in pixels
- `--height <px>`: Output image height in pixels
- `--output <path>`: Exact output file path

### `capabilities`

Usage:
```bash
autocli editor audio capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
