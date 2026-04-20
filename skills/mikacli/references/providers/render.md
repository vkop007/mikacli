# Render

Generated from the real MikaCLI provider definition and command tree.

- Provider: `render`
- Category: `devops`
- Command prefix: `mikacli devops render`
- Aliases: none
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect Render services, projects, and environment groups with a saved API token

## Notes

- none

## Fast Start

- `mikacli devops render login --token $RENDER_API_KEY`
- `mikacli devops render me`
- `mikacli devops render services`
- `mikacli devops render capabilities --json`

## Default Command

Usage:
```bash
mikacli devops render [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli devops render login [options]
```

Save a Render API token for future CLI use

Options:

- `--token <token>`: Render API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
mikacli devops render status [options]
```

Check the saved Render token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
mikacli devops render me [options]
```

Aliases: `account`

Show the current Render account summary

Options:

- `--account <name>`: Optional saved connection name to use

### `services`

Usage:
```bash
mikacli devops render services [options]
```

List Render services

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum services to return (default: 20)

### `projects`

Usage:
```bash
mikacli devops render projects [options]
```

List Render projects

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum projects to return (default: 20)

### `env-groups`

Usage:
```bash
mikacli devops render env-groups [options]
```

Aliases: `envgroups`

List Render environment groups

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum groups to return (default: 20)

### `capabilities`

Usage:
```bash
mikacli devops render capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
