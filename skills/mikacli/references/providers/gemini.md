# Gemini

Generated from the real MikaCLI provider definition and command tree.

- Provider: `gemini`
- Category: `llm`
- Command prefix: `mikacli llm gemini`
- Aliases: none
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `partial`

## Description

Interact with Gemini using imported browser cookies

## Notes

- none

## Fast Start

- `mikacli llm gemini login`
- `mikacli llm gemini login --cookies ./gemini.cookies.json`
- `mikacli llm gemini text "Draft a polite follow-up email"`
- `mikacli llm gemini capabilities --json`

## Default Command

Usage:
```bash
mikacli llm gemini [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli llm gemini login [options]
```

Save the Gemini session for future CLI use. With no auth flags, MikaCLI opens browser login by default

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
mikacli llm gemini status [options]
```

Show the saved Gemini cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
mikacli llm gemini text [options] <prompt...>
```

Send a text prompt to Gemini

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image`

Usage:
```bash
mikacli llm gemini image [options] <mediaPath>
```

Send an image plus optional caption or instruction to Gemini

Options:

- `--account <name>`: Optional saved session name to use
- `--caption <text>`: Optional instruction, caption, or edit prompt
- `--model <name>`: Optional provider model or mode hint

### `video`

Usage:
```bash
mikacli llm gemini video [options] <prompt...>
```

Send a video-generation prompt to Gemini

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image-download`

Usage:
```bash
mikacli llm gemini image-download [options] <target>
```

Download or reopen a saved Gemini image job by job ID, conversation ID, or provider output ID

Options:

- `--account <name>`: Optional saved session name to use
- `--output-dir <path>`: Directory to write the downloaded image files into

### `video-download`

Usage:
```bash
mikacli llm gemini video-download [options] <target>
```

Download or reopen a saved Gemini video job by job ID, conversation ID, or provider output ID

Options:

- `--account <name>`: Optional saved session name to use
- `--output-dir <path>`: Directory to write the downloaded video into

### `capabilities`

Usage:
```bash
mikacli llm gemini capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
