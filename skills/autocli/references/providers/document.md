# Document Editor

Generated from the real AutoCLI provider definition and command tree.

- Provider: `document`
- Category: `editor`
- Command prefix: `autocli editor document`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Convert documents, extract text, and inspect metadata

## Notes

- none

## Fast Start

- `autocli editor document info ./notes.docx`
- `autocli editor document convert ./notes.docx --to txt`
- `autocli editor document extract-text ./notes.docx`
- `autocli editor document capabilities --json`

## Default Command

Usage:
```bash
autocli editor document [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli editor document info [options] <inputPath>
```

Inspect a local document

No command-specific options.

### `convert`

Usage:
```bash
autocli editor document convert [options] <inputPath>
```

Convert a local document to another format

Options:

- `--to <format>`: Target format: txt, rtf, rtfd, html, doc, docx, odt, wordml, webarchive, md
- `--output <path>`: Exact output file path

### `extract-text`

Usage:
```bash
autocli editor document extract-text [options] <inputPath>
```

Extract plain text from a local document

Options:

- `--output <path>`: Exact output file path

### `ocr`

Usage:
```bash
autocli editor document ocr [options] <inputPath>
```

Extract text from a scanned document using OCR, with native extraction fallback when possible

Options:

- `--output <path>`: Exact output file path
- `--language <code>`: Tesseract language code
- `--psm <number>`: Tesseract page segmentation mode

### `to-markdown`

Usage:
```bash
autocli editor document to-markdown [options] <inputPath>
```

Extract document text and save it as Markdown

Options:

- `--output <path>`: Exact output file path

### `metadata`

Usage:
```bash
autocli editor document metadata [options] <inputPath>
```

Inspect metadata for a local document

No command-specific options.

### `capabilities`

Usage:
```bash
autocli editor document capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
