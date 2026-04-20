# Twitch

Generated from the real MikaCLI provider definition and command tree.

- Provider: `twitch`
- Category: `social`
- Command prefix: `mikacli social twitch`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `partial`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Inspect Twitch channels, live status, videos, and clips, then follow channels or adjust stream settings with a saved Twitch session

## Notes

- Uses Twitch's authenticated web GraphQL surface for channel, stream, video, and clip lookups.
- Follow and unfollow try Twitch's web mutation path first, then can fall back to the shared MikaCLI browser profile when Twitch enforces an integrity challenge.
- Clip creation and stream settings updates currently run through the shared MikaCLI browser profile.

## Fast Start

- `mikacli social twitch login`
- `mikacli social twitch login --cookies ./twitch.cookies.json`
- `mikacli social twitch status`
- `mikacli social twitch capabilities --json`

## Default Command

Usage:
```bash
mikacli social twitch [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli social twitch login [options]
```

Save the Twitch session for future CLI use. With no auth flags, MikaCLI opens browser login by default

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
mikacli social twitch status [options]
```

Show the saved Twitch session status

Options:

- `--account <name>`: Optional override for a specific saved Twitch session

### `me`

Usage:
```bash
mikacli social twitch me [options]
```

Aliases: `account`

Load the current Twitch account profile from the saved session

Options:

- `--account <name>`: Optional override for a specific saved Twitch session

### `search`

Usage:
```bash
mikacli social twitch search [options] <query>
```

Search Twitch channels

Options:

- `--limit <number>`: Maximum results to return (default: 5)
- `--account <name>`: Optional override for a specific saved Twitch session

### `channel`

Usage:
```bash
mikacli social twitch channel [options] <target>
```

Aliases: `profile`, `user`

Load a Twitch channel by URL, @handle, or login

Options:

- `--account <name>`: Optional override for a specific saved Twitch session

### `stream`

Usage:
```bash
mikacli social twitch stream [options] <target>
```

Aliases: `live`

Load live stream status for a Twitch channel

Options:

- `--account <name>`: Optional override for a specific saved Twitch session

### `videos`

Usage:
```bash
mikacli social twitch videos [options] <target>
```

Aliases: `vods`

List recent Twitch videos for a channel

Options:

- `--limit <number>`: Maximum videos to return (default: 5)
- `--account <name>`: Optional override for a specific saved Twitch session

### `clips`

Usage:
```bash
mikacli social twitch clips [options] <target>
```

List Twitch clips for a channel

Options:

- `--limit <number>`: Maximum clips to return (default: 5)
- `--period <window>`: Clip window: all-time, last-week, or last-day
- `--account <name>`: Optional override for a specific saved Twitch session

### `follow`

Usage:
```bash
mikacli social twitch follow [options] <target>
```

Follow a Twitch channel by URL, @handle, or login. MikaCLI tries the web mutation first and can switch to the shared browser when needed

Options:

- `--account <name>`: Optional override for a specific saved Twitch session
- `--browser`: Force the follow through the shared MikaCLI browser profile instead of trying the direct web mutation first
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `unfollow`

Usage:
```bash
mikacli social twitch unfollow [options] <target>
```

Unfollow a Twitch channel by URL, @handle, or login

Options:

- `--account <name>`: Optional override for a specific saved Twitch session
- `--browser`: Force the unfollow through the shared MikaCLI browser profile instead of trying the direct web mutation first
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `create-clip`

Usage:
```bash
mikacli social twitch create-clip [options] <target>
```

Aliases: `clip`

Create a Twitch clip for a live channel through the shared MikaCLI browser profile

Options:

- `--account <name>`: Optional override for a specific saved Twitch session
- `--browser-timeout <seconds>`: Maximum seconds to allow the shared browser action to complete

### `update-stream`

Usage:
```bash
mikacli social twitch update-stream [options]
```

Aliases: `stream-update`

Update Twitch stream settings like title, category, tags, or the mature toggle through the shared MikaCLI browser profile

Options:

- `--title <text>`: New stream title
- `--category <name>`: New category or game name
- `--tags <csv>`: Comma-separated stream tags to add
- `--clear-tags`: Remove existing stream tags before adding new ones
- `--mature`: Turn the mature content toggle on
- `--not-mature`: Turn the mature content toggle off
- `--account <name>`: Optional override for a specific saved Twitch session
- `--browser-timeout <seconds>`: Maximum seconds to allow the shared browser action to complete

### `capabilities`

Usage:
```bash
mikacli social twitch capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
