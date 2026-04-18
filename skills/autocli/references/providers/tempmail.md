# Temp Mail

Generated from the real AutoCLI provider definition and command tree.

- Provider: `tempmail`
- Category: `tools`
- Command prefix: `autocli tools tempmail`
- Aliases: none
- Auth: `session`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Create a free disposable inbox through Mail.tm and fetch incoming verification emails from the terminal

## Notes

- Uses Mail.tm's free disposable inbox API and stores the mailbox session locally for reuse.

## Fast Start

- `autocli tools tempmail domains`
- `autocli tools tempmail create`
- `autocli tools tempmail create --name signup-check`
- `autocli tools tempmail capabilities --json`

## Default Command

Usage:
```bash
autocli tools tempmail [command]
```

No root-only options.


## Commands

### `domains`

Usage:
```bash
autocli tools tempmail domains [options]
```

List currently available free temp-mail domains from Mail.tm

No command-specific options.

### `create`

Usage:
```bash
autocli tools tempmail create [options]
```

Create and save a new disposable mailbox

Options:

- `--account <name>`: Optional saved mailbox name
- `--name <local-part>`: Optional email local part, for example signup-check
- `--domain <domain>`: Optional preferred domain from `autocli tools tempmail domains`
- `--password <text>`: Optional mailbox password; defaults to a generated random value

### `login`

Usage:
```bash
autocli tools tempmail login [options]
```

Save an existing mailbox, or create one when --address is omitted

Options:

- `--account <name>`: Optional saved mailbox name
- `--address <email>`: Existing mailbox address to save
- `--password <text>`: Mailbox password. Required with --address; optional for new mailboxes
- `--name <local-part>`: When creating a mailbox, optional email local part
- `--domain <domain>`: When creating a mailbox, optional preferred domain

### `status`

Usage:
```bash
autocli tools tempmail status [options]
```

Check whether the saved temp mailbox still exists

Options:

- `--account <name>`: Optional saved mailbox name

### `me`

Usage:
```bash
autocli tools tempmail me [options]
```

Show the saved mailbox summary

Options:

- `--account <name>`: Optional saved mailbox name

### `inbox`

Usage:
```bash
autocli tools tempmail inbox [options]
```

List messages in the saved temp mailbox

Options:

- `--account <name>`: Optional saved mailbox name
- `--limit <number>`: Maximum messages to return (default: 20, max: 100)

### `message`

Usage:
```bash
autocli tools tempmail message [options] <id>
```

Load one temp mail message by id

Options:

- `--account <name>`: Optional saved mailbox name
- `--mark-read`: Mark the message as read after loading it

### `wait`

Usage:
```bash
autocli tools tempmail wait [options]
```

Poll until a new temp mail message arrives

Options:

- `--account <name>`: Optional saved mailbox name
- `--timeout <seconds>`: Maximum seconds to wait (default: 120)
- `--interval <seconds>`: Polling interval in seconds (default: 3)
- `--limit <number>`: Maximum recent messages to compare while polling (default: 20)

### `mark-read`

Usage:
```bash
autocli tools tempmail mark-read [options] <id>
```

Mark one temp mail message as read

Options:

- `--account <name>`: Optional saved mailbox name

### `delete-message`

Usage:
```bash
autocli tools tempmail delete-message [options] <id>
```

Delete one temp mail message

Options:

- `--account <name>`: Optional saved mailbox name

### `delete-inbox`

Usage:
```bash
autocli tools tempmail delete-inbox [options]
```

Delete the remote mailbox and remove the saved local connection

Options:

- `--account <name>`: Optional saved mailbox name

### `capabilities`

Usage:
```bash
autocli tools tempmail capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
