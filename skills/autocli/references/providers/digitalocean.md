# DigitalOcean

Generated from the real AutoCLI provider definition and command tree.

- Provider: `digitalocean`
- Category: `devops`
- Command prefix: `autocli devops digitalocean`
- Aliases: none
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect DigitalOcean App Platform apps, deployments, and domains with a saved API token

## Notes

- none

## Fast Start

- `autocli devops digitalocean login --token $DIGITALOCEAN_TOKEN`
- `autocli devops digitalocean me`
- `autocli devops digitalocean apps`
- `autocli devops digitalocean capabilities --json`

## Default Command

Usage:
```bash
autocli devops digitalocean [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli devops digitalocean login [options]
```

Save a DigitalOcean API token for future CLI use

Options:

- `--token <token>`: DigitalOcean API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
autocli devops digitalocean status [options]
```

Check the saved DigitalOcean token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
autocli devops digitalocean me [options]
```

Aliases: `account`

Show the current DigitalOcean account summary

Options:

- `--account <name>`: Optional saved connection name to use

### `apps`

Usage:
```bash
autocli devops digitalocean apps [options]
```

List DigitalOcean App Platform apps

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum apps to return (default: 20)

### `deployments`

Usage:
```bash
autocli devops digitalocean deployments [options] <app>
```

Aliases: `deploys`

List DigitalOcean deployments for an app name or app ID

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum deployments to return (default: 20)

### `domains`

Usage:
```bash
autocli devops digitalocean domains [options]
```

List DigitalOcean domains

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum domains to return (default: 20)

### `capabilities`

Usage:
```bash
autocli devops digitalocean capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
