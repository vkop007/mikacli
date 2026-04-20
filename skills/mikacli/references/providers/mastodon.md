# Mastodon

Generated from the real MikaCLI provider definition and command tree.

- Provider: `mastodon`
- Category: `social`
- Command prefix: `mikacli social mastodon`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Mastodon profiles and posts through federated instance APIs

## Notes

- none

## Fast Start

- `mikacli social mastodon search "open source"`
- `mikacli social mastodon profile mastodon.social/@Gargron`
- `mikacli social mastodon posts mastodon.social/@Gargron --limit 5`
- `mikacli social mastodon capabilities --json`

## Default Command

Usage:
```bash
mikacli social mastodon [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
mikacli social mastodon search [options] <query>
```

Search public Mastodon profiles and posts across a Mastodon instance

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `profile`

Usage:
```bash
mikacli social mastodon profile [options] <target>
```

Aliases: `user`

Load a Mastodon profile by URL, @handle, handle, or username@instance

No command-specific options.

### `posts`

Usage:
```bash
mikacli social mastodon posts [options] <target>
```

Aliases: `feed`

Load recent public Mastodon posts for a profile

Options:

- `--limit <number>`: Maximum posts to return (default: 5)

### `thread`

Usage:
```bash
mikacli social mastodon thread [options] <target>
```

Aliases: `info`

Load a public Mastodon thread by URL or status ID

Options:

- `--limit <number>`: Maximum replies to return (default: 5)

### `capabilities`

Usage:
```bash
mikacli social mastodon capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
