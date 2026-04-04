# Threads

Generated from the real AutoCLI provider definition and command tree.

- Provider: `threads`
- Category: `social`
- Command prefix: `autocli social threads`
- Aliases: none
- Auth: `none`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Threads results and inspect profiles, feeds, and individual posts through the live web surface

## Notes

- none

## Fast Start

- `autocli social threads search "openai"`
- `autocli social threads profile @zuck`
- `autocli social threads posts @zuck --limit 5`
- `autocli social threads capabilities --json`

## Default Command

Usage:
```bash
autocli social threads [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli social threads search [options] <query>
```

Search public Threads posts through the live search page

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `profile`

Usage:
```bash
autocli social threads profile [options] <target>
```

Aliases: `user`

Load a public Threads profile by URL, @username, or username

No command-specific options.

### `posts`

Usage:
```bash
autocli social threads posts [options] <target>
```

Aliases: `feed`

Load recent public Threads posts for a profile

Options:

- `--limit <number>`: Maximum posts to return (default: 5)

### `thread`

Usage:
```bash
autocli social threads thread [options] <target>
```

Aliases: `info`

Load a public Threads post and its top replies by URL or @username/postId

Options:

- `--limit <number>`: Maximum replies to return (default: 5)

### `capabilities`

Usage:
```bash
autocli social threads capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
