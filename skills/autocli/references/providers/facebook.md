# Facebook

Generated from the real AutoCLI provider definition and command tree.

- Provider: `facebook`
- Category: `social`
- Command prefix: `autocli social facebook`
- Aliases: `fb`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Post, like, and comment through browser-backed flows using saved Facebook sessions or the shared AutoCLI browser profile

## Notes

- Facebook writes now run through browser-backed post, like, and comment flows. Use `--browser` to jump straight into the shared AutoCLI browser profile when you want the visible browser path.

## Fast Start

- `autocli social facebook login`
- `autocli social facebook login --cookies ./facebook.cookies.json`
- `autocli social facebook status`
- `autocli social facebook capabilities --json`

## Default Command

Usage:
```bash
autocli social facebook [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli social facebook login [options]
```

Save the Facebook session for future headless use. With no auth flags, AutoCLI opens browser login by default

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
autocli social facebook status [options]
```

Show the saved Facebook session status

Options:

- `--account <name>`: Optional override for a specific saved Facebook session

### `post`

Usage:
```bash
autocli social facebook post [options] <text>
```

Publish a Facebook post through a browser-backed flow using the latest saved session by default

Options:

- `--image <path>`: Optional image path to attach to the Facebook post
- `--account <name>`: Optional override for a specific saved Facebook session
- `--browser`: Force the post through the shared AutoCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `like`

Usage:
```bash
autocli social facebook like [options] <target>
```

Like a Facebook post by post URL, timeline URL, or numeric object ID through a browser-backed flow using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Facebook session
- `--browser`: Force the like through the shared AutoCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `comment`

Usage:
```bash
autocli social facebook comment [options] <target> <text>
```

Comment on a Facebook post by post URL, timeline URL, or numeric object ID through a browser-backed flow using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Facebook session
- `--browser`: Force the comment through the shared AutoCLI browser profile instead of the invisible browser-backed path
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `capabilities`

Usage:
```bash
autocli social facebook capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
