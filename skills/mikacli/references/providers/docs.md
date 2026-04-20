# Google Docs

Generated from the real MikaCLI provider definition and command tree.

- Provider: `docs`
- Category: `google`
- Command prefix: `mikacli google docs`
- Aliases: none
- Auth: `oauth2`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

List Google Docs files, read document content, create docs, and edit text with OAuth2

## Notes

- Uses Google's OAuth2 flow for Google Docs listing, content reads, document creation, and text edits.

## Fast Start

- `mikacli google docs login --client-id google-client-id-example --client-secret google-client-secret-example`
- `mikacli google docs auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback`
- `mikacli google docs documents --limit 10 --json`
- `mikacli google docs capabilities --json`

## Default Command

Usage:
```bash
mikacli google docs [command]
```

No root-only options.


## Commands

### `auth-url`

Usage:
```bash
mikacli google docs auth-url [options]
```

Generate the Google OAuth consent URL for Docs

Options:

- `--client-id <id>`: Google OAuth client id
- `--redirect-uri <uri>`: OAuth redirect URI
- `--scopes <scopes>`: Comma- or space-separated scopes to request
- `--state <value>`: Optional OAuth state value
- `--login-hint <email>`: Optional Google account email hint

### `login`

Usage:
```bash
mikacli google docs login [options]
```

Save a Docs OAuth2 connection with localhost callback capture, an authorization code, or a refresh token

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
mikacli google docs status [options]
```

Check the saved Docs OAuth connection

Options:

- `--account <name>`: Optional saved connection name

### `me`

Usage:
```bash
mikacli google docs me [options]
```

Show the current Google profile behind the Docs connection

Options:

- `--account <name>`: Optional saved connection name

### `documents`

Usage:
```bash
mikacli google docs documents [options]
```

List Google Docs files

Options:

- `--query <query>`: Optional Drive query fragment, for example name contains 'Launch'
- `--limit <number>`: Maximum documents to return
- `--account <name>`: Optional saved connection name

### `document`

Usage:
```bash
mikacli google docs document [options] <document-id>
```

Load a single Google Doc

Options:

- `--account <name>`: Optional saved connection name

### `content`

Usage:
```bash
mikacli google docs content [options] <document-id>
```

Read plain text content from a Google Doc

Options:

- `--account <name>`: Optional saved connection name

### `create`

Usage:
```bash
mikacli google docs create [options] <title>
```

Create a new Google Doc

Options:

- `--text <value>`: Optional initial document text
- `--account <name>`: Optional saved connection name

### `append-text`

Usage:
```bash
mikacli google docs append-text [options] <document-id> <text...>
```

Append plain text to the end of a Google Doc

Options:

- `--account <name>`: Optional saved connection name

### `replace-text`

Usage:
```bash
mikacli google docs replace-text [options] <document-id>
```

Replace matching text throughout a Google Doc

Options:

- `--search <text>`: Text to search for
- `--replace <text>`: Replacement text
- `--match-case`: Match the search text case-sensitively
- `--account <name>`: Optional saved connection name

### `capabilities`

Usage:
```bash
mikacli google docs capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
