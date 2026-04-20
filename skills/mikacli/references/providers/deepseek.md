# DeepSeek

Generated from the real MikaCLI provider definition and command tree.

- Provider: `deepseek`
- Category: `llm`
- Command prefix: `mikacli llm deepseek`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `partial`

## Description

Interact with DeepSeek chat using imported browser cookies and optional local userToken

## Notes

- Some flows also need a token recovered from browser storage.

## Fast Start

- `mikacli llm deepseek login`
- `mikacli llm deepseek login --cookies ./deepseek.cookies.json --token <userToken>`
- `mikacli llm deepseek text "Explain vector databases"`
- `mikacli llm deepseek capabilities --json`

## Default Command

Usage:
```bash
mikacli llm deepseek [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli llm deepseek login [options]
```

Save the DeepSeek session for future CLI use. With no auth flags, MikaCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)
- `--token <value>`: DeepSeek userToken from localStorage

### `status`

Usage:
```bash
mikacli llm deepseek status [options]
```

Show the saved DeepSeek cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
mikacli llm deepseek text [options] <prompt...>
```

Send a text prompt to DeepSeek

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image`

Usage:
```bash
mikacli llm deepseek image [options] <mediaPath>
```

Send an image plus optional caption or instruction to DeepSeek

Options:

- `--account <name>`: Optional saved session name to use
- `--caption <text>`: Optional instruction, caption, or edit prompt
- `--model <name>`: Optional provider model or mode hint

### `video`

Usage:
```bash
mikacli llm deepseek video [options] <prompt...>
```

Send a video-generation prompt to DeepSeek

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `capabilities`

Usage:
```bash
mikacli llm deepseek capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
