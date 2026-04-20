# Qwen

Generated from the real MikaCLI provider definition and command tree.

- Provider: `qwen`
- Category: `llm`
- Command prefix: `mikacli llm qwen`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `partial`

## Description

Interact with Qwen using imported browser cookies, with optional bearer-token override when the token cookie is missing

## Notes

- none

## Fast Start

- `mikacli llm qwen login`
- `mikacli llm qwen login --cookies ./qwen.cookies.json`
- `mikacli llm qwen login --cookies ./qwen.cookies.json --token <bearerToken>`
- `mikacli llm qwen capabilities --json`

## Default Command

Usage:
```bash
mikacli llm qwen [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli llm qwen login [options]
```

Save the Qwen session for future CLI use. With no auth flags, MikaCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)
- `--token <value>`: Optional bearer token if the cookie export does not include the token cookie

### `status`

Usage:
```bash
mikacli llm qwen status [options]
```

Show the saved Qwen cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
mikacli llm qwen text [options] <prompt...>
```

Send a text prompt to Qwen

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional Qwen model name

### `capabilities`

Usage:
```bash
mikacli llm qwen capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
