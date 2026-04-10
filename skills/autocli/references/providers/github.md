# GitHub

Generated from the real AutoCLI provider definition and command tree.

- Provider: `github`
- Category: `developer`
- Command prefix: `autocli developer github`
- Aliases: `gh`
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Use a saved GitHub web session to inspect repos, issues, and repository metadata

## Notes

- Uses a saved GitHub web session for browserless repository automation.

## Fast Start

- `autocli developer github login`
- `autocli developer github login --cookies ./github.cookies.json`
- `autocli developer github me`
- `autocli developer github capabilities --json`

## Default Command

Usage:
```bash
autocli developer github [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli developer github login [options]
```

Save the GitHub web session for future CLI use. With no auth flags, AutoCLI opens browser login by default

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
autocli developer github status [options]
```

Show the saved GitHub session status

Options:

- `--account <name>`: Optional saved GitHub session name to inspect

### `me`

Usage:
```bash
autocli developer github me [options]
```

Aliases: `whoami`

Load the authenticated GitHub account

No command-specific options.

### `user`

Usage:
```bash
autocli developer github user [options] <login>
```

Load a public GitHub user profile

No command-specific options.

### `repos`

Usage:
```bash
autocli developer github repos [options] [owner]
```

List GitHub repositories for the authenticated account or for a public owner

Options:

- `--limit <number>`: Maximum repositories to load (default: 30)
- `--sort <value>`: Sort order: created, updated, pushed, full_name
- `--type <value>`: Authenticated repo type: all, owner, public, private, member

### `repo`

Usage:
```bash
autocli developer github repo [options] <target>
```

Load a single GitHub repository by owner/repo or GitHub URL

No command-specific options.

### `search-repos`

Usage:
```bash
autocli developer github search-repos [options] <query>
```

Aliases: `search`

Search GitHub repositories

Options:

- `--limit <number>`: Maximum repositories to return (default: 20)
- `--sort <value>`: Sort search results by stars, forks, help-wanted-issues, updated
- `--order <value>`: Sort order: desc or asc

### `starred`

Usage:
```bash
autocli developer github starred [options] [owner]
```

List starred GitHub repositories for the authenticated account or a public user

Options:

- `--limit <number>`: Maximum repositories to load (default: 30)
- `--sort <value>`: Sort order: created or updated
- `--direction <value>`: Direction: asc or desc

### `branches`

Usage:
```bash
autocli developer github branches [options] <repo>
```

List branches for a GitHub repository

Options:

- `--limit <number>`: Maximum branches to load (default: 30)

### `branch`

Usage:
```bash
autocli developer github branch [options] <repo> <branch>
```

Load a single branch for a GitHub repository

No command-specific options.

### `issues`

Usage:
```bash
autocli developer github issues [options] <repo>
```

List issues for a GitHub repository

Options:

- `--state <value>`: Issue state: open, closed, all
- `--limit <number>`: Maximum issues to load (default: 20)

### `issue`

Usage:
```bash
autocli developer github issue [options] <repo> <number>
```

Load a single GitHub issue

No command-specific options.

### `pulls`

Usage:
```bash
autocli developer github pulls [options] <repo>
```

List pull requests for a GitHub repository

Options:

- `--state <value>`: Pull request state: open, closed, all
- `--limit <number>`: Maximum pull requests to load (default: 20)
- `--sort <value>`: Sort order: created, updated, popularity, long-running
- `--direction <value>`: Direction: asc or desc

### `pull`

Usage:
```bash
autocli developer github pull [options] <repo> <number>
```

Load a single GitHub pull request

No command-specific options.

### `releases`

Usage:
```bash
autocli developer github releases [options] <repo>
```

List releases for a GitHub repository

Options:

- `--limit <number>`: Maximum releases to load (default: 20)

### `readme`

Usage:
```bash
autocli developer github readme [options] <repo>
```

Load and decode the README from a GitHub repository

No command-specific options.

### `create-issue`

Usage:
```bash
autocli developer github create-issue [options] <repo>
```

Create a GitHub issue in a repository you can write to

Options:

- `--title <text>`: Issue title
- `--body <text>`: Issue body markdown

### `comment`

Usage:
```bash
autocli developer github comment [options] <repo> <number>
```

Add a comment to a GitHub issue

Options:

- `--body <text>`: Comment body markdown

### `create-repo`

Usage:
```bash
autocli developer github create-repo [options] <name>
```

Create a new repository for the authenticated GitHub account

Options:

- `--description <text>`: Repository description
- `--homepage <url>`: Repository homepage URL
- `--private`: Create the repository as private
- `--auto-init`: Initialize the repository with a README

### `fork`

Usage:
```bash
autocli developer github fork [options] <repo>
```

Create a fork of a GitHub repository

No command-specific options.

### `star`

Usage:
```bash
autocli developer github star [options] <repo>
```

Star a GitHub repository

No command-specific options.

### `unstar`

Usage:
```bash
autocli developer github unstar [options] <repo>
```

Remove the star from a GitHub repository

No command-specific options.

### `capabilities`

Usage:
```bash
autocli developer github capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
