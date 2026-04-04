# Facebook

Generated from the real AutoCLI provider definition and command tree.

- Provider: `facebook`
- Category: `social`
- Command prefix: `autocli social facebook`
- Aliases: `fb`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `partial`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with Facebook using an imported browser session, with validation and read flows strongest today

## Notes

- none

## Fast Start

- `autocli social facebook login`
- `autocli social facebook login --cookies ./facebook.cookies.json`
- `autocli social facebook post "Launching from AutoCLI"`
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

### `post`

Usage:
```bash
autocli social facebook post [options] <text>
```

Publish a Facebook post using the latest saved session by default

Options:

- `--image <path>`: Optional image path for future Facebook post support
- `--account <name>`: Optional override for a specific saved Facebook session

### `like`

Usage:
```bash
autocli social facebook like [options] <target>
```

Like a Facebook post by URL or numeric object ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Facebook session

### `comment`

Usage:
```bash
autocli social facebook comment [options] <target> <text>
```

Comment on a Facebook post by URL or numeric object ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved Facebook session

### `capabilities`

Usage:
```bash
autocli social facebook capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
