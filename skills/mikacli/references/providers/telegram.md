# Telegram

Generated from the real MikaCLI provider definition and command tree.

- Provider: `telegram`
- Category: `social`
- Command prefix: `mikacli social telegram`
- Aliases: none
- Auth: `session`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Control a Telegram user account through a saved MTProto session with QR, phone, or session-string login

## Notes

- Uses saved MTProto sessions instead of browser cookies.

## Fast Start

- `mikacli social telegram login --api-id 123456 --api-hash abcdef123456 --qr`
- `mikacli social telegram login --api-id 123456 --api-hash abcdef123456 --phone +911234567890`
- `mikacli social telegram me`
- `mikacli social telegram capabilities --json`

## Default Command

Usage:
```bash
mikacli social telegram [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli social telegram login [options]
```

Log in to Telegram with a QR code, phone/code flow, or an existing session string

Options:

- `--account <name>`: Optional saved account name
- `--api-id <id>`: Telegram app api_id from my.telegram.org
- `--api-hash <hash>`: Telegram app api_hash from my.telegram.org
- `--session-string <value>`: Existing Telegram StringSession value
- `--phone <number>`: Phone number in international format for phone login
- `--code <value>`: Telegram login code if you want a non-interactive login
- `--password <value>`: Telegram 2FA password if enabled
- `--qr`: Use QR login instead of phone/code login

### `status`

Usage:
```bash
mikacli social telegram status [options]
```

Show the saved Telegram session status

Options:

- `--account <name>`: Optional saved account name

### `me`

Usage:
```bash
mikacli social telegram me [options]
```

Load the current Telegram user profile

Options:

- `--account <name>`: Optional saved account name

### `chats`

Usage:
```bash
mikacli social telegram chats [options]
```

Aliases: `dialogs`

List recent Telegram dialogs/chats

Options:

- `--account <name>`: Optional saved account name
- `--limit <count>`: Maximum chats to load

### `history`

Usage:
```bash
mikacli social telegram history [options] <target>
```

Load recent Telegram messages for a chat, user, or channel

Options:

- `--account <name>`: Optional saved account name
- `--limit <count>`: Maximum messages to load

### `send`

Usage:
```bash
mikacli social telegram send [options] <target> <text...>
```

Send a text message from the saved Telegram user account

Options:

- `--account <name>`: Optional saved account name

### `capabilities`

Usage:
```bash
mikacli social telegram capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
