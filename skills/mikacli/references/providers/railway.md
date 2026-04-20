# Railway

Generated from the real MikaCLI provider definition and command tree.

- Provider: `railway`
- Category: `devops`
- Command prefix: `mikacli devops railway`
- Aliases: none
- Auth: `apiKey`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect Railway account, project, and service data with a saved API token

## Notes

- Uses Railway's GraphQL surface, so some deeper actions may still be added later.

## Fast Start

- `mikacli devops railway login --token $RAILWAY_TOKEN`
- `mikacli devops railway me`
- `mikacli devops railway projects`
- `mikacli devops railway capabilities --json`

## Default Command

Usage:
```bash
mikacli devops railway [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli devops railway login [options]
```

Save a Railway token for future CLI use

Options:

- `--token <token>`: Railway API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
mikacli devops railway status [options]
```

Check the saved Railway token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
mikacli devops railway me [options]
```

Aliases: `account`

Show the current Railway account summary

Options:

- `--account <name>`: Optional saved connection name to use

### `projects`

Usage:
```bash
mikacli devops railway projects [options]
```

List Railway projects

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum projects to return (default: 20)

### `project`

Usage:
```bash
mikacli devops railway project [options] <id>
```

Load a Railway project by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `service`

Usage:
```bash
mikacli devops railway service [options] <id>
```

Load a Railway service by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `capabilities`

Usage:
```bash
mikacli devops railway capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
