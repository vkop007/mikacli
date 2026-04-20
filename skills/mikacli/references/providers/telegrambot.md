# Telegram Bot

Generated from the real MikaCLI provider definition and command tree.

- Provider: `telegrambot`
- Category: `bot`
- Command prefix: `mikacli bot telegrambot`
- Aliases: `telegram`
- Auth: `botToken`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with Telegram Bot API using a saved bot token

## Notes

- none

## Fast Start

- `mikacli bot telegrambot login --token 123456:ABCDEF --name alerts-bot`
- `mikacli bot telegrambot me`
- `mikacli bot telegrambot me --bot alerts-bot`
- `mikacli bot telegrambot capabilities --json`

## Default Command

Usage:
```bash
mikacli bot telegrambot [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli bot telegrambot login [options]
```

Save a Telegram bot token for future API use

Options:

- `--token <value>`: Telegram bot token from BotFather
- `--name <botName>`: Optional bot name to save instead of the detected Telegram bot username

### `status`

Usage:
```bash
mikacli bot telegrambot status [options]
```

Show the saved Telegram Bot connection status

Options:

- `--bot <name>`: Optional saved Telegram bot name to inspect

### `me`

Usage:
```bash
mikacli bot telegrambot me [options]
```

Show the saved Telegram bot profile

Options:

- `--bot <name>`: Optional saved Telegram bot name to use

### `getchat`

Usage:
```bash
mikacli bot telegrambot getchat [options] <chatId>
```

Aliases: `chat`

Load a Telegram chat by chat id or public @username

Options:

- `--bot <name>`: Optional saved Telegram bot name to use

### `chats`

Usage:
```bash
mikacli bot telegrambot chats [options]
```

List recent chats seen by the bot in updates

Options:

- `--limit <number>`: Maximum number of updates to inspect
- `--offset <number>`: Update offset for pagination
- `--bot <name>`: Optional saved Telegram bot name to use

### `updates`

Usage:
```bash
mikacli bot telegrambot updates [options]
```

Fetch recent Telegram bot updates

Options:

- `--limit <number>`: Maximum number of updates to fetch
- `--offset <number>`: Update offset for pagination
- `--bot <name>`: Optional saved Telegram bot name to use

### `send`

Usage:
```bash
mikacli bot telegrambot send [options] <chatId> <text...>
```

Send a Telegram text message to a chat id or public @username

Options:

- `--parse-mode <mode>`: Optional Telegram parse mode such as MarkdownV2 or HTML
- `--disable-web-page-preview`: Disable link previews in the message body
- `--reply-to <messageId>`: Reply to a specific message id
- `--bot <name>`: Optional saved Telegram bot name to use

### `send-photo`

Usage:
```bash
mikacli bot telegrambot send-photo [options] <chatId> <photo>
```

Aliases: `photo`

Send a Telegram photo from a URL, file path, or file id

Options:

- `--caption <text>`: Optional photo caption
- `--parse-mode <mode>`: Optional Telegram parse mode for the caption
- `--reply-to <messageId>`: Reply to a specific message id
- `--bot <name>`: Optional saved Telegram bot name to use

### `send-document`

Usage:
```bash
mikacli bot telegrambot send-document [options] <chatId> <document>
```

Aliases: `document`

Send a Telegram document from a URL, file path, or file id

Options:

- `--caption <text>`: Optional document caption
- `--parse-mode <mode>`: Optional Telegram parse mode for the caption
- `--reply-to <messageId>`: Reply to a specific message id
- `--bot <name>`: Optional saved Telegram bot name to use

### `send-video`

Usage:
```bash
mikacli bot telegrambot send-video [options] <chatId> <video>
```

Aliases: `video`

Send a Telegram video from a URL, file path, or file id

Options:

- `--caption <text>`: Optional video caption
- `--parse-mode <mode>`: Optional Telegram parse mode for the caption
- `--reply-to <messageId>`: Reply to a specific message id
- `--bot <name>`: Optional saved Telegram bot name to use

### `send-audio`

Usage:
```bash
mikacli bot telegrambot send-audio [options] <chatId> <audio>
```

Aliases: `audio`

Send a Telegram audio file from a URL, file path, or file id

Options:

- `--caption <text>`: Optional audio caption
- `--parse-mode <mode>`: Optional Telegram parse mode for the caption
- `--reply-to <messageId>`: Reply to a specific message id
- `--bot <name>`: Optional saved Telegram bot name to use

### `send-voice`

Usage:
```bash
mikacli bot telegrambot send-voice [options] <chatId> <voice>
```

Aliases: `voice`

Send a Telegram voice note from a URL, file path, or file id

Options:

- `--caption <text>`: Optional voice caption
- `--parse-mode <mode>`: Optional Telegram parse mode for the caption
- `--reply-to <messageId>`: Reply to a specific message id
- `--bot <name>`: Optional saved Telegram bot name to use

### `edit`

Usage:
```bash
mikacli bot telegrambot edit [options] <chatId> <messageId> <text...>
```

Edit a Telegram message text or caption

Options:

- `--caption`: Edit the message caption instead of the text
- `--parse-mode <mode>`: Optional Telegram parse mode
- `--disable-web-page-preview`: Disable link previews when editing text
- `--bot <name>`: Optional saved Telegram bot name to use

### `delete`

Usage:
```bash
mikacli bot telegrambot delete [options] <chatId> <messageId>
```

Delete a Telegram message

Options:

- `--bot <name>`: Optional saved Telegram bot name to use

### `capabilities`

Usage:
```bash
mikacli bot telegrambot capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
