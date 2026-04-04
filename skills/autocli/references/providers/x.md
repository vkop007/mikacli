# X

Generated from the real AutoCLI provider definition and command tree.

- Provider: `x`
- Category: `social`
- Command prefix: `autocli social x`
- Aliases: `twitter`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Interact with X/Twitter using an imported browser session

## Notes

- When X blocks the request path, AutoCLI auto-switches `post` into the real compose UI. Use `post --browser` to force that path immediately.

## Fast Start

- `autocli social x login`
- `autocli social x login --cookies ./x.cookies.json`
- `autocli social x post "Launching AutoCLI"`
- `autocli social x capabilities --json`

## Default Command

Usage:
```bash
autocli social x [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli social x login [options]
```

Save an X session for future headless use. With no auth flags, AutoCLI opens browser login by default.

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `post`

Usage:
```bash
autocli social x post [options] <text>
```

Aliases: `tweet`, `publish`

Publish a text post on X, optionally with one image, using the latest saved session and auto-switching to a browser-backed compose flow when X blocks the request path

Options:

- `--image <path>`: Attach an image to the post
- `--account <name>`: Optional override for a specific saved X session
- `--browser`: Force the post through an invisible browser-backed compose flow instead of trying the request path first
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `search`

Usage:
```bash
autocli social x search [options] <query>
```

Search X accounts

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved X session

### `tweetid`

Usage:
```bash
autocli social x tweetid [options] <target>
```

Aliases: `info`

Load exact X post details by URL or tweet ID

Options:

- `--account <name>`: Optional override for a specific saved X session

### `profileid`

Usage:
```bash
autocli social x profileid [options] <target>
```

Aliases: `profile`

Load exact X profile details by URL, @handle, handle, or numeric user ID

Options:

- `--account <name>`: Optional override for a specific saved X session

### `tweets`

Usage:
```bash
autocli social x tweets [options] <target>
```

List recent X posts for a profile URL, @handle, handle, or numeric user ID

Options:

- `--limit <number>`: Maximum number of posts to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved X session

### `like`

Usage:
```bash
autocli social x like [options] <target>
```

Like an X post by URL or tweet ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved X session

### `unlike`

Usage:
```bash
autocli social x unlike [options] <target>
```

Unlike an X post by URL or tweet ID

Options:

- `--account <name>`: Optional override for a specific saved X session

### `comment`

Usage:
```bash
autocli social x comment [options] <target> <text>
```

Reply to an X post by URL or tweet ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved X session

### `capabilities`

Usage:
```bash
autocli social x capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
