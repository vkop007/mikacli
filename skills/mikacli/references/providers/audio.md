# Audio Editor

Generated from the real MikaCLI provider definition and command tree.

- Provider: `audio`
- Category: `editor`
- Command prefix: `mikacli editor audio`
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

- `mikacli editor audio info ./song.mp3`
- `mikacli editor audio trim ./song.mp3 --start 00:00:10 --duration 30`
- `mikacli editor audio convert ./song.wav --to mp3`
- `mikacli editor audio capabilities --json`

## Default Command

Usage:
```bash
mikacli editor audio [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
mikacli editor audio info [options] <inputPath>
```

Inspect a local audio file

No command-specific options.

### `trim`

Usage:
```bash
mikacli editor audio trim [options] <inputPath>
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
mikacli editor audio convert [options] <inputPaths...>
```

Convert local audio files to another format

Options:

- `--to <format>`: Target format: mp3, m4a, aac, wav, flac, ogg, opus
- `--output <path>`: Exact output file path (only used if 1 input file)

### `compress`

Usage:
```bash
mikacli editor audio compress [options] <inputPath>
```

Compress an audio file to a lower bitrate

Options:

- `--bitrate <kbps>`: Target bitrate in kbps
- `--output <path>`: Exact output file path

### `merge`

Usage:
```bash
mikacli editor audio merge [options] <inputPaths...>
```

Merge multiple audio files in order

Options:

- `--crossfade <seconds>`: Crossfade duration in seconds
- `--output <path>`: Exact output file path

### `fade-in`

Usage:
```bash
mikacli editor audio fade-in [options] <inputPath>
```

Apply a fade-in to an audio file

Options:

- `--duration <seconds>`: Fade duration in seconds
- `--output <path>`: Exact output file path

### `fade-out`

Usage:
```bash
mikacli editor audio fade-out [options] <inputPath>
```

Apply a fade-out to an audio file

Options:

- `--duration <seconds>`: Fade duration in seconds
- `--start <seconds>`: Optional fade start time in seconds
- `--output <path>`: Exact output file path

### `trim-silence`

Usage:
```bash
mikacli editor audio trim-silence [options] <inputPath>
```

Remove leading and trailing silence from an audio file

Options:

- `--threshold <value>`: Silence threshold, e.g. -45dB
- `--duration <seconds>`: Minimum silence duration
- `--output <path>`: Exact output file path

### `normalize`

Usage:
```bash
mikacli editor audio normalize [options] <inputPath>
```

Normalize audio loudness

Options:

- `--loudness <lufs>`: Target loudness value
- `--output <path>`: Exact output file path

### `silence-detect`

Usage:
```bash
mikacli editor audio silence-detect [options] <inputPath>
```

Detect silent segments in an audio file

Options:

- `--threshold <value>`: Silence threshold, e.g. -45dB
- `--duration <seconds>`: Minimum silence duration

### `loudness-report`

Usage:
```bash
mikacli editor audio loudness-report [options] <inputPath>
```

Measure loudness and normalization stats for an audio file

Options:

- `--target-lufs <value>`: Target loudness value
- `--true-peak <value>`: Target true peak in dBFS
- `--lra <value>`: Target loudness range

### `volume`

Usage:
```bash
mikacli editor audio volume [options] <inputPath>
```

Adjust audio volume by decibels

Options:

- `--db <value>`: Volume change in decibels
- `--output <path>`: Exact output file path

### `denoise`

Usage:
```bash
mikacli editor audio denoise [options] <inputPath>
```

Reduce steady background noise in an audio file

Options:

- `--reduction <value>`: Noise reduction strength from 0.1 to 97
- `--noise-floor <value>`: Estimated noise floor in dB, e.g. -50
- `--output <path>`: Exact output file path

### `waveform`

Usage:
```bash
mikacli editor audio waveform [options] <inputPath>
```

Generate a waveform image from an audio file

Options:

- `--width <px>`: Output image width in pixels
- `--height <px>`: Output image height in pixels
- `--output <path>`: Exact output file path

### `spectrogram`

Usage:
```bash
mikacli editor audio spectrogram [options] <inputPath>
```

Generate a spectrogram image from an audio file

Options:

- `--width <px>`: Output image width in pixels
- `--height <px>`: Output image height in pixels
- `--output <path>`: Exact output file path

### `split`

Usage:
```bash
mikacli editor audio split [options] <inputPath>
```

Split an audio file into segments

Options:

- `--every <seconds>`: Duration of each segment in seconds
- `--output-dir <path>`: Directory to save the segments in
- `--by-silence`: Split audio by detecting silences
- `--silence-threshold <value>`: Silence threshold, e.g. -45dB
- `--silence-duration <seconds>`: Minimum silence duration

### `mix`

Usage:
```bash
mikacli editor audio mix [options] <inputPath>
```

Overlay background audio on top of the main audio

Options:

- `--background <path>`: Background audio path (e.g. music)
- `--bg-volume <db>`: Background audio volume in decibels
- `--output <path>`: Exact output file path

### `speed`

Usage:
```bash
mikacli editor audio speed [options] <inputPath>
```

Change audio playback speed without altering pitch

Options:

- `--rate <multiplier>`: Playback speed multiplier (e.g. 1.5)
- `--output <path>`: Exact output file path

### `extract`

Usage:
```bash
mikacli editor audio extract [options] <inputPath>
```

Extract a segment from an audio file (intuitive alias for trim)

Options:

- `--start <time>`: Extract start time (e.g. 00:10:00)
- `--end <time>`: Extract end time (e.g. 00:15:00)
- `--output <path>`: Exact output file path

### `eq`

Usage:
```bash
mikacli editor audio eq [options] <inputPath>
```

Apply an equalizer to adjust bass and treble

Options:

- `--bass <db>`: Bass adjustment in dB
- `--treble <db>`: Treble adjustment in dB
- `--output <path>`: Exact output file path

### `reverse`

Usage:
```bash
mikacli editor audio reverse [options] <inputPath>
```

Reverse an audio file

Options:

- `--output <path>`: Exact output file path

### `mono`

Usage:
```bash
mikacli editor audio mono [options] <inputPath>
```

Mix audio down to a single mono channel

Options:

- `--output <path>`: Exact output file path

### `stereo`

Usage:
```bash
mikacli editor audio stereo [options] <inputPath>
```

Convert audio to stereo channels

Options:

- `--output <path>`: Exact output file path

### `resample`

Usage:
```bash
mikacli editor audio resample [options] <inputPath>
```

Change the sample rate of an audio file

Options:

- `--rate <hz>`: Target sample rate in Hz
- `--output <path>`: Exact output file path

### `tag`

Usage:
```bash
mikacli editor audio tag [options] <inputPath>
```

Edit ID3/metadata tags of an audio file

Options:

- `--title <text>`: Track title
- `--artist <text>`: Track artist
- `--album <text>`: Track album
- `--year <text>`: Track release year
- `--output <path>`: Exact output file path

### `capabilities`

Usage:
```bash
mikacli editor audio capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
