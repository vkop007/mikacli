# Vercel

Generated from the real MikaCLI provider definition and command tree.

- Provider: `vercel`
- Category: `devops`
- Command prefix: `mikacli devops vercel`
- Aliases: none
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Manage Vercel projects and deployments with a saved API token

## Notes

- none

## Fast Start

- `mikacli devops vercel login --token $VERCEL_TOKEN`
- `mikacli devops vercel me`
- `mikacli devops vercel teams`
- `mikacli devops vercel capabilities --json`

## Default Command

Usage:
```bash
mikacli devops vercel [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli devops vercel login [options]
```

Save a Vercel API token for future CLI use

Options:

- `--token <token>`: Vercel access token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
mikacli devops vercel status [options]
```

Check the saved Vercel token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
mikacli devops vercel me [options]
```

Aliases: `account`

Show the current Vercel account summary

Options:

- `--account <name>`: Optional saved connection name to use

### `teams`

Usage:
```bash
mikacli devops vercel teams [options]
```

List Vercel teams available to the token

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum teams to return (default: 20)

### `projects`

Usage:
```bash
mikacli devops vercel projects [options]
```

List Vercel projects

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum projects to return (default: 20)

### `deployments`

Usage:
```bash
mikacli devops vercel deployments [options]
```

Aliases: `deploys`

List recent Vercel deployments, optionally scoped to one project

Options:

- `--account <name>`: Optional saved connection name to use
- `--project <name-or-id>`: Optional project name or project ID to filter by
- `--limit <number>`: Maximum deployments to return (default: 20)

### `capabilities`

Usage:
```bash
mikacli devops vercel capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
