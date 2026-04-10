# GitLab

Generated from the real AutoCLI provider definition and command tree.

- Provider: `gitlab`
- Category: `developer`
- Command prefix: `autocli developer gitlab`
- Aliases: `gl`
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Use a saved GitLab web session to inspect projects, issues, and merge requests

## Notes

- none

## Fast Start

- `autocli developer gitlab login`
- `autocli developer gitlab login --cookies ./gitlab.cookies.json`
- `autocli developer gitlab login --cookies ./gitlab.cookies.json --account work`
- `autocli developer gitlab capabilities --json`

## Default Command

Usage:
```bash
autocli developer gitlab [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli developer gitlab login [options]
```

Save the GitLab web session for future CLI use. With no auth flags, AutoCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `status`

Usage:
```bash
autocli developer gitlab status [options]
```

Show the saved GitLab session status

Options:

- `--account <name>`: Optional saved GitLab session name to inspect

### `me`

Usage:
```bash
autocli developer gitlab me [options]
```

Aliases: `whoami`

Load the authenticated GitLab account

No command-specific options.

### `projects`

Usage:
```bash
autocli developer gitlab projects [options] [query]
```

List GitLab projects for the authenticated account

Options:

- `--limit <number>`: Maximum projects to load (default: 20)

### `project`

Usage:
```bash
autocli developer gitlab project [options] <target>
```

Load a single GitLab project by ID, path, or URL

No command-specific options.

### `search-projects`

Usage:
```bash
autocli developer gitlab search-projects [options] <query>
```

Aliases: `search`

Search GitLab projects

Options:

- `--limit <number>`: Maximum projects to return (default: 20)

### `issues`

Usage:
```bash
autocli developer gitlab issues [options] <project>
```

List issues for a GitLab project

Options:

- `--state <value>`: Issue state: opened, closed, all
- `--limit <number>`: Maximum issues to load (default: 20)

### `issue`

Usage:
```bash
autocli developer gitlab issue [options] <project> <iid>
```

Load a single GitLab issue

No command-specific options.

### `create-issue`

Usage:
```bash
autocli developer gitlab create-issue [options] <project>
```

Create a GitLab issue in a project you can write to

Options:

- `--title <text>`: Issue title
- `--body <text>`: Issue description markdown

### `merge-requests`

Usage:
```bash
autocli developer gitlab merge-requests [options] <project>
```

List merge requests for a GitLab project

Options:

- `--state <value>`: Merge request state: opened, closed, locked, all
- `--limit <number>`: Maximum merge requests to load (default: 20)

### `merge-request`

Usage:
```bash
autocli developer gitlab merge-request [options] <project> <iid>
```

Load a single GitLab merge request

No command-specific options.

### `capabilities`

Usage:
```bash
autocli developer gitlab capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
