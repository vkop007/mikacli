# Mistral

Generated from the real MikaCLI provider definition and command tree.

- Provider: `mistral`
- Category: `llm`
- Command prefix: `mikacli llm mistral`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `partial`

## Description

Interact with Mistral Le Chat using the browserless web flow, with text support strongest today

## Notes

- none

## Fast Start

- `mikacli llm mistral login`
- `mikacli llm mistral login --cookies ./mistral.cookies.json`
- `mikacli llm mistral text "Draft a concise product changelog"`
- `mikacli llm mistral capabilities --json`

## Default Command

Usage:
```bash
mikacli llm mistral [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli llm mistral login [options]
```

Save the Mistral session for future CLI use. With no auth flags, MikaCLI opens browser login by default

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
mikacli llm mistral status [options]
```

Show the saved Mistral cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
mikacli llm mistral text [options] <prompt...>
```

Send a text prompt to Mistral

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image`

Usage:
```bash
mikacli llm mistral image [options] <mediaPath>
```

Send an image plus optional caption or instruction to Mistral

Options:

- `--account <name>`: Optional saved session name to use
- `--caption <text>`: Optional instruction, caption, or edit prompt
- `--model <name>`: Optional provider model or mode hint

### `video`

Usage:
```bash
mikacli llm mistral video [options] <prompt...>
```

Send a video-generation prompt to Mistral

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `capabilities`

Usage:
```bash
mikacli llm mistral capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
