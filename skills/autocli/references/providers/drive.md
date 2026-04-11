# Google Drive

Generated from the real AutoCLI provider definition and command tree.

- Provider: `drive`
- Category: `google`
- Command prefix: `autocli google drive`
- Aliases: none
- Auth: `oauth2`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

List, inspect, upload, download, create folders, and delete Drive files with OAuth2

## Notes

- Uses Google's OAuth2 flow and supports Drive file listing, uploads, downloads, and deletes.

## Fast Start

- `autocli google drive login --client-id google-client-id-example --client-secret google-client-secret-example`
- `autocli google drive auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback`
- `autocli google drive login --client-id google-client-id-example --client-secret google-client-secret-example --refresh-token google-refresh-token-example`
- `autocli google drive capabilities --json`

## Default Command

Usage:
```bash
autocli google drive [command]
```

No root-only options.


## Commands

### `auth-url`

Usage:
```bash
autocli google drive auth-url [options]
```

Generate the Google OAuth consent URL for Drive

Options:

- `--client-id <id>`: Google OAuth client id
- `--redirect-uri <uri>`: OAuth redirect URI
- `--scopes <scopes>`: Comma- or space-separated scopes to request
- `--state <value>`: Optional OAuth state value
- `--login-hint <email>`: Optional Google account email hint

### `login`

Usage:
```bash
autocli google drive login [options]
```

Save a Drive OAuth2 connection with localhost callback capture, an authorization code, or a refresh token

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
autocli google drive status [options]
```

Check the saved Drive OAuth connection

Options:

- `--account <name>`: Optional saved connection name

### `me`

Usage:
```bash
autocli google drive me [options]
```

Show the current Drive account summary

Options:

- `--account <name>`: Optional saved connection name

### `files`

Usage:
```bash
autocli google drive files [options]
```

List Google Drive files

Options:

- `--account <name>`: Optional saved connection name
- `--query <query>`: Drive query string
- `--limit <number>`: Maximum files to return

### `file`

Usage:
```bash
autocli google drive file [options] <id>
```

Load a single Google Drive file

Options:

- `--account <name>`: Optional saved connection name

### `create-folder`

Usage:
```bash
autocli google drive create-folder [options] <name>
```

Create a Google Drive folder

Options:

- `--parent <id>`: Optional parent folder id
- `--account <name>`: Optional saved connection name

### `upload`

Usage:
```bash
autocli google drive upload [options] <path>
```

Upload a local file to Google Drive

Options:

- `--name <name>`: Optional Drive file name override
- `--parent <id>`: Optional parent folder id
- `--mime-type <type>`: Optional MIME type override
- `--account <name>`: Optional saved connection name

### `download`

Usage:
```bash
autocli google drive download [options] <id>
```

Download a Google Drive file to a local path

Options:

- `--output <path>`: Local output path
- `--account <name>`: Optional saved connection name

### `delete`

Usage:
```bash
autocli google drive delete [options] <id>
```

Delete a Google Drive file

Options:

- `--account <name>`: Optional saved connection name

### `capabilities`

Usage:
```bash
autocli google drive capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
