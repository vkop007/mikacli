# X

Generated from the real MikaCLI provider definition and command tree.

- Provider: `x`
- Category: `social`
- Command prefix: `mikacli social x`
- Aliases: `twitter`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Interact with X/Twitter using an imported browser session and browser-backed write flows

## Notes

- X write actions run through browser-backed flows. Use `--browser` to force the shared MikaCLI browser profile immediately when you want the live browser path.

## Fast Start

- `mikacli social x login`
- `mikacli social x login --cookies ./x.cookies.json`
- `mikacli social x status`
- `mikacli social x capabilities --json`

## Default Command

Usage:
```bash
mikacli social x [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli social x login [options]
```

Save an X session for future headless use. With no auth flags, MikaCLI opens browser login by default.

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
mikacli social x status [options]
```

Show the saved X session status

Options:

- `--account <name>`: Optional override for a specific saved X session

### `post`

Usage:
```bash
mikacli social x post [options] <text>
```

Aliases: `tweet`, `publish`

Publish a text post on X, optionally with one image, through a browser-backed compose flow

Options:

- `--image <path>`: Attach an image to the post
- `--account <name>`: Optional override for a specific saved X session
- `--browser`: Force the post through the shared MikaCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `search`

Usage:
```bash
mikacli social x search [options] <query>
```

Search X accounts

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved X session

### `tweetid`

Usage:
```bash
mikacli social x tweetid [options] <target>
```

Aliases: `info`

Load exact X post details by URL or tweet ID

Options:

- `--account <name>`: Optional override for a specific saved X session

### `profileid`

Usage:
```bash
mikacli social x profileid [options] <target>
```

Aliases: `profile`

Load exact X profile details by URL, @handle, handle, or numeric user ID

Options:

- `--account <name>`: Optional override for a specific saved X session

### `tweets`

Usage:
```bash
mikacli social x tweets [options] <target>
```

List recent X posts for a profile URL, @handle, handle, or numeric user ID

Options:

- `--limit <number>`: Maximum number of posts to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved X session

### `delete`

Usage:
```bash
mikacli social x delete [options] <target>
```

Aliases: `remove`

Delete your own X post by URL or tweet ID through a browser-backed action flow

Options:

- `--account <name>`: Optional override for a specific saved X session
- `--browser`: Force the delete through the shared MikaCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `like`

Usage:
```bash
mikacli social x like [options] <target>
```

Like an X post by URL or tweet ID through a browser-backed action flow

Options:

- `--account <name>`: Optional override for a specific saved X session
- `--browser`: Force the like through the shared MikaCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `unlike`

Usage:
```bash
mikacli social x unlike [options] <target>
```

Unlike an X post by URL or tweet ID through a browser-backed action flow

Options:

- `--account <name>`: Optional override for a specific saved X session
- `--browser`: Force the unlike through the shared MikaCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `comment`

Usage:
```bash
mikacli social x comment [options] <target> <text>
```

Reply to an X post by URL or tweet ID through a browser-backed reply flow

Options:

- `--account <name>`: Optional override for a specific saved X session
- `--browser`: Force the reply through the shared MikaCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `capabilities`

Usage:
```bash
mikacli social x capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
