# PDF Editor

Generated from the real AutoCLI provider definition and command tree.

- Provider: `pdf`
- Category: `editor`
- Command prefix: `autocli editor pdf`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Edit local PDF files using qpdf and pdf-lib

## Notes

- none

## Fast Start

- `autocli editor pdf info ./document.pdf`
- `autocli editor pdf merge ./out.pdf ./a.pdf ./b.pdf`
- `autocli editor pdf split ./book.pdf --output-dir ./pages`
- `autocli editor pdf capabilities --json`

## Default Command

Usage:
```bash
autocli editor pdf [command]
```

No root-only options.


## Commands

### `info`

Usage:
```bash
autocli editor pdf info [options] <inputPath>
```

Inspect a local PDF

No command-specific options.

### `merge`

Usage:
```bash
autocli editor pdf merge [options] <outputPath> <inputPaths...>
```

Merge multiple PDFs into a single output

No command-specific options.

### `split`

Usage:
```bash
autocli editor pdf split [options] <inputPath>
```

Split a local PDF into page PDFs

Options:

- `--from <page>`: First page to split
- `--to <page>`: Last page to split
- `--output-dir <path>`: Directory to write split pages into
- `--prefix <name>`: Filename prefix for split pages

### `to-images`

Usage:
```bash
autocli editor pdf to-images [options] <inputPath>
```

Render a PDF into page images

Options:

- `--output-dir <path>`: Directory to write page images into
- `--prefix <name>`: Filename prefix for rendered page images
- `--format <value>`: Output image format: png or jpg
- `--size <pixels>`: Target preview/render size in pixels

### `extract-pages`

Usage:
```bash
autocli editor pdf extract-pages [options] <inputPath>
```

Extract selected pages from a local PDF

Options:

- `--pages <spec>`: Comma-separated page spec like 1,3-5
- `--output <path>`: Output PDF path

### `remove-pages`

Usage:
```bash
autocli editor pdf remove-pages [options] <inputPath>
```

Create a new PDF without the selected pages

Options:

- `--pages <spec>`: Comma-separated page spec like 1,3-5
- `--output <path>`: Output PDF path

### `metadata`

Usage:
```bash
autocli editor pdf metadata [options] <inputPath>
```

Inspect or update PDF metadata

Options:

- `--output <path>`: Output PDF path
- `--title <value>`: Metadata title
- `--author <value>`: Metadata author
- `--subject <value>`: Metadata subject
- `--keywords <values>`: Comma-separated metadata keywords
- `--creator <value>`: Metadata creator
- `--producer <value>`: Metadata producer
- `--creation-date <value>`: Metadata creation date (ISO-8601 or parseable date)
- `--modification-date <value>`: Metadata modification date (ISO-8601 or parseable date)

### `rotate`

Usage:
```bash
autocli editor pdf rotate [options] <inputPath>
```

Rotate pages in a local PDF using qpdf

Options:

- `--angle <degrees>`: Rotation angle, in multiples of 90
- `--pages <spec>`: Optional page spec like 1,3-5 or 1-3
- `--output <path>`: Output PDF path

### `reorder-pages`

Usage:
```bash
autocli editor pdf reorder-pages [options] <inputPath>
```

Create a new PDF with pages reordered into a custom sequence

Options:

- `--pages <spec>`: Page order like 3,1-2,5
- `--output <path>`: Output PDF path

### `watermark`

Usage:
```bash
autocli editor pdf watermark [options] <inputPath>
```

Apply a diagonal text watermark to a PDF

Options:

- `--text <value>`: Watermark text
- `--pages <spec>`: Optional page spec like 1,3-5
- `--opacity <value>`: Watermark opacity from 0.05 to 1
- `--size <value>`: Watermark font size
- `--color <value>`: Watermark color as #RRGGBB
- `--rotation <degrees>`: Watermark rotation in degrees
- `--output <path>`: Output PDF path

### `encrypt`

Usage:
```bash
autocli editor pdf encrypt [options] <inputPath>
```

Encrypt a local PDF using qpdf

Options:

- `--output <path>`: Output PDF path
- `--user-password <password>`: Password used to open the PDF
- `--owner-password <password>`: Password used for the PDF owner
- `--bits <bits>`: Encryption strength: 40, 128, or 256

### `decrypt`

Usage:
```bash
autocli editor pdf decrypt [options] <inputPath>
```

Decrypt a local PDF using qpdf

Options:

- `--output <path>`: Output PDF path
- `--password <password>`: Password for opening the encrypted PDF

### `optimize`

Usage:
```bash
autocli editor pdf optimize [options] <inputPath>
```

Aliases: `compress`

Optimize/compress a local PDF using qpdf

Options:

- `--output <path>`: Output PDF path

### `capabilities`

Usage:
```bash
autocli editor pdf capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
