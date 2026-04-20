# Fly.io

Generated from the real MikaCLI provider definition and command tree.

- Provider: `fly`
- Category: `devops`
- Command prefix: `mikacli devops fly`
- Aliases: none
- Auth: `apiKey`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect Fly Machines apps, machines, volumes, and certificates with a saved API token

## Notes

- Org-aware app listing may require an explicit --org slug for some tokens.

## Fast Start

- `mikacli devops fly login --token $FLY_API_TOKEN`
- `mikacli devops fly apps --org personal`
- `mikacli devops fly app my-app`
- `mikacli devops fly capabilities --json`

## Default Command

Usage:
```bash
mikacli devops fly [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli devops fly login [options]
```

Save a Fly Machines API token for future CLI use

Options:

- `--token <token>`: Fly API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
mikacli devops fly status [options]
```

Check the saved Fly token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
mikacli devops fly me [options]
```

Aliases: `account`

Show the saved Fly org context and cached app summary

Options:

- `--account <name>`: Optional saved connection name to use

### `apps`

Usage:
```bash
mikacli devops fly apps [options]
```

List Fly apps for an organization slug

Options:

- `--account <name>`: Optional saved connection name to use
- `--org <slug>`: Organization slug to inspect (defaults to saved org or personal)
- `--limit <number>`: Maximum apps to return (default: 20)

### `app`

Usage:
```bash
mikacli devops fly app [options] <name>
```

Load a Fly app by name

Options:

- `--account <name>`: Optional saved connection name to use

### `machines`

Usage:
```bash
mikacli devops fly machines [options] <app>
```

List Fly Machines for an app

Options:

- `--account <name>`: Optional saved connection name to use

### `volumes`

Usage:
```bash
mikacli devops fly volumes [options] <app>
```

List Fly volumes for an app

Options:

- `--account <name>`: Optional saved connection name to use

### `certificates`

Usage:
```bash
mikacli devops fly certificates [options] <app>
```

Aliases: `certs`

List Fly certificates for an app

Options:

- `--account <name>`: Optional saved connection name to use

### `capabilities`

Usage:
```bash
mikacli devops fly capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
