# LinkedIn

Generated from the real AutoCLI provider definition and command tree.

- Provider: `linkedin`
- Category: `social`
- Command prefix: `autocli social linkedin`
- Aliases: `li`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `partial`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with LinkedIn using an imported browser session, with text posting strongest today

## Notes

- none

## Fast Start

- `autocli social linkedin login --cookies ./linkedin.cookies.json`
- `autocli social linkedin post "Posting from AutoCLI"`
- `autocli social linkedin like https://www.linkedin.com/feed/update/urn:li:activity:1234567890123456789/`
- `autocli social linkedin capabilities --json`

## Default Command

Usage:
```bash
autocli social linkedin [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli social linkedin login [options]
```

Import cookies and save the LinkedIn session for future headless use

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `post`

Usage:
```bash
autocli social linkedin post [options] <text>
```

Aliases: `share`

Publish a text post on LinkedIn using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved LinkedIn session

### `like`

Usage:
```bash
autocli social linkedin like [options] <target>
```

Like a LinkedIn post by URL, urn:li target, or activity ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved LinkedIn session

### `comment`

Usage:
```bash
autocli social linkedin comment [options] <target> <text>
```

Comment on a LinkedIn post by URL, urn:li target, or activity ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved LinkedIn session

### `capabilities`

Usage:
```bash
autocli social linkedin capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
