# Pinterest

Generated from the real AutoCLI provider definition and command tree.

- Provider: `pinterest`
- Category: `social`
- Command prefix: `autocli social pinterest`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public Pinterest pins and inspect public profiles, boards, and pins through Pinterest's readable web surface

## Notes

- none

## Fast Start

- `autocli social pinterest search "interior design"`
- `autocli social pinterest profile pinterest`
- `autocli social pinterest posts pinterest --limit 5`
- `autocli social pinterest capabilities --json`

## Default Command

Usage:
```bash
autocli social pinterest [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli social pinterest search [options] <query>
```

Search public Pinterest pins by keyword

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `profile`

Usage:
```bash
autocli social pinterest profile [options] <target>
```

Aliases: `user`

Load a public Pinterest profile by URL, @username, or username

No command-specific options.

### `posts`

Usage:
```bash
autocli social pinterest posts [options] <target>
```

Aliases: `feed`

Load public Pinterest boards for a profile

Options:

- `--limit <number>`: Maximum posts to return (default: 5)

### `thread`

Usage:
```bash
autocli social pinterest thread [options] <target>
```

Aliases: `info`

Load a public Pinterest pin by URL or numeric pin ID

Options:

- `--limit <number>`: Maximum replies to return (default: 5)

### `capabilities`

Usage:
```bash
autocli social pinterest capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
