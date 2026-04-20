# TikTok

Generated from the real MikaCLI provider definition and command tree.

- Provider: `tiktok`
- Category: `social`
- Command prefix: `mikacli social tiktok`
- Aliases: `tt`
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `partial`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with TikTok using an imported browser session, with session/read flows strongest today

## Notes

- none

## Fast Start

- `mikacli social tiktok login`
- `mikacli social tiktok login --cookies ./tiktok.cookies.json`
- `mikacli social tiktok post ./clip.mp4 --caption "Posting from MikaCLI"`
- `mikacli social tiktok capabilities --json`

## Default Command

Usage:
```bash
mikacli social tiktok [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli social tiktok login [options]
```

Save the TikTok session for future headless use. With no auth flags, MikaCLI opens browser login by default

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
mikacli social tiktok status [options]
```

Show the saved TikTok session status

Options:

- `--account <name>`: Optional saved TikTok session name to inspect

### `post`

Usage:
```bash
mikacli social tiktok post [options] <mediaPath>
```

Publish a TikTok video using the latest saved session by default

Options:

- `--caption <text>`: Optional caption for the TikTok post
- `--account <name>`: Optional override for a specific saved TikTok session

### `like`

Usage:
```bash
mikacli social tiktok like [options] <target>
```

Like a TikTok video by URL or numeric item ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved TikTok session

### `comment`

Usage:
```bash
mikacli social tiktok comment [options] <target> <text>
```

Comment on a TikTok video by URL or numeric item ID using the latest saved session by default

Options:

- `--account <name>`: Optional override for a specific saved TikTok session

### `capabilities`

Usage:
```bash
mikacli social tiktok capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
