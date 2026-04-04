# Linear

Generated from the real AutoCLI provider definition and command tree.

- Provider: `linear`
- Category: `developer`
- Command prefix: `autocli developer linear`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Use a saved Linear web session to inspect teams, projects, and issues

## Notes

- none

## Fast Start

- `autocli developer linear login --cookies ./linear.cookies.json`
- `autocli developer linear me`
- `autocli developer linear teams`
- `autocli developer linear capabilities --json`

## Default Command

Usage:
```bash
autocli developer linear [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli developer linear login [options]
```

Import cookies and save the Linear web session for future CLI use

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `me`

Usage:
```bash
autocli developer linear me [options]
```

Aliases: `whoami`

Load the authenticated Linear web identity

No command-specific options.

### `teams`

Usage:
```bash
autocli developer linear teams [options]
```

List Linear teams

Options:

- `--limit <number>`: Maximum teams to return (default: 20)

### `projects`

Usage:
```bash
autocli developer linear projects [options]
```

List Linear projects

Options:

- `--limit <number>`: Maximum projects to return (default: 20)

### `issues`

Usage:
```bash
autocli developer linear issues [options]
```

List Linear issues

Options:

- `--team <team-id-or-key>`: Filter issues by team id, key, or name
- `--limit <number>`: Maximum issues to return (default: 20)

### `issue`

Usage:
```bash
autocli developer linear issue [options] <id-or-key>
```

Load a single Linear issue by id, issue key, or issue URL

No command-specific options.

### `create-issue`

Usage:
```bash
autocli developer linear create-issue [options]
```

Create a new Linear issue in a team

Options:

- `--team <team-id-or-key>`: Target team id, key, or name
- `--title <text>`: Issue title
- `--description <text>`: Issue description markdown

### `update-issue`

Usage:
```bash
autocli developer linear update-issue [options] <id-or-key>
```

Update a Linear issue title, description, or state

Options:

- `--title <text>`: New issue title
- `--description <text>`: New issue description markdown
- `--state-id <id>`: Move the issue to a different state

### `comment`

Usage:
```bash
autocli developer linear comment [options] <id-or-key>
```

Add a comment to a Linear issue

Options:

- `--body <text>`: Comment body markdown

### `capabilities`

Usage:
```bash
autocli developer linear capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
