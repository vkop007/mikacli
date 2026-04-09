# Bluesky

Generated from the real AutoCLI provider definition and command tree.

- Provider: `bluesky`
- Category: `social`
- Command prefix: `autocli social bluesky`
- Aliases: none
- Auth: `none`, `session`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Bluesky profiles through the public appview API, then use app-password login for account reads and text interactions

## Notes

- Public reads stay available without auth. App-password login enables saved-session `me`, `post`, `comment`, and `like` commands without browser automation.

## Fast Start

- `autocli social bluesky login --handle alice.bsky.social --app-password app-password-example`
- `autocli social bluesky me`
- `autocli social bluesky search "karpathy"`
- `autocli social bluesky capabilities --json`

## Default Command

Usage:
```bash
autocli social bluesky [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli social bluesky login [options]
```

Save a Bluesky session using a handle and app password

Options:

- `--handle <value>`: Bluesky handle to log in with
- `--app-password <value>`: Bluesky app password
- `--service <url>`: Optional ATProto service or PDS URL (default: https://bsky.social)
- `--account <name>`: Optional saved session name to use instead of the detected handle

### `status`

Usage:
```bash
autocli social bluesky status [options]
```

Show the saved Bluesky session status

Options:

- `--account <name>`: Optional saved Bluesky session name to inspect

### `me`

Usage:
```bash
autocli social bluesky me [options]
```

Aliases: `account`

Load the current Bluesky account profile from the saved session

Options:

- `--account <name>`: Optional saved Bluesky session name to use

### `search`

Usage:
```bash
autocli social bluesky search [options] <query>
```

Search public Bluesky profiles through the public appview actor search endpoint

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `profile`

Usage:
```bash
autocli social bluesky profile [options] <target>
```

Aliases: `user`

Load a Bluesky profile by URL, @handle, handle, or DID

No command-specific options.

### `posts`

Usage:
```bash
autocli social bluesky posts [options] <target>
```

Aliases: `feed`

Load recent public Bluesky posts for a profile

Options:

- `--limit <number>`: Maximum posts to return (default: 5)

### `thread`

Usage:
```bash
autocli social bluesky thread [options] <target>
```

Aliases: `info`

Load a public Bluesky thread by URL or at:// post URI

Options:

- `--limit <number>`: Maximum replies to return (default: 5)

### `post`

Usage:
```bash
autocli social bluesky post [options] <text...>
```

Create a text Bluesky post from the saved session

Options:

- `--account <name>`: Optional saved Bluesky session name to use

### `comment`

Usage:
```bash
autocli social bluesky comment [options] <target> <text...>
```

Aliases: `reply`

Reply to a Bluesky post URL or at:// URI

Options:

- `--account <name>`: Optional saved Bluesky session name to use

### `like`

Usage:
```bash
autocli social bluesky like [options] <target>
```

Like a Bluesky post URL or at:// URI

Options:

- `--account <name>`: Optional saved Bluesky session name to use

### `capabilities`

Usage:
```bash
autocli social bluesky capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
