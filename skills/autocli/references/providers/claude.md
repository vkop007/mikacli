# Claude

Generated from the real AutoCLI provider definition and command tree.

- Provider: `claude`
- Category: `llm`
- Command prefix: `autocli llm claude`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `partial`

## Description

Interact with Claude using imported browser cookies, with text flows strongest today

## Notes

- none

## Fast Start

- `autocli llm claude login --cookies ./claude.cookies.json`
- `autocli llm claude text "Summarize this changelog"`
- `autocli llm claude image ./diagram.png --caption "Explain this architecture"`
- `autocli llm claude capabilities --json`

## Default Command

Usage:
```bash
autocli llm claude [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli llm claude login [options]
```

Import cookies and save the Claude session for future CLI use

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)

### `status`

Usage:
```bash
autocli llm claude status [options]
```

Show the saved Claude cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
autocli llm claude text [options] <prompt...>
```

Send a text prompt to Claude

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image`

Usage:
```bash
autocli llm claude image [options] <mediaPath>
```

Send an image plus optional caption or instruction to Claude

Options:

- `--account <name>`: Optional saved session name to use
- `--caption <text>`: Optional instruction, caption, or edit prompt
- `--model <name>`: Optional provider model or mode hint

### `video`

Usage:
```bash
autocli llm claude video [options] <prompt...>
```

Send a video-generation prompt to Claude

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `capabilities`

Usage:
```bash
autocli llm claude capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
