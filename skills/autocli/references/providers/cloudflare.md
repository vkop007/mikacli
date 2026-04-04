# Cloudflare

Generated from the real AutoCLI provider definition and command tree.

- Provider: `cloudflare`
- Category: `devops`
- Command prefix: `autocli devops cloudflare`
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

- `autocli devops cloudflare login --token $CLOUDFLARE_API_TOKEN`
- `autocli devops cloudflare me`
- `autocli devops cloudflare accounts`
- `autocli devops cloudflare capabilities --json`

## Default Command

Usage:
```bash
autocli devops cloudflare [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli devops cloudflare login [options]
```

Save a Cloudflare API token for future CLI use

Options:

- `--token <token>`: Cloudflare API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
autocli devops cloudflare status [options]
```

Check the saved Cloudflare token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
autocli devops cloudflare me [options]
```

Aliases: `account`

Show the current Cloudflare token summary

Options:

- `--account <name>`: Optional saved connection name to use

### `accounts`

Usage:
```bash
autocli devops cloudflare accounts [options]
```

List Cloudflare accounts accessible to the token

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum accounts to return (default: 20)

### `zones`

Usage:
```bash
autocli devops cloudflare zones [options]
```

List Cloudflare zones

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum zones to return (default: 20)

### `dns`

Usage:
```bash
autocli devops cloudflare dns [options] <zone>
```

Aliases: `records`

List DNS records for a Cloudflare zone name or zone ID

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum records to return (default: 20)

### `capabilities`

Usage:
```bash
autocli devops cloudflare capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
