# Supabase

Generated from the real AutoCLI provider definition and command tree.

- Provider: `supabase`
- Category: `devops`
- Command prefix: `autocli devops supabase`
- Aliases: none
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect Supabase organizations, projects, and Edge Functions with a saved management token

## Notes

- none

## Fast Start

- `autocli devops supabase login --token $SUPABASE_ACCESS_TOKEN`
- `autocli devops supabase me`
- `autocli devops supabase organizations`
- `autocli devops supabase capabilities --json`

## Default Command

Usage:
```bash
autocli devops supabase [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli devops supabase login [options]
```

Save a Supabase management token for future CLI use

Options:

- `--token <token>`: Supabase management token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
autocli devops supabase status [options]
```

Check the saved Supabase token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
autocli devops supabase me [options]
```

Aliases: `account`

Show the current Supabase workspace summary

Options:

- `--account <name>`: Optional saved connection name to use

### `organizations`

Usage:
```bash
autocli devops supabase organizations [options]
```

Aliases: `orgs`

List Supabase organizations visible to the token

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum organizations to return (default: 20)

### `projects`

Usage:
```bash
autocli devops supabase projects [options]
```

List Supabase projects, optionally filtered by organization ID

Options:

- `--account <name>`: Optional saved connection name to use
- `--organization <id>`: Optional organization ID to filter by
- `--limit <number>`: Maximum projects to return (default: 20)

### `functions`

Usage:
```bash
autocli devops supabase functions [options] <project>
```

Aliases: `edge-functions`

List Supabase Edge Functions for a project name, ref, or ID

Options:

- `--account <name>`: Optional saved connection name to use

### `capabilities`

Usage:
```bash
autocli devops supabase capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
