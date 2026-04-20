# Instagram

Generated from the real MikaCLI provider definition and command tree.

- Provider: `instagram`
- Category: `social`
- Command prefix: `mikacli social instagram`
- Aliases: `ig`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Interact with Instagram using an imported browser session. Use `mikacli tools download` for media downloads.

## Notes

- Reads and image/comment writes are browserless; post and comment deletion can fall back to browser-backed flows when Instagram's web APIs get flaky.

## Fast Start

- `mikacli social instagram login`
- `mikacli social instagram login --cookies ./instagram.cookies.txt`
- `mikacli social instagram status`
- `mikacli social instagram capabilities --json`

## Default Command

Usage:
```bash
mikacli social instagram [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli social instagram login [options]
```

Save the Instagram session for future headless use. With no auth flags, MikaCLI opens browser login by default

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
mikacli social instagram status [options]
```

Show the saved Instagram session status

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `post`

Usage:
```bash
mikacli social instagram post [options] <mediaPath>
```

Publish an Instagram image post with an optional caption using the latest saved session by default

Options:

- `--caption <text>`: Caption for the post
- `--account <name>`: Optional override for a specific saved Instagram session

### `search`

Usage:
```bash
mikacli social instagram search [options] <query>
```

Search Instagram accounts

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved Instagram session

### `posts`

Usage:
```bash
mikacli social instagram posts [options] <target>
```

List recent Instagram posts for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of posts to return (1-25, default: 5)
- `--type <kind>`: Filter posts by media type: all, photo, video, reel, carousel
- `--account <name>`: Optional override for a specific saved Instagram session

### `stories`

Usage:
```bash
mikacli social instagram stories [options] <target>
```

List active Instagram stories for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of story items to return (1-25, default: 5)
- `--photos-only`: Only return photo stories
- `--videos-only`: Only return video stories
- `--account <name>`: Optional override for a specific saved Instagram session

### `followers`

Usage:
```bash
mikacli social instagram followers [options] <target>
```

List Instagram followers for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of followers to return (1-25, default: 5)
- `--cursor <value>`: Pagination cursor from a previous --json response
- `--account <name>`: Optional override for a specific saved Instagram session

### `following`

Usage:
```bash
mikacli social instagram following [options] <target>
```

List Instagram following accounts for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of following accounts to return (1-25, default: 5)
- `--cursor <value>`: Pagination cursor from a previous --json response
- `--account <name>`: Optional override for a specific saved Instagram session

### `mediaid`

Usage:
```bash
mikacli social instagram mediaid [options] <target>
```

Aliases: `info`

Load exact Instagram media details by URL, shortcode, or numeric media ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `profileid`

Usage:
```bash
mikacli social instagram profileid [options] <target>
```

Aliases: `profile`

Load exact Instagram profile details by URL, @username, username, or numeric user ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `like`

Usage:
```bash
mikacli social instagram like [options] <target>
```

Like an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `unlike`

Usage:
```bash
mikacli social instagram unlike [options] <target>
```

Unlike an Instagram post by URL, shortcode, or numeric media ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `comment`

Usage:
```bash
mikacli social instagram comment [options] <target> <text>
```

Comment on an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `delete`

Usage:
```bash
mikacli social instagram delete [options] <target>
```

Aliases: `remove`

Delete your own Instagram post by URL, shortcode, or numeric media ID through a browser-backed action flow

Options:

- `--account <name>`: Optional override for a specific saved Instagram session
- `--browser`: Force the delete through the shared MikaCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `delete-comment`

Usage:
```bash
mikacli social instagram delete-comment [options] <target> <commentId>
```

Aliases: `remove-comment`

Delete your own Instagram comment by post target and numeric comment ID through a browser-backed action flow

Options:

- `--account <name>`: Optional override for a specific saved Instagram session
- `--browser`: Force the delete through the shared MikaCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `follow`

Usage:
```bash
mikacli social instagram follow [options] <target>
```

Follow an Instagram profile by URL, @username, username, or numeric user ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `unfollow`

Usage:
```bash
mikacli social instagram unfollow [options] <target>
```

Unfollow an Instagram profile by URL, @username, username, or numeric user ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `batch`

Usage:
```bash
mikacli social instagram batch [options] [command]
```

Run Instagram actions from a newline-delimited or JSON array input file

No command-specific options.

### `capabilities`

Usage:
```bash
mikacli social instagram capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
