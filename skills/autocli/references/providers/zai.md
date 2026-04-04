# Z.ai

Generated from the real AutoCLI provider definition and command tree.

- Provider: `zai`
- Category: `llm`
- Command prefix: `autocli llm zai`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `partial`

## Description

Interact with Z.ai using imported browser cookies, with text flows strongest today

## Notes

- none

## Fast Start

- `autocli llm zai login`
- `autocli llm zai login --cookies ./zai.cookies.json`
- `autocli llm zai text "Outline a landing page for AutoCLI"`
- `autocli llm zai capabilities --json`

## Default Command

Usage:
```bash
autocli llm zai [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli llm zai login [options]
```

Save the Z.ai session for future CLI use. With no auth flags, AutoCLI opens browser login by default

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
autocli llm zai status [options]
```

Show the saved Z.ai cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
autocli llm zai text [options] <prompt...>
```

Send a text prompt to Z.ai

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image`

Usage:
```bash
autocli llm zai image [options] <mediaPath>
```

Send an image plus optional caption or instruction to Z.ai

Options:

- `--account <name>`: Optional saved session name to use
- `--caption <text>`: Optional instruction, caption, or edit prompt
- `--model <name>`: Optional provider model or mode hint

### `video`

Usage:
```bash
autocli llm zai video [options] <prompt...>
```

Send a video-generation prompt to Z.ai

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `capabilities`

Usage:
```bash
autocli llm zai capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
