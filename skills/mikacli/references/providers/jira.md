# Jira

Generated from the real MikaCLI provider definition and command tree.

- Provider: `jira`
- Category: `developer`
- Command prefix: `mikacli developer jira`
- Aliases: none
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Use a saved Jira web session to inspect projects and issues on your workspace site

## Notes

- none

## Fast Start

- `mikacli developer jira login --site https://your-workspace.atlassian.net`
- `mikacli developer jira login --cookies ./jira.cookies.json --site https://your-workspace.atlassian.net`
- `mikacli developer jira me`
- `mikacli developer jira capabilities --json`

## Default Command

Usage:
```bash
mikacli developer jira [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli developer jira login [options]
```

Save the Jira web session for future CLI use. With no auth flags, MikaCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)
- `--site <url>`: Jira site URL, like https://your-workspace.atlassian.net

### `status`

Usage:
```bash
mikacli developer jira status [options]
```

Show the saved Jira session status

Options:

- `--account <name>`: Optional saved Jira session name to inspect

### `me`

Usage:
```bash
mikacli developer jira me [options]
```

Aliases: `whoami`

Load the authenticated Jira account

No command-specific options.

### `projects`

Usage:
```bash
mikacli developer jira projects [options] [query]
```

List Jira projects for the authenticated account

Options:

- `--limit <number>`: Maximum projects to load (default: 20)

### `project`

Usage:
```bash
mikacli developer jira project [options] <target>
```

Load a single Jira project by key, ID, or URL

No command-specific options.

### `issues`

Usage:
```bash
mikacli developer jira issues [options] [project]
```

List Jira issues for a project or JQL query

Options:

- `--jql <query>`: Explicit JQL query instead of a project filter
- `--state <value>`: Convenience filter when using project mode: open, closed, all
- `--limit <number>`: Maximum issues to load (default: 20)

### `issue`

Usage:
```bash
mikacli developer jira issue [options] <target>
```

Load a single Jira issue by key or URL

No command-specific options.

### `create-issue`

Usage:
```bash
mikacli developer jira create-issue [options] <project>
```

Create a Jira issue in a project you can write to

Options:

- `--summary <text>`: Issue summary
- `--description <text>`: Issue description
- `--type <name>`: Preferred issue type name, like Task or Bug

### `capabilities`

Usage:
```bash
mikacli developer jira capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
