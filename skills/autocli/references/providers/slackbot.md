# Slack Bot

Generated from the real AutoCLI provider definition and command tree.

- Provider: `slackbot`
- Category: `bot`
- Command prefix: `autocli bot slackbot`
- Aliases: `slack`
- Auth: `botToken`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Interact with Slack using a saved bot token

## Notes

- none

## Fast Start

- `autocli bot slackbot login --token xoxb-123 --name alerts-bot`
- `autocli bot slackbot me`
- `autocli bot slackbot me --bot alerts-bot`
- `autocli bot slackbot capabilities --json`

## Default Command

Usage:
```bash
autocli bot slackbot [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli bot slackbot login [options]
```

Save a Slack bot token for future commands

Options:

- `--token <token>`: Slack bot token to save
- `--name <botName>`: Optional bot name to save instead of the detected Slack identity

### `me`

Usage:
```bash
autocli bot slackbot me [options]
```

Aliases: `auth-test`

Show the saved Slack bot identity and verify the token

Options:

- `--bot <name>`: Optional saved Slack bot name to use

### `channels`

Usage:
```bash
autocli bot slackbot channels [options]
```

List visible Slack channels

Options:

- `--bot <name>`: Optional saved Slack bot name to use

### `history`

Usage:
```bash
autocli bot slackbot history [options] <channel>
```

Load recent Slack messages from a channel

Options:

- `--limit <count>`: Maximum number of messages to load
- `--cursor <cursor>`: Pagination cursor from a previous history call
- `--latest <ts>`: Only include messages at or before this Slack timestamp
- `--oldest <ts>`: Only include messages at or after this Slack timestamp
- `--bot <name>`: Optional saved Slack bot name to use

### `send`

Usage:
```bash
autocli bot slackbot send [options] <channel> <text...>
```

Send a message to a Slack channel

Options:

- `--thread-ts <ts>`: Reply in a Slack thread using the parent message ts
- `--bot <name>`: Optional saved Slack bot name to use

### `send-file`

Usage:
```bash
autocli bot slackbot send-file [options] <channel> <filePath>
```

Aliases: `file`

Upload a file to a Slack channel

Options:

- `--title <title>`: Optional file title shown in Slack
- `--comment <text>`: Optional message to send with the file
- `--thread-ts <ts>`: Reply in a Slack thread using the parent message ts
- `--bot <name>`: Optional saved Slack bot name to use

### `edit`

Usage:
```bash
autocli bot slackbot edit [options] <channel> <ts> <text...>
```

Edit a Slack message

Options:

- `--bot <name>`: Optional saved Slack bot name to use

### `delete`

Usage:
```bash
autocli bot slackbot delete [options] <channel> <ts>
```

Delete a Slack message

Options:

- `--bot <name>`: Optional saved Slack bot name to use

### `capabilities`

Usage:
```bash
autocli bot slackbot capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
