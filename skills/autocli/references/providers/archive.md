# Archive Editor

Generated from the real AutoCLI provider definition and command tree.

- Provider: `archive`
- Category: `editor`
- Command prefix: `autocli editor archive`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Create, inspect, and extract archive files

## Notes

- none

## Fast Start

- `autocli editor archive info ./bundle.zip`
- `autocli editor archive list ./bundle.zip`
- `autocli editor archive create ./bundle.zip ./dist ./README.md`
- `autocli editor archive capabilities --json`

## Default Command

Usage:
```bash
autocli editor archive [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli editor archive info [options] <inputPath>
```

Inspect a local archive

No command-specific options.

### `list`

Usage:
```bash
autocli editor archive list [options] <inputPath>
```

List entries inside an archive

No command-specific options.

### `create`

Usage:
```bash
autocli editor archive create [options] <outputPath> <inputPaths...>
```

Create a zip, tar, tar.gz, tgz, gz, or 7z archive

Options:

- `--format <format>`: Archive format override: zip, tar, tar.gz, tgz, gz, 7z

### `extract`

Usage:
```bash
autocli editor archive extract [options] <inputPath>
```

Extract an archive

Options:

- `--output-dir <path>`: Directory to extract into

### `gzip`

Usage:
```bash
autocli editor archive gzip [options] <inputPath>
```

Compress a single file to .gz

Options:

- `--output <path>`: Exact output file path

### `gunzip`

Usage:
```bash
autocli editor archive gunzip [options] <inputPath>
```

Decompress a .gz file

Options:

- `--output <path>`: Exact output file path

### `capabilities`

Usage:
```bash
autocli editor archive capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
