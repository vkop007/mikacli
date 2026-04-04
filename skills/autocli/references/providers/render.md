# Render

Generated from the real AutoCLI provider definition and command tree.

- Provider: `render`
- Category: `devops`
- Command prefix: `autocli devops render`
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

- `autocli devops render login --token $RENDER_API_KEY`
- `autocli devops render me`
- `autocli devops render services`
- `autocli devops render capabilities --json`

## Default Command

Usage:
```bash
autocli devops render [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli devops render login [options]
```

Save a Render API token for future CLI use

Options:

- `--token <token>`: Render API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
autocli devops render status [options]
```

Check the saved Render token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
autocli devops render me [options]
```

Aliases: `account`

Show the current Render account summary

Options:

- `--account <name>`: Optional saved connection name to use

### `services`

Usage:
```bash
autocli devops render services [options]
```

List Render services

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum services to return (default: 20)

### `projects`

Usage:
```bash
autocli devops render projects [options]
```

List Render projects

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum projects to return (default: 20)

### `env-groups`

Usage:
```bash
autocli devops render env-groups [options]
```

Aliases: `envgroups`

List Render environment groups

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum groups to return (default: 20)

### `capabilities`

Usage:
```bash
autocli devops render capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
