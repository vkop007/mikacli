# Netlify

Generated from the real MikaCLI provider definition and command tree.

- Provider: `netlify`
- Category: `devops`
- Command prefix: `mikacli devops netlify`
- Aliases: none
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Manage Netlify sites, deploys, and DNS with a saved API token

## Notes

- none

## Fast Start

- `mikacli devops netlify login --token $NETLIFY_TOKEN`
- `mikacli devops netlify me`
- `mikacli devops netlify accounts`
- `mikacli devops netlify capabilities --json`

## Default Command

Usage:
```bash
mikacli devops netlify [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli devops netlify login [options]
```

Save a Netlify API token for future CLI use

Options:

- `--token <token>`: Netlify personal access token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
mikacli devops netlify status [options]
```

Check the saved Netlify token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
mikacli devops netlify me [options]
```

Aliases: `account`

Show the current Netlify account summary

Options:

- `--account <name>`: Optional saved connection name to use

### `accounts`

Usage:
```bash
mikacli devops netlify accounts [options]
```

List Netlify accounts available to the token

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum accounts to return (default: 20)

### `sites`

Usage:
```bash
mikacli devops netlify sites [options]
```

List Netlify sites

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum sites to return (default: 20)

### `deploys`

Usage:
```bash
mikacli devops netlify deploys [options]
```

Aliases: `deployments`

List Netlify deploys, optionally scoped to one site

Options:

- `--account <name>`: Optional saved connection name to use
- `--site <name-or-id>`: Optional site name, URL, or site ID to inspect
- `--limit <number>`: Maximum deploys to return (default: 20)

### `dns`

Usage:
```bash
mikacli devops netlify dns [options]
```

Aliases: `zones`

List Netlify DNS zones

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum zones to return (default: 20)

### `capabilities`

Usage:
```bash
mikacli devops netlify capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
