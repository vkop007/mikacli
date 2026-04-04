# Bluesky

Generated from the real AutoCLI provider definition and command tree.

- Provider: `bluesky`
- Category: `social`
- Command prefix: `autocli social bluesky`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Bluesky profiles, inspect profiles, feeds, and threads through the public appview API

## Notes

- none

## Fast Start

- `autocli social bluesky search "karpathy"`
- `autocli social bluesky profile karpathy.bsky.social`
- `autocli social bluesky posts karpathy.bsky.social --limit 5`
- `autocli social bluesky capabilities --json`

## Default Command

Usage:
```bash
autocli social bluesky [command]
```

No root-only options.


## Commands

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

### `capabilities`

Usage:
```bash
autocli social bluesky capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
