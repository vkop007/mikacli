# Google Sheets

Generated from the real MikaCLI provider definition and command tree.

- Provider: `sheets`
- Category: `google`
- Command prefix: `mikacli google sheets`
- Aliases: none
- Auth: `oauth2`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Create spreadsheets and read or write sheet ranges with OAuth2

## Notes

- Uses Google's OAuth2 flow for spreadsheet reads and writes.

## Fast Start

- `mikacli google sheets login --client-id google-client-id-example --client-secret google-client-secret-example`
- `mikacli google sheets auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback`
- `mikacli google sheets login --client-id google-client-id-example --client-secret google-client-secret-example --refresh-token google-refresh-token-example`
- `mikacli google sheets capabilities --json`

## Default Command

Usage:
```bash
mikacli google sheets [command]
```

No root-only options.


## Commands

### `auth-url`

Usage:
```bash
mikacli google sheets auth-url [options]
```

Generate the Google OAuth consent URL for Sheets

Options:

- `--client-id <id>`: Google OAuth client id
- `--redirect-uri <uri>`: OAuth redirect URI
- `--scopes <scopes>`: Comma- or space-separated scopes to request
- `--state <value>`: Optional OAuth state value
- `--login-hint <email>`: Optional Google account email hint

### `login`

Usage:
```bash
mikacli google sheets login [options]
```

Save a Sheets OAuth2 connection with localhost callback capture, an authorization code, or a refresh token

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
mikacli google sheets status [options]
```

Check the saved Sheets OAuth connection

Options:

- `--account <name>`: Optional saved connection name

### `me`

Usage:
```bash
mikacli google sheets me [options]
```

Show the current Google profile behind the Sheets connection

Options:

- `--account <name>`: Optional saved connection name

### `create`

Usage:
```bash
mikacli google sheets create [options] <title>
```

Create a new spreadsheet

Options:

- `--sheet <name>`: Optional first sheet title
- `--account <name>`: Optional saved connection name

### `spreadsheet`

Usage:
```bash
mikacli google sheets spreadsheet [options] <spreadsheet-id>
```

Load spreadsheet metadata

Options:

- `--account <name>`: Optional saved connection name

### `values`

Usage:
```bash
mikacli google sheets values [options] <spreadsheet-id> <range>
```

Read a range from a spreadsheet

Options:

- `--account <name>`: Optional saved connection name

### `append`

Usage:
```bash
mikacli google sheets append [options] <spreadsheet-id> <range>
```

Append rows to a spreadsheet range

Options:

- `--values <json>`: JSON array of rows, for example [["Alice",42]]
- `--input-option <mode>`: RAW or USER_ENTERED value input mode
- `--account <name>`: Optional saved connection name

### `update`

Usage:
```bash
mikacli google sheets update [options] <spreadsheet-id> <range>
```

Update a spreadsheet range

Options:

- `--values <json>`: JSON array of rows, for example [["Alice",42]]
- `--input-option <mode>`: RAW or USER_ENTERED value input mode
- `--account <name>`: Optional saved connection name

### `clear`

Usage:
```bash
mikacli google sheets clear [options] <spreadsheet-id> <range>
```

Clear a spreadsheet range

Options:

- `--account <name>`: Optional saved connection name

### `capabilities`

Usage:
```bash
mikacli google sheets capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
