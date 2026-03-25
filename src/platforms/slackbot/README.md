# Slack Bot

Slackbot uses the shared bot-token connection flow.

Commands:

- `login --token <token> [--name <bot-name>]`
- `me` or `auth-test` with optional `--bot <bot-name>`
- `channels [--bot <bot-name>]`
- `history <channel> [--bot <bot-name>]`
- `send <channel> <text...> [--bot <bot-name>]`
- `send-file <channel> <filePath> [--bot <bot-name>]`
- `edit <channel> <ts> <text...> [--bot <bot-name>]`
- `delete <channel> <ts> [--bot <bot-name>]`

Notes:

- Saved credentials are stored through `ConnectionStore.saveBotTokenConnection(...)`.
- Subsequent commands load credentials through `ConnectionStore.loadBotTokenConnection(...)`.
- `channels` lists public and private channels visible to the token.
- Channel arguments accept `#name`, `name`, or a raw Slack channel id like `C123...`.
