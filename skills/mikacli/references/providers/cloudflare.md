# Cloudflare

Generated from the real MikaCLI provider definition and command tree.

- Provider: `cloudflare`
- Category: `devops`
- Command prefix: `mikacli devops cloudflare`
- Aliases: none
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Manage Cloudflare zones and DNS with a saved API token

## Notes

- none

## Fast Start

- `mikacli devops cloudflare login --token $CLOUDFLARE_API_TOKEN`
- `mikacli devops cloudflare me`
- `mikacli devops cloudflare accounts`
- `mikacli devops cloudflare capabilities --json`

## Default Command

Usage:
```bash
mikacli devops cloudflare [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli devops cloudflare login [options]
```

Save a Cloudflare API token for future CLI use

Options:

- `--token <token>`: Cloudflare API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
mikacli devops cloudflare status [options]
```

Check the saved Cloudflare token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
mikacli devops cloudflare me [options]
```

Aliases: `account`

Show the current Cloudflare token summary

Options:

- `--account <name>`: Optional saved connection name to use

### `accounts`

Usage:
```bash
mikacli devops cloudflare accounts [options]
```

List Cloudflare accounts accessible to the token

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum accounts to return (default: 20)

### `zones`

Usage:
```bash
mikacli devops cloudflare zones [options]
```

List Cloudflare zones

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum zones to return (default: 20)

### `dns`

Usage:
```bash
mikacli devops cloudflare dns [options] <zone>
```

Aliases: `records`

List DNS records for a Cloudflare zone name or zone ID

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum records to return (default: 20)

### `capabilities`

Usage:
```bash
mikacli devops cloudflare capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
