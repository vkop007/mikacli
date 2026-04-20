# GitHub Bot

Generated from the real MikaCLI provider definition and command tree.

- Provider: `githubbot`
- Category: `bot`
- Command prefix: `mikacli bot githubbot`
- Aliases: `ghbot`
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Use a saved GitHub App or bot token to inspect repos, issues, pull requests, and repository metadata

## Notes

- none

## Fast Start

- `mikacli bot githubbot login --token <github-app-or-bot-token>`
- `mikacli bot githubbot me`
- `mikacli bot githubbot user openai`
- `mikacli bot githubbot capabilities --json`

## Default Command

Usage:
```bash
mikacli bot githubbot [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli bot githubbot login [options]
```

Save a GitHub Bot token for future API calls

Options:

- `--token <token>`: GitHub Bot token
- `--account <name>`: Optional saved alias instead of the detected GitHub account

### `status`

Usage:
```bash
mikacli bot githubbot status [options]
```

Show the saved GitHub Bot connection status

Options:

- `--account <name>`: Optional saved GitHub Bot connection name to inspect

### `me`

Usage:
```bash
mikacli bot githubbot me [options]
```

Aliases: `whoami`

Load the authenticated GitHub Bot account

No command-specific options.

### `user`

Usage:
```bash
mikacli bot githubbot user [options] <login>
```

Load a public GitHub Bot user profile

No command-specific options.

### `repos`

Usage:
```bash
mikacli bot githubbot repos [options] [owner]
```

List GitHub Bot repositories for the authenticated account or for a public owner

Options:

- `--limit <number>`: Maximum repositories to load (default: 30)
- `--sort <value>`: Sort order: created, updated, pushed, full_name
- `--type <value>`: Authenticated repo type: all, owner, public, private, member

### `repo`

Usage:
```bash
mikacli bot githubbot repo [options] <target>
```

Load a single GitHub Bot repository by owner/repo or GitHub URL

No command-specific options.

### `search-repos`

Usage:
```bash
mikacli bot githubbot search-repos [options] <query>
```

Aliases: `search`

Search GitHub Bot repositories

Options:

- `--limit <number>`: Maximum repositories to return (default: 20)
- `--sort <value>`: Sort search results by stars, forks, help-wanted-issues, updated
- `--order <value>`: Sort order: desc or asc

### `starred`

Usage:
```bash
mikacli bot githubbot starred [options] [owner]
```

List starred GitHub Bot repositories for the authenticated account or a public user

Options:

- `--limit <number>`: Maximum repositories to load (default: 30)
- `--sort <value>`: Sort order: created or updated
- `--direction <value>`: Direction: asc or desc

### `branches`

Usage:
```bash
mikacli bot githubbot branches [options] <repo>
```

List branches for a GitHub Bot repository

Options:

- `--limit <number>`: Maximum branches to load (default: 30)

### `branch`

Usage:
```bash
mikacli bot githubbot branch [options] <repo> <branch>
```

Load a single branch for a GitHub Bot repository

No command-specific options.

### `issues`

Usage:
```bash
mikacli bot githubbot issues [options] <repo>
```

List issues for a GitHub Bot repository

Options:

- `--state <value>`: Issue state: open, closed, all
- `--limit <number>`: Maximum issues to load (default: 20)

### `issue`

Usage:
```bash
mikacli bot githubbot issue [options] <repo> <number>
```

Load a single GitHub Bot issue

No command-specific options.

### `pulls`

Usage:
```bash
mikacli bot githubbot pulls [options] <repo>
```

List pull requests for a GitHub Bot repository

Options:

- `--state <value>`: Pull request state: open, closed, all
- `--limit <number>`: Maximum pull requests to load (default: 20)
- `--sort <value>`: Sort order: created, updated, popularity, long-running
- `--direction <value>`: Direction: asc or desc

### `pull`

Usage:
```bash
mikacli bot githubbot pull [options] <repo> <number>
```

Load a single GitHub Bot pull request

No command-specific options.

### `releases`

Usage:
```bash
mikacli bot githubbot releases [options] <repo>
```

List releases for a GitHub Bot repository

Options:

- `--limit <number>`: Maximum releases to load (default: 20)

### `readme`

Usage:
```bash
mikacli bot githubbot readme [options] <repo>
```

Load and decode the README from a GitHub Bot repository

No command-specific options.

### `create-issue`

Usage:
```bash
mikacli bot githubbot create-issue [options] <repo>
```

Create a GitHub Bot issue in a repository you can write to

Options:

- `--title <text>`: Issue title
- `--body <text>`: Issue body markdown

### `comment`

Usage:
```bash
mikacli bot githubbot comment [options] <repo> <number>
```

Add a comment to a GitHub Bot issue

Options:

- `--body <text>`: Comment body markdown

### `create-repo`

Usage:
```bash
mikacli bot githubbot create-repo [options] <name>
```

Create a new repository for the authenticated GitHub Bot account

Options:

- `--description <text>`: Repository description
- `--homepage <url>`: Repository homepage URL
- `--private`: Create the repository as private
- `--auto-init`: Initialize the repository with a README

### `fork`

Usage:
```bash
mikacli bot githubbot fork [options] <repo>
```

Create a fork of a GitHub Bot repository

No command-specific options.

### `star`

Usage:
```bash
mikacli bot githubbot star [options] <repo>
```

Star a GitHub Bot repository

No command-specific options.

### `unstar`

Usage:
```bash
mikacli bot githubbot unstar [options] <repo>
```

Remove the star from a GitHub Bot repository

No command-specific options.

### `capabilities`

Usage:
```bash
mikacli bot githubbot capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
