# Instagram

Generated from the real AutoCLI provider definition and command tree.

- Provider: `instagram`
- Category: `social`
- Command prefix: `autocli social instagram`
- Aliases: `ig`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with Instagram using an imported browser session

## Notes

- none

## Fast Start

- `autocli social instagram login`
- `autocli social instagram login --cookies ./instagram.cookies.txt`
- `autocli social instagram search "blackpink"`
- `autocli social instagram capabilities --json`

## Default Command

Usage:
```bash
autocli social instagram [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli social instagram login [options]
```

Save the Instagram session for future headless use. With no auth flags, AutoCLI opens browser login by default

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
autocli social instagram post [options] <mediaPath>
```

Publish an Instagram post with media and an optional caption using the latest saved session by default

Options:

- `--caption <text>`: Caption for the post
- `--account <name>`: Optional override for a specific saved Instagram session

### `download`

Usage:
```bash
autocli social instagram download [options] <target>
```

Download Instagram media by URL, shortcode, or numeric media ID

Options:

- `--output-dir <path>`: Directory to write downloaded files into
- `--all`: Download every asset in a carousel instead of only the first one
- `--account <name>`: Optional override for a specific saved Instagram session

### `search`

Usage:
```bash
autocli social instagram search [options] <query>
```

Search Instagram accounts

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)
- `--account <name>`: Optional override for a specific saved Instagram session

### `posts`

Usage:
```bash
autocli social instagram posts [options] <target>
```

List recent Instagram posts for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of posts to return (1-25, default: 5)
- `--type <kind>`: Filter posts by media type: all, photo, video, reel, carousel
- `--account <name>`: Optional override for a specific saved Instagram session

### `stories`

Usage:
```bash
autocli social instagram stories [options] <target>
```

List active Instagram stories for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of story items to return (1-25, default: 5)
- `--photos-only`: Only return photo stories
- `--videos-only`: Only return video stories
- `--account <name>`: Optional override for a specific saved Instagram session

### `storydownload`

Usage:
```bash
autocli social instagram storydownload [options] <target>
```

Download active Instagram stories for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of story items to download (1-25, default: 5)
- `--photos-only`: Only download photo stories
- `--videos-only`: Only download video stories
- `--output-dir <path>`: Directory to write downloaded story files into
- `--account <name>`: Optional override for a specific saved Instagram session

### `downloadposts`

Usage:
```bash
autocli social instagram downloadposts [options] <target>
```

Download recent Instagram posts for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of posts to download (1-25, default: 5)
- `--type <kind>`: Filter posts by media type: all, photo, video, reel, carousel
- `--all`: Download every asset in a carousel instead of only the first one
- `--output-dir <path>`: Directory to write downloaded post files into
- `--account <name>`: Optional override for a specific saved Instagram session

### `followers`

Usage:
```bash
autocli social instagram followers [options] <target>
```

List Instagram followers for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of followers to return (1-25, default: 5)
- `--cursor <value>`: Pagination cursor from a previous --json response
- `--account <name>`: Optional override for a specific saved Instagram session

### `following`

Usage:
```bash
autocli social instagram following [options] <target>
```

List Instagram following accounts for a profile URL, @username, username, or numeric user ID

Options:

- `--limit <number>`: Maximum number of following accounts to return (1-25, default: 5)
- `--cursor <value>`: Pagination cursor from a previous --json response
- `--account <name>`: Optional override for a specific saved Instagram session

### `mediaid`

Usage:
```bash
autocli social instagram mediaid [options] <target>
```

Aliases: `info`

Load exact Instagram media details by URL, shortcode, or numeric media ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `profileid`

Usage:
```bash
autocli social instagram profileid [options] <target>
```

Aliases: `profile`

Load exact Instagram profile details by URL, @username, username, or numeric user ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `like`

Usage:
```bash
autocli social instagram like [options] <target>
```

Like an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `unlike`

Usage:
```bash
autocli social instagram unlike [options] <target>
```

Unlike an Instagram post by URL, shortcode, or numeric media ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `comment`

Usage:
```bash
autocli social instagram comment [options] <target> <text>
```

Comment on an Instagram post by URL, shortcode, or numeric media ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `follow`

Usage:
```bash
autocli social instagram follow [options] <target>
```

Follow an Instagram profile by URL, @username, username, or numeric user ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `unfollow`

Usage:
```bash
autocli social instagram unfollow [options] <target>
```

Unfollow an Instagram profile by URL, @username, username, or numeric user ID

Options:

- `--account <name>`: Optional override for a specific saved Instagram session

### `batch`

Usage:
```bash
autocli social instagram batch [options] [command]
```

Run Instagram actions from a newline-delimited or JSON array input file

No command-specific options.

### `capabilities`

Usage:
```bash
autocli social instagram capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
