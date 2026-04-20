# Discord Bot

Generated from the real MikaCLI provider definition and command tree.

- Provider: `discordbot`
- Category: `bot`
- Command prefix: `mikacli bot discordbot`
- Aliases: `discord`
- Auth: `botToken`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with Discord using a saved bot token

## Notes

- none

## Fast Start

- `mikacli bot discordbot login --token <bot-token> --name ops-bot`
- `mikacli bot discordbot me`
- `mikacli bot discordbot guilds --bot ops-bot`
- `mikacli bot discordbot capabilities --json`

## Default Command

Usage:
```bash
mikacli bot discordbot [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli bot discordbot login [options]
```

Save a Discord bot token for future REST calls

Options:

- `--token <token>`: Discord bot token to save
- `--name <botName>`: Optional bot name to save instead of the detected Discord bot username

### `status`

Usage:
```bash
mikacli bot discordbot status [options]
```

Show the saved Discord Bot connection status

Options:

- `--bot <name>`: Optional saved Discord bot name to inspect

### `me`

Usage:
```bash
mikacli bot discordbot me [options]
```

Inspect the current Discord bot identity

Options:

- `--bot <name>`: Optional saved Discord bot name to use

### `guilds`

Usage:
```bash
mikacli bot discordbot guilds [options]
```

List Discord guilds visible to the bot token

Options:

- `--bot <name>`: Optional saved Discord bot name to use

### `channels`

Usage:
```bash
mikacli bot discordbot channels [options] <guildId>
```

List channels in a Discord guild

Options:

- `--bot <name>`: Optional saved Discord bot name to use

### `history`

Usage:
```bash
mikacli bot discordbot history [options] <channelId>
```

Load recent Discord messages from a channel

Options:

- `--limit <count>`: Maximum number of messages to load (1-100)
- `--before <messageId>`: Only return messages before this message id
- `--after <messageId>`: Only return messages after this message id
- `--around <messageId>`: Return messages around this message id
- `--bot <name>`: Optional saved Discord bot name to use

### `send`

Usage:
```bash
mikacli bot discordbot send [options] <channelId> <text...>
```

Send a Discord message to a channel

Options:

- `--reply-to <messageId>`: Reply to a specific Discord message id
- `--bot <name>`: Optional saved Discord bot name to use

### `send-file`

Usage:
```bash
mikacli bot discordbot send-file [options] <channelId> <filePath>
```

Aliases: `file`

Upload a file to a Discord channel with an optional message body

Options:

- `--content <text>`: Optional message content to send with the file
- `--reply-to <messageId>`: Reply to a specific Discord message id
- `--bot <name>`: Optional saved Discord bot name to use

### `edit`

Usage:
```bash
mikacli bot discordbot edit [options] <channelId> <messageId> <text...>
```

Edit a Discord message in a channel

Options:

- `--bot <name>`: Optional saved Discord bot name to use

### `delete`

Usage:
```bash
mikacli bot discordbot delete [options] <channelId> <messageId>
```

Delete a Discord message from a channel

Options:

- `--bot <name>`: Optional saved Discord bot name to use

### `capabilities`

Usage:
```bash
mikacli bot discordbot capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
