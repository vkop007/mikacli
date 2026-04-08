# Twitch

Generated from the real AutoCLI provider definition and command tree.

- Provider: `twitch`
- Category: `social`
- Command prefix: `autocli social twitch`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Inspect Twitch channels, live status, videos, and clips with an imported browser session

## Notes

- Uses Twitch's authenticated web GraphQL surface for read-heavy channel, stream, video, and clip lookups.

## Fast Start

- `autocli social twitch login`
- `autocli social twitch login --cookies ./twitch.cookies.json`
- `autocli social twitch status`
- `autocli social twitch capabilities --json`

## Default Command

Usage:
```bash
autocli social twitch [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli social twitch login [options]
```

Save the Twitch session for future CLI use. With no auth flags, AutoCLI opens browser login by default

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
autocli social twitch status [options]
```

Show the saved Twitch session status

Options:

- `--account <name>`: Optional override for a specific saved Twitch session

### `me`

Usage:
```bash
autocli social twitch me [options]
```

Aliases: `account`

Load the current Twitch account profile from the saved session

Options:

- `--account <name>`: Optional override for a specific saved Twitch session

### `search`

Usage:
```bash
autocli social twitch search [options] <query>
```

Search Twitch channels

Options:

- `--limit <number>`: Maximum results to return (default: 5)
- `--account <name>`: Optional override for a specific saved Twitch session

### `channel`

Usage:
```bash
autocli social twitch channel [options] <target>
```

Aliases: `profile`, `user`

Load a Twitch channel by URL, @handle, or login

Options:

- `--account <name>`: Optional override for a specific saved Twitch session

### `stream`

Usage:
```bash
autocli social twitch stream [options] <target>
```

Aliases: `live`

Load live stream status for a Twitch channel

Options:

- `--account <name>`: Optional override for a specific saved Twitch session

### `videos`

Usage:
```bash
autocli social twitch videos [options] <target>
```

Aliases: `vods`

List recent Twitch videos for a channel

Options:

- `--limit <number>`: Maximum videos to return (default: 5)
- `--account <name>`: Optional override for a specific saved Twitch session

### `clips`

Usage:
```bash
autocli social twitch clips [options] <target>
```

List Twitch clips for a channel

Options:

- `--limit <number>`: Maximum clips to return (default: 5)
- `--period <window>`: Clip window: all-time, last-week, or last-day
- `--account <name>`: Optional override for a specific saved Twitch session

### `capabilities`

Usage:
```bash
autocli social twitch capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
