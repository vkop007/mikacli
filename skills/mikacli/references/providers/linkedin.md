# LinkedIn

Generated from the real MikaCLI provider definition and command tree.

- Provider: `linkedin`
- Category: `social`
- Command prefix: `mikacli social linkedin`
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

- `mikacli social linkedin login`
- `mikacli social linkedin login --cookies ./linkedin.cookies.json`
- `mikacli social linkedin post "Posting from MikaCLI"`
- `mikacli social linkedin capabilities --json`

## Default Command

Usage:
```bash
mikacli social linkedin [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli social linkedin login [options]
```

Save the LinkedIn session for future headless use. With no auth flags, MikaCLI opens browser login by default

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
mikacli social linkedin status [options]
```

Show the saved LinkedIn session status

Options:

- `--account <name>`: Optional saved LinkedIn session name to inspect

### `post`

Usage:
```bash
mikacli social linkedin post [options] <text>
```

Aliases: `share`

Publish a text post on LinkedIn using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved LinkedIn session

### `like`

Usage:
```bash
mikacli social linkedin like [options] <target>
```

Like a LinkedIn post by URL, urn:li target, or activity ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved LinkedIn session

### `comment`

Usage:
```bash
mikacli social linkedin comment [options] <target> <text>
```

Comment on a LinkedIn post by URL, urn:li target, or activity ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved LinkedIn session

### `capabilities`

Usage:
```bash
mikacli social linkedin capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
