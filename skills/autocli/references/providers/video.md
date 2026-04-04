# Video Editor

Generated from the real AutoCLI provider definition and command tree.

- Provider: `video`
- Category: `editor`
- Command prefix: `autocli editor video`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Edit local video files using ffmpeg

## Notes

- none

## Fast Start

- `autocli editor video info ./clip.mp4`
- `autocli editor video trim ./clip.mp4 --start 00:00:05 --duration 10`
- `autocli editor video split ./clip.mp4 --duration 00:00:15 --output-dir ./parts`
- `autocli editor video capabilities --json`

## Default Command

Usage:
```bash
autocli editor video [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli editor video info [options] <inputPath>
```

Inspect a local video file

No command-specific options.

### `trim`

Usage:
```bash
autocli editor video trim [options] <inputPath>
```

Trim a local video file

Options:

- `--start <time>`: Trim start time, e.g. 00:00:05
- `--end <time>`: Trim end time, e.g. 00:00:20
- `--duration <time>`: Trim duration, e.g. 10 or 00:00:10
- `--output <path>`: Exact output file path

### `split`

Usage:
```bash
autocli editor video split [options] <inputPath>
```

Split a local video into equal-duration parts

Options:

- `--duration <time>`: Segment duration, e.g. 15 or 00:00:15
- `--output-dir <path>`: Directory to write video parts into
- `--prefix <name>`: Filename prefix for generated parts
- `--to <format>`: Optional target format: mp4, mov, webm

### `scene-detect`

Usage:
```bash
autocli editor video scene-detect [options] <inputPath>
```

Detect scene changes in a local video

Options:

- `--threshold <value>`: Scene change threshold between 0 and 100

### `stabilize`

Usage:
```bash
autocli editor video stabilize [options] <inputPath>
```

Stabilize a shaky local video

Options:

- `--method <name>`: Stabilization method: auto, vidstab, or deshake
- `--shakiness <value>`: vidstab shakiness from 1 to 10
- `--accuracy <value>`: vidstab accuracy from 1 to 15
- `--smoothing <value>`: vidstab smoothing from 1 to 100
- `--zoom <value>`: Optional stabilization zoom from 0 to 10
- `--output <path>`: Exact output file path

### `convert`

Usage:
```bash
autocli editor video convert [options] <inputPath>
```

Convert a local video to another format

Options:

- `--to <format>`: Target format: mp4, mov, webm
- `--output <path>`: Exact output file path

### `compress`

Usage:
```bash
autocli editor video compress [options] <inputPath>
```

Compress a local video using a configurable CRF value

Options:

- `--crf <value>`: CRF quality value, lower is higher quality
- `--preset <name>`: Encoding preset, e.g. fast, medium, slow
- `--to <format>`: Optional target format: mp4, mov, webm
- `--output <path>`: Exact output file path

### `speed`

Usage:
```bash
autocli editor video speed [options] <inputPath>
```

Change the playback speed of a local video

Options:

- `--factor <value>`: Speed factor, e.g. 2 for 2x faster or 0.5 for half speed
- `--output <path>`: Exact output file path

### `reverse`

Usage:
```bash
autocli editor video reverse [options] <inputPath>
```

Reverse a local video, including audio when present

Options:

- `--output <path>`: Exact output file path

### `boomerang`

Usage:
```bash
autocli editor video boomerang [options] <inputPath>
```

Create a boomerang-style video that plays forward and backward

Options:

- `--output <path>`: Exact output file path

### `overlay-image`

Usage:
```bash
autocli editor video overlay-image [options] <inputPath>
```

Overlay an image on top of a video

Options:

- `--overlay <path>`: Overlay image path
- `--position <value>`: Overlay position: top-left, top-right, bottom-left, bottom-right, center
- `--margin <px>`: Overlay margin in pixels
- `--width <px>`: Optional overlay width in pixels
- `--output <path>`: Exact output file path

### `overlay-text`

Usage:
```bash
autocli editor video overlay-text [options] <inputPath> <text...>
```

Draw text on top of a video

Options:

- `--position <value>`: Text position: top-left, top-right, bottom-left, bottom-right, center, top-center, bottom-center
- `--margin <px>`: Text margin in pixels
- `--font-size <px>`: Font size in pixels
- `--color <value>`: Text color, e.g. white or #ffffff
- `--box-color <value>`: Background box color
- `--box-opacity <value>`: Background box opacity from 0 to 1
- `--no-box`: Disable the background box behind the text
- `--output <path>`: Exact output file path

### `audio-replace`

Usage:
```bash
autocli editor video audio-replace [options] <inputPath>
```

Replace the audio track in a local video

Options:

- `--audio <path>`: Replacement audio path
- `--output <path>`: Exact output file path

### `frame-extract`

Usage:
```bash
autocli editor video frame-extract [options] <inputPath>
```

Extract a sequence of frames from a local video

Options:

- `--start <time>`: Extraction start time
- `--duration <time>`: Extraction duration
- `--fps <value>`: Frames per second
- `--output-dir <path>`: Directory for extracted frames
- `--prefix <name>`: Filename prefix for extracted frames
- `--format <format>`: Frame image format: png, jpg, jpeg, webp

### `thumbnail`

Usage:
```bash
autocli editor video thumbnail [options] <inputPath>
```

Extract a thumbnail from a local video

Options:

- `--at <time>`: Timestamp for the thumbnail
- `--output <path>`: Exact output file path

### `resize`

Usage:
```bash
autocli editor video resize [options] <inputPath>
```

Resize a local video

Options:

- `--width <px>`: Target width in pixels
- `--height <px>`: Target height in pixels
- `--output <path>`: Exact output file path

### `crop`

Usage:
```bash
autocli editor video crop [options] <inputPath>
```

Crop a local video

Options:

- `--width <px>`: Crop width in pixels
- `--height <px>`: Crop height in pixels
- `--x <px>`: Left offset in pixels
- `--y <px>`: Top offset in pixels
- `--output <path>`: Exact output file path

### `extract-audio`

Usage:
```bash
autocli editor video extract-audio [options] <inputPath>
```

Extract the audio track from a video

Options:

- `--to <format>`: Target audio format: mp3, wav, m4a, aac, flac
- `--output <path>`: Exact output file path

### `mute`

Usage:
```bash
autocli editor video mute [options] <inputPath>
```

Write a copy of the video without audio

Options:

- `--output <path>`: Exact output file path

### `gif`

Usage:
```bash
autocli editor video gif [options] <inputPath>
```

Create a GIF from a video segment

Options:

- `--start <time>`: GIF start time, e.g. 00:00:01
- `--duration <time>`: GIF duration, e.g. 2 or 00:00:02
- `--fps <value>`: GIF frame rate
- `--width <px>`: GIF width in pixels
- `--output <path>`: Exact output file path

### `concat`

Usage:
```bash
autocli editor video concat [options] <inputPaths...>
```

Concatenate multiple videos in order

Options:

- `--output <path>`: Exact output file path

### `subtitle-burn`

Usage:
```bash
autocli editor video subtitle-burn [options] <inputPath>
```

Burn a subtitle file into a video

Options:

- `--subtitle <path>`: Subtitle file path
- `--output <path>`: Exact output file path

### `capabilities`

Usage:
```bash
autocli editor video capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
