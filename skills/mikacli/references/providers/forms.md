# Google Forms

Generated from the real MikaCLI provider definition and command tree.

- Provider: `forms`
- Category: `google`
- Command prefix: `mikacli google forms`
- Aliases: none
- Auth: `oauth2`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

List forms, inspect responses, create surveys, add questions, and manage publish state with OAuth2

## Notes

- Uses Google's OAuth2 flow plus Drive-backed listing and deletion for Google Forms CRUD, responses, and publish settings.

## Fast Start

- `mikacli google forms login --client-id google-client-id-example --client-secret google-client-secret-example`
- `mikacli google forms auth-url --client-id google-client-id-example --redirect-uri http://127.0.0.1:3333/callback`
- `mikacli google forms forms --limit 10 --json`
- `mikacli google forms capabilities --json`

## Default Command

Usage:
```bash
mikacli google forms [command]
```

No root-only options.


## Commands

### `auth-url`

Usage:
```bash
mikacli google forms auth-url [options]
```

Generate the Google OAuth consent URL for Forms

Options:

- `--client-id <id>`: Google OAuth client id
- `--redirect-uri <uri>`: OAuth redirect URI
- `--scopes <scopes>`: Comma- or space-separated scopes to request
- `--state <value>`: Optional OAuth state value
- `--login-hint <email>`: Optional Google account email hint

### `login`

Usage:
```bash
mikacli google forms login [options]
```

Save a Forms OAuth2 connection with localhost callback capture, an authorization code, or a refresh token

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
mikacli google forms status [options]
```

Check the saved Forms OAuth connection

Options:

- `--account <name>`: Optional saved connection name

### `me`

Usage:
```bash
mikacli google forms me [options]
```

Show the current Google profile behind the Forms connection

Options:

- `--account <name>`: Optional saved connection name

### `forms`

Usage:
```bash
mikacli google forms forms [options]
```

List Google Forms files

Options:

- `--query <query>`: Optional Drive query fragment, for example name contains 'Survey'
- `--limit <number>`: Maximum forms to return
- `--account <name>`: Optional saved connection name

### `form`

Usage:
```bash
mikacli google forms form [options] <form-id>
```

Load a single Google Form

Options:

- `--account <name>`: Optional saved connection name

### `responses`

Usage:
```bash
mikacli google forms responses [options] <form-id>
```

List responses for a Google Form

Options:

- `--filter <value>`: Optional Google Forms response filter
- `--limit <number>`: Maximum responses to return
- `--account <name>`: Optional saved connection name

### `response`

Usage:
```bash
mikacli google forms response [options] <form-id> <response-id>
```

Load a single Google Form response

Options:

- `--account <name>`: Optional saved connection name

### `create`

Usage:
```bash
mikacli google forms create [options] <title>
```

Create a new Google Form

Options:

- `--description <text>`: Optional form description
- `--document-title <text>`: Optional Drive document title
- `--unpublished`: Create the form in an unpublished state when supported
- `--account <name>`: Optional saved connection name

### `update-info`

Usage:
```bash
mikacli google forms update-info [options] <form-id>
```

Update the title or description of a Google Form

Options:

- `--title <text>`: Updated form title
- `--description <text>`: Updated form description
- `--account <name>`: Optional saved connection name

### `add-text-question`

Usage:
```bash
mikacli google forms add-text-question [options] <form-id>
```

Add a short-text or paragraph question to a Google Form

Options:

- `--title <text>`: Question title
- `--description <text>`: Optional question description
- `--required`: Require a response before submit
- `--index <number>`: Optional item index to insert at
- `--paragraph`: Create a paragraph question instead of a short-text question
- `--account <name>`: Optional saved connection name

### `add-choice-question`

Usage:
```bash
mikacli google forms add-choice-question [options] <form-id>
```

Add a radio, checkbox, or drop-down question to a Google Form

Options:

- `--title <text>`: Question title
- `--options <values>`: Choice options separated by | or ,
- `--description <text>`: Optional question description
- `--required`: Require a response before submit
- `--index <number>`: Optional item index to insert at
- `--type <kind>`: Question type: RADIO, CHECKBOX, or DROP_DOWN
- `--shuffle`: Shuffle answer options
- `--account <name>`: Optional saved connection name

### `delete-item`

Usage:
```bash
mikacli google forms delete-item [options] <form-id>
```

Delete an item from a Google Form by index

Options:

- `--index <number>`: Item index to delete
- `--account <name>`: Optional saved connection name

### `publish`

Usage:
```bash
mikacli google forms publish [options] <form-id>
```

Publish or unpublish a Google Form and control whether it accepts responses

Options:

- `--published <value>`: Whether the form should be published
- `--accepting-responses <value>`: Whether the form should accept responses
- `--account <name>`: Optional saved connection name

### `delete`

Usage:
```bash
mikacli google forms delete [options] <form-id>
```

Delete a Google Form from Drive

Options:

- `--account <name>`: Optional saved connection name

### `capabilities`

Usage:
```bash
mikacli google forms capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
