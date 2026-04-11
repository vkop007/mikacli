# Gmail

Generated from the real AutoCLI provider definition and command tree.

- Provider: `gmail`
- Category: `google`
- Command prefix: `autocli google gmail`
- Aliases: none
- Auth: `oauth2`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Read labels and messages, inspect message details, and send email through Gmail with OAuth2

## Notes

- Uses Google's OAuth2 flow and stores refresh tokens locally for headless reuse.

## Fast Start

- `autocli google gmail login --client-id google-client-id-example --client-secret google-client-secret-example`
- `autocli google gmail auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback`
- `autocli google gmail login --client-id google-client-id-example --client-secret google-client-secret-example --code google-auth-code-example --redirect-uri http://127.0.0.1:3333/callback`
- `autocli google gmail capabilities --json`

## Default Command

Usage:
```bash
autocli google gmail [command]
```

No root-only options.


## Commands

### `auth-url`

Usage:
```bash
autocli google gmail auth-url [options]
```

Generate the Google OAuth consent URL for Gmail

Options:

- `--client-id <id>`: Google OAuth client id
- `--redirect-uri <uri>`: OAuth redirect URI
- `--scopes <scopes>`: Comma- or space-separated scopes to request
- `--state <value>`: Optional OAuth state value
- `--login-hint <email>`: Optional Google account email hint

### `login`

Usage:
```bash
autocli google gmail login [options]
```

Save a Gmail OAuth2 connection with localhost callback capture, an authorization code, or a refresh token

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
autocli google gmail status [options]
```

Check the saved Gmail OAuth connection

Options:

- `--account <name>`: Optional saved connection name

### `me`

Usage:
```bash
autocli google gmail me [options]
```

Show the current Gmail account summary

Options:

- `--account <name>`: Optional saved connection name

### `labels`

Usage:
```bash
autocli google gmail labels [options]
```

List Gmail labels

Options:

- `--account <name>`: Optional saved connection name

### `messages`

Usage:
```bash
autocli google gmail messages [options]
```

List Gmail messages

Options:

- `--account <name>`: Optional saved connection name
- `--query <query>`: Gmail search query
- `--limit <number>`: Maximum messages to return

### `message`

Usage:
```bash
autocli google gmail message [options] <id>
```

Load a single Gmail message

Options:

- `--account <name>`: Optional saved connection name

### `send`

Usage:
```bash
autocli google gmail send [options] <to> [text...]
```

Send a Gmail message

Options:

- `--subject <text>`: Message subject
- `--html <html>`: Optional HTML body
- `--cc <email>`: Optional cc recipient
- `--bcc <email>`: Optional bcc recipient
- `--account <name>`: Optional saved connection name

### `capabilities`

Usage:
```bash
autocli google gmail capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
