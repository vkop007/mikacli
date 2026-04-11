# Google Calendar

Generated from the real AutoCLI provider definition and command tree.

- Provider: `calendar`
- Category: `google`
- Command prefix: `autocli google calendar`
- Aliases: none
- Auth: `oauth2`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

List calendars, inspect events, and create, update, or delete Google Calendar events with OAuth2

## Notes

- Uses Google's OAuth2 flow for calendar listing plus Google Calendar event reads and writes.

## Fast Start

- `autocli google calendar login --client-id google-client-id-example --client-secret google-client-secret-example`
- `autocli google calendar auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback`
- `autocli google calendar calendars --json`
- `autocli google calendar capabilities --json`

## Default Command

Usage:
```bash
autocli google calendar [command]
```

No root-only options.


## Commands

### `auth-url`

Usage:
```bash
autocli google calendar auth-url [options]
```

Generate the Google OAuth consent URL for Calendar

Options:

- `--client-id <id>`: Google OAuth client id
- `--redirect-uri <uri>`: OAuth redirect URI
- `--scopes <scopes>`: Comma- or space-separated scopes to request
- `--state <value>`: Optional OAuth state value
- `--login-hint <email>`: Optional Google account email hint

### `login`

Usage:
```bash
autocli google calendar login [options]
```

Save a Calendar OAuth2 connection with localhost callback capture, an authorization code, or a refresh token

Options:

- `--account <name>`: Optional saved connection name
- `--client-id <id>`: Google OAuth client id
- `--client-secret <secret>`: Google OAuth client secret
- `--code <value>`: Authorization code returned from Google's consent flow
- `--redirect-uri <uri>`: Optional localhost redirect URI to listen on during interactive login, or the URI used with --code
- `--refresh-token <token>`: Existing Google refresh token
- `--scopes <scopes>`: Comma- or space-separated scopes to request
- `--timeout <seconds>`: Maximum seconds to wait for the localhost callback during interactive login
- `--login-hint <email>`: Optional Google account email hint for interactive login

### `status`

Usage:
```bash
autocli google calendar status [options]
```

Check the saved Calendar OAuth connection

Options:

- `--account <name>`: Optional saved connection name

### `me`

Usage:
```bash
autocli google calendar me [options]
```

Show the current Google profile behind the Calendar connection

Options:

- `--account <name>`: Optional saved connection name

### `calendars`

Usage:
```bash
autocli google calendar calendars [options]
```

List visible Google calendars

Options:

- `--account <name>`: Optional saved connection name
- `--limit <number>`: Maximum calendars to return

### `calendar`

Usage:
```bash
autocli google calendar calendar [options] <calendar-id>
```

Load a single Google calendar

Options:

- `--account <name>`: Optional saved connection name

### `events`

Usage:
```bash
autocli google calendar events [options]
```

List Google Calendar events

Options:

- `--calendar <id>`: Calendar id
- `--query <query>`: Optional free-text event query
- `--time-min <iso>`: Optional lower bound in RFC3339 or ISO-8601 format
- `--time-max <iso>`: Optional upper bound in RFC3339 or ISO-8601 format
- `--limit <number>`: Maximum events to return
- `--account <name>`: Optional saved connection name

### `today`

Usage:
```bash
autocli google calendar today [options]
```

List today's Google Calendar events using the local machine timezone

Options:

- `--calendar <id>`: Calendar id
- `--limit <number>`: Maximum events to return
- `--account <name>`: Optional saved connection name

### `event`

Usage:
```bash
autocli google calendar event [options] <event-id>
```

Load a single Google Calendar event

Options:

- `--calendar <id>`: Calendar id
- `--account <name>`: Optional saved connection name

### `create-event`

Usage:
```bash
autocli google calendar create-event [options]
```

Create a Google Calendar event

Options:

- `--summary <text>`: Event summary
- `--start <value>`: Start time in ISO-8601 or YYYY-MM-DD format
- `--end <value>`: End time in ISO-8601 or YYYY-MM-DD format
- `--description <text>`: Optional event description
- `--location <text>`: Optional event location
- `--attendees <emails>`: Comma- or space-separated attendee emails
- `--time-zone <iana>`: Optional IANA timezone for dateTime inputs
- `--calendar <id>`: Calendar id
- `--account <name>`: Optional saved connection name

### `update-event`

Usage:
```bash
autocli google calendar update-event [options] <event-id>
```

Update a Google Calendar event

Options:

- `--summary <text>`: Updated event summary
- `--start <value>`: Updated start time in ISO-8601 or YYYY-MM-DD format
- `--end <value>`: Updated end time in ISO-8601 or YYYY-MM-DD format
- `--description <text>`: Updated event description
- `--location <text>`: Updated event location
- `--attendees <emails>`: Comma- or space-separated attendee emails
- `--time-zone <iana>`: Optional IANA timezone for dateTime inputs
- `--status <value>`: Optional event status, for example confirmed or cancelled
- `--calendar <id>`: Calendar id
- `--account <name>`: Optional saved connection name

### `delete-event`

Usage:
```bash
autocli google calendar delete-event [options] <event-id>
```

Delete a Google Calendar event

Options:

- `--calendar <id>`: Calendar id
- `--account <name>`: Optional saved connection name

### `capabilities`

Usage:
```bash
autocli google calendar capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
