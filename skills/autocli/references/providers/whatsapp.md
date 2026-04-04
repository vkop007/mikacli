# WhatsApp

Generated from the real AutoCLI provider definition and command tree.

- Provider: `whatsapp`
- Category: `social`
- Command prefix: `autocli social whatsapp`
- Aliases: none
- Auth: `session`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Control a WhatsApp user session with QR or pairing-code login and saved auth state

## Notes

- Uses QR or pairing-code session state instead of browser cookies.

## Fast Start

- `autocli social whatsapp login`
- `autocli social whatsapp login --phone +911234567890`
- `autocli social whatsapp me`
- `autocli social whatsapp capabilities --json`

## Default Command

Usage:
```bash
autocli social whatsapp [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli social whatsapp login [options]
```

Log in to WhatsApp with a QR code or a pairing code

Options:

- `--account <name>`: Optional saved account name
- `--phone <number>`: Generate a pairing code for this phone number instead of QR login

### `status`

Usage:
```bash
autocli social whatsapp status [options]
```

Show the saved WhatsApp session status

Options:

- `--account <name>`: Optional saved account name

### `me`

Usage:
```bash
autocli social whatsapp me [options]
```

Load the current WhatsApp account profile

Options:

- `--account <name>`: Optional saved account name

### `chats`

Usage:
```bash
autocli social whatsapp chats [options]
```

List cached WhatsApp chats from the saved session

Options:

- `--account <name>`: Optional saved account name
- `--limit <count>`: Maximum chats to load

### `history`

Usage:
```bash
autocli social whatsapp history [options] <target>
```

Load cached WhatsApp messages for a user or chat jid

Options:

- `--account <name>`: Optional saved account name
- `--limit <count>`: Maximum messages to load

### `send`

Usage:
```bash
autocli social whatsapp send [options] <target> <text...>
```

Send a text message from the saved WhatsApp account

Options:

- `--account <name>`: Optional saved account name

### `capabilities`

Usage:
```bash
autocli social whatsapp capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
