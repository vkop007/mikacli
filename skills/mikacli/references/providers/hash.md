# Hash & Encoding

Generated from the real MikaCLI provider definition and command tree.

- Provider: `hash`
- Category: `tools`
- Command prefix: `mikacli tools hash`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Hash, sign, encode, and generate secrets offline

## Notes

- none

## Fast Start

- `mikacli tools hash digest "hello world"`
- `mikacli tools hash digest --file ./dist/app.js --alg sha512`
- `mikacli tools hash hmac "payload" --secret my-key --encoding base64`
- `mikacli tools hash capabilities --json`

## Default Command

Usage:
```bash
mikacli tools hash [command]
```

No root-only options.


## Commands

### `digest`

Usage:
```bash
mikacli tools hash digest [options] [text...]
```

Aliases: `hash`, `sum`

Hash text or a file with any supported algorithm

Options:

- `--alg <algorithm>`: Hash algorithm (default: sha256)
- `--file <path>`: Hash a file instead of text
- `--encoding <encoding>`: Digest encoding: hex, base64, base64url (default: hex)

### `hmac`

Usage:
```bash
mikacli tools hash hmac [options] [text...]
```

Compute an HMAC signature for text or a file

Options:

- `--secret <key>`: Shared secret used as the HMAC key
- `--key-file <path>`: Read the HMAC key from a file
- `--alg <algorithm>`: Hash algorithm (default: sha256)
- `--file <path>`: Sign a file instead of text
- `--encoding <encoding>`: Digest encoding: hex, base64, base64url (default: hex)

### `verify`

Usage:
```bash
mikacli tools hash verify [options] <expected> [text...]
```

Check text or a file against an expected checksum

Options:

- `--file <path>`: Verify a file instead of text
- `--alg <algorithm>`: Hash algorithm (inferred from the checksum length by default)

### `encode`

Usage:
```bash
mikacli tools hash encode [options] <value>
```

Convert a value between utf8, base64, base64url, hex, and url encodings

Options:

- `--from <encoding>`: Input encoding (default: utf8)
- `--to <encoding>`: Output encoding (default: base64)

### `uuid`

Usage:
```bash
mikacli tools hash uuid [options]
```

Generate v4 or time-ordered v7 UUIDs

Options:

- `--count <number>`: How many UUIDs to generate (default: 1)
- `--uuid-version <number>`: UUID version: 4 or 7 (default: 4)

### `random`

Usage:
```bash
mikacli tools hash random [options]
```

Aliases: `secret`

Generate cryptographically random secrets

Options:

- `--bytes <number>`: Entropy per value in bytes (default: 32)
- `--count <number>`: How many values to generate (default: 1)
- `--encoding <encoding>`: Output encoding: hex, base64, base64url (default: hex)

### `algorithms`

Usage:
```bash
mikacli tools hash algorithms [options]
```

Aliases: `algs`

List the hash algorithms available on this runtime

No command-specific options.

### `capabilities`

Usage:
```bash
mikacli tools hash capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
