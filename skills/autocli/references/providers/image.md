# Image Editor

Generated from the real AutoCLI provider definition and command tree.

- Provider: `image`
- Category: `editor`
- Command prefix: `autocli editor image`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Edit local image files using ffmpeg

## Notes

- none

## Fast Start

- `autocli editor image info ./photo.png`
- `autocli editor image resize ./photo.png --width 1200`
- `autocli editor image crop ./photo.png --width 1080 --height 1080`
- `autocli editor image capabilities --json`

## Default Command

Usage:
```bash
autocli editor image [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli editor image info [options] <inputPath>
```

Inspect a local image file

No command-specific options.

### `resize`

Usage:
```bash
autocli editor image resize [options] <inputPath>
```

Resize a local image

Options:

- `--width <px>`: Target width in pixels
- `--height <px>`: Target height in pixels
- `--output <path>`: Exact output file path

### `crop`

Usage:
```bash
autocli editor image crop [options] <inputPath>
```

Crop a local image

Options:

- `--width <px>`: Crop width in pixels
- `--height <px>`: Crop height in pixels
- `--x <px>`: Left offset in pixels
- `--y <px>`: Top offset in pixels
- `--aspect <ratio>`: Aspect ratio, e.g. 16:9
- `--gravity <value>`: Gravity for aspect crop, e.g. center
- `--output <path>`: Exact output file path

### `convert`

Usage:
```bash
autocli editor image convert [options] <inputPath>
```

Convert a local image to another format

Options:

- `--to <format>`: Target format: png, jpg, jpeg, webp, bmp
- `--output <path>`: Exact output file path

### `rotate`

Usage:
```bash
autocli editor image rotate [options] <inputPath>
```

Rotate a local image by degrees

Options:

- `--degrees <value>`: Rotation angle in degrees
- `--output <path>`: Exact output file path

### `upscale`

Usage:
```bash
autocli editor image upscale [options] <inputPath>
```

Upscale a local image with high-quality Lanczos resampling

Options:

- `--factor <value>`: Upscale factor from 1 to 8
- `--scale <value>`: Alias for factor
- `--model <name>`: Model identifier (currently passed verbatim if needed)
- `--width <px>`: Explicit output width in pixels
- `--height <px>`: Explicit output height in pixels
- `--output <path>`: Exact output file path

### `compress`

Usage:
```bash
autocli editor image compress [options] <inputPath>
```

Compress an image to a smaller JPEG output

Options:

- `--quality <value>`: JPEG quality from 1 to 100
- `--output <path>`: Exact output file path

### `grayscale`

Usage:
```bash
autocli editor image grayscale [options] <inputPath>
```

Convert an image to grayscale

Options:

- `--output <path>`: Exact output file path

### `blur`

Usage:
```bash
autocli editor image blur [options] <inputPath>
```

Blur an image

Options:

- `--radius <value>`: Blur radius/sigma
- `--output <path>`: Exact output file path

### `sharpen`

Usage:
```bash
autocli editor image sharpen [options] <inputPath>
```

Sharpen an image

Options:

- `--amount <value>`: Sharpen amount
- `--output <path>`: Exact output file path

### `thumbnail`

Usage:
```bash
autocli editor image thumbnail [options] <inputPath>
```

Generate a smaller image thumbnail

Options:

- `--width <px>`: Thumbnail width in pixels
- `--height <px>`: Optional thumbnail height in pixels
- `--output <path>`: Exact output file path

### `strip-metadata`

Usage:
```bash
autocli editor image strip-metadata [options] <inputPath>
```

Write a copy of the image without embedded metadata

Options:

- `--output <path>`: Exact output file path

### `background-remove`

Usage:
```bash
autocli editor image background-remove [options] <inputPath>
```

Remove a near-solid background color and save a transparent PNG

Options:

- `--color <value>`: Background color to key out, e.g. #ffffff or green
- `--similarity <value>`: Color match strength from 0.01 to 1
- `--blend <value>`: Soft edge blend from 0 to 1
- `--output <path>`: Exact output file path

### `watermark`

Usage:
```bash
autocli editor image watermark [options] <inputPath>
```

Overlay a watermark image on top of an image

Options:

- `--watermark <path>`: Watermark image path
- `--position <value>`: Overlay position: top-left, top-right, bottom-left, bottom-right, center
- `--margin <px>`: Overlay margin in pixels
- `--output <path>`: Exact output file path

### `exif`

Usage:
```bash
autocli editor image exif [options] <inputPath>
```

Extract EXIF metadata from an image

No command-specific options.

### `palette`

Usage:
```bash
autocli editor image palette [options] <inputPath>
```

Generate a color palette from an image

Options:

- `--colors <value>`: Number of colors to extract
- `--output <path>`: Exact output file path

### `collage`

Usage:
```bash
autocli editor image collage [options] <inputPaths...>
```

Create a collage grid from multiple images

Options:

- `--layout <name>`: Collage layout: grid, horizontal, vertical
- `--gap <px>`: Gap between images in pixels
- `--output <path>`: Exact output file path

### `capabilities`

Usage:
```bash
autocli editor image capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
