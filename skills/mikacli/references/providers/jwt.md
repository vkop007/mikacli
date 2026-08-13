# JWT Analyzer

Generated from the real MikaCLI provider definition and command tree.

- Provider: `jwt`
- Category: `tools`
- Command prefix: `mikacli tools jwt`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unknown`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Decode and inspect JSON Web Tokens offline

## Notes

- none

## Fast Start

- `mikacli tools jwt decode <token>`
- `mikacli tools jwt verify <token> --secret <key>`
- `mikacli tools jwt sign --payload <json> --secret <key>`
- `mikacli tools jwt capabilities --json`

## Default Command

Usage:
```bash
mikacli tools jwt [command]
```

No root-only options.


## Commands

### `decode`

Usage:
```bash
mikacli tools jwt decode [options] <token>
```

No description.

No command-specific options.

### `verify`

Usage:
```bash
mikacli tools jwt verify [options] <token>
```

No description.

Options:

- `--secret <key>`: HMAC secret or RSA public key string
- `--key-file <path>`: Path to public key file

### `sign`

Usage:
```bash
mikacli tools jwt sign [options]
```

No description.

Options:

- `--payload <json>`: JSON payload string
- `--secret <key>`: HMAC secret or RSA private key string
- `--key-file <path>`: Path to private key file
- `--alg <algorithm>`: Signing algorithm (default: HS256)
- `--exp <duration>`: Expiration time duration (e.g. 1h, 1d)

### `audit`

Usage:
```bash
mikacli tools jwt audit [options] <token>
```

No description.

No command-specific options.

### `capabilities`

Usage:
```bash
mikacli tools jwt capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
