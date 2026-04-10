# Trello

Generated from the real AutoCLI provider definition and command tree.

- Provider: `trello`
- Category: `developer`
- Command prefix: `autocli developer trello`
- Aliases: none
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Use a saved Trello web session to inspect boards, lists, and cards

## Notes

- none

## Fast Start

- `autocli developer trello login`
- `autocli developer trello login --cookies ./trello.cookies.json`
- `autocli developer trello me`
- `autocli developer trello capabilities --json`

## Default Command

Usage:
```bash
autocli developer trello [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli developer trello login [options]
```

Save the Trello web session for future CLI use. With no auth flags, AutoCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `status`

Usage:
```bash
autocli developer trello status [options]
```

Show the saved Trello session status

Options:

- `--account <name>`: Optional saved Trello session name to inspect

### `me`

Usage:
```bash
autocli developer trello me [options]
```

Aliases: `whoami`

Load the authenticated Trello account

No command-specific options.

### `boards`

Usage:
```bash
autocli developer trello boards [options] [query]
```

List Trello boards for the authenticated account

Options:

- `--limit <number>`: Maximum boards to load (default: 20)

### `board`

Usage:
```bash
autocli developer trello board [options] <target>
```

Load a single Trello board by ID, short link, or URL

No command-specific options.

### `lists`

Usage:
```bash
autocli developer trello lists [options] <board>
```

List open Trello lists for a board

No command-specific options.

### `cards`

Usage:
```bash
autocli developer trello cards [options] <board>
```

List open Trello cards on a board

Options:

- `--list <target>`: Filter cards to a specific list by ID or exact name
- `--limit <number>`: Maximum cards to load (default: 20)

### `card`

Usage:
```bash
autocli developer trello card [options] <target>
```

Load a single Trello card by ID, short link, or URL

No command-specific options.

### `create-card`

Usage:
```bash
autocli developer trello create-card [options] <board>
```

Create a Trello card on a board you can edit

Options:

- `--list <target>`: Destination list ID or exact name (defaults to the first open list)
- `--name <text>`: Card title
- `--description <text>`: Card description

### `capabilities`

Usage:
```bash
autocli developer trello capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
