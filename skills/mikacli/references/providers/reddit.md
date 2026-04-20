# Reddit

Generated from the real MikaCLI provider definition and command tree.

- Provider: `reddit`
- Category: `social`
- Command prefix: `mikacli social reddit`
- Aliases: none
- Auth: `none`, `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Search public Reddit posts and threads, then use a saved session or shared browser profile for writing actions

## Notes

- Public reads are stable; writes can use a saved session or the shared browser profile.

## Fast Start

- `mikacli social reddit search "bun cli"`
- `mikacli social reddit profile spez`
- `mikacli social reddit posts u/spez --limit 5`
- `mikacli social reddit capabilities --json`

## Default Command

Usage:
```bash
mikacli social reddit [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli social reddit login [options]
```

Save the Reddit session for future CLI use. With no auth flags, MikaCLI opens browser login by default

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
mikacli social reddit status [options]
```

Show the saved Reddit session status

Options:

- `--account <name>`: Optional saved Reddit session name to inspect

### `me`

Usage:
```bash
mikacli social reddit me [options]
```

Aliases: `account`

Load the current Reddit account profile from the saved session

Options:

- `--account <name>`: Optional saved Reddit session name to use

### `search`

Usage:
```bash
mikacli social reddit search [options] <query>
```

Search public Reddit posts

Options:

- `--limit <number>`: Maximum results to return (default: 5)
- `--subreddit <name>`: Restrict search to one subreddit

### `profile`

Usage:
```bash
mikacli social reddit profile [options] <target>
```

Aliases: `user`

Load a public Reddit profile by username, u/handle, or profile URL

No command-specific options.

### `posts`

Usage:
```bash
mikacli social reddit posts [options] <target>
```

Aliases: `feed`

Load recent public Reddit posts for a user profile

Options:

- `--limit <number>`: Maximum posts to return (default: 5)

### `thread`

Usage:
```bash
mikacli social reddit thread [options] <target>
```

Aliases: `info`

Load a public Reddit thread by URL, shortlink, or post ID

Options:

- `--limit <number>`: Maximum replies to return (default: 5)

### `post`

Usage:
```bash
mikacli social reddit post [options] <subreddit> <title> [text...]
```

Create a Reddit text post, or use --url for a link post

Options:

- `--account <name>`: Optional saved Reddit session name to use
- `--url <link>`: Submit a link post instead of a text post
- `--nsfw`: Mark the post as NSFW
- `--spoiler`: Mark the post as spoiler
- `--browser`: Run the write action in the shared browser profile instead of the saved session
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `comment`

Usage:
```bash
mikacli social reddit comment [options] <target> <text...>
```

Aliases: `reply`

Comment on a Reddit post or comment URL, ID, or fullname

Options:

- `--account <name>`: Optional saved Reddit session name to use
- `--browser`: Run the write action in the shared browser profile instead of the saved session
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `upvote`

Usage:
```bash
mikacli social reddit upvote [options] <target>
```

Aliases: `like`

Upvote a Reddit post or comment URL, ID, or fullname

Options:

- `--account <name>`: Optional saved Reddit session name to use
- `--browser`: Run the write action in the shared browser profile instead of the saved session
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `save`

Usage:
```bash
mikacli social reddit save [options] <target>
```

Aliases: `bookmark`

Save a Reddit post or comment URL, ID, or fullname

Options:

- `--account <name>`: Optional saved Reddit session name to use
- `--browser`: Run the write action in the shared browser profile instead of the saved session
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `capabilities`

Usage:
```bash
mikacli social reddit capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
