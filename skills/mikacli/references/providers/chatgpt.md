# ChatGPT

Generated from the real MikaCLI provider definition and command tree.

- Provider: `chatgpt`
- Category: `llm`
- Command prefix: `mikacli llm chatgpt`
- Aliases: none
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `partial`

## Description

Interact with ChatGPT using the browserless web flow, with optional cookie session inspection

## Notes

- Shared browser login works well for cookie capture and reuse.

## Fast Start

- `mikacli llm chatgpt login`
- `mikacli llm chatgpt login --cookies ./chatgpt.cookies.json`
- `mikacli llm chatgpt text "Hello my name is Justine"`
- `mikacli llm chatgpt capabilities --json`

## Default Command

Usage:
```bash
mikacli llm chatgpt [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli llm chatgpt login [options]
```

Save the ChatGPT session for future CLI use. With no auth flags, MikaCLI opens browser login by default

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
mikacli llm chatgpt status [options]
```

Show the saved ChatGPT cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
mikacli llm chatgpt text [options] <prompt...>
```

Send a text prompt to ChatGPT

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image`

Usage:
```bash
mikacli llm chatgpt image [options] <mediaPath>
```

Send an image plus optional caption or instruction to ChatGPT

Options:

- `--account <name>`: Optional saved session name to use
- `--caption <text>`: Optional instruction, caption, or edit prompt
- `--model <name>`: Optional provider model or mode hint

### `video`

Usage:
```bash
mikacli llm chatgpt video [options] <prompt...>
```

Send a video-generation prompt to ChatGPT

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `capabilities`

Usage:
```bash
mikacli llm chatgpt capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
