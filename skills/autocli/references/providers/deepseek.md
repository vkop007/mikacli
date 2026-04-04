# DeepSeek

Generated from the real AutoCLI provider definition and command tree.

- Provider: `deepseek`
- Category: `llm`
- Command prefix: `autocli llm deepseek`
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

- `autocli llm deepseek login`
- `autocli llm deepseek login --cookies ./deepseek.cookies.json --token <userToken>`
- `autocli llm deepseek text "Explain vector databases"`
- `autocli llm deepseek capabilities --json`

## Default Command

Usage:
```bash
autocli llm deepseek [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli llm deepseek login [options]
```

Save the DeepSeek session for future CLI use. With no auth flags, AutoCLI opens browser login by default

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
autocli llm deepseek status [options]
```

Show the saved DeepSeek cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
autocli llm deepseek text [options] <prompt...>
```

Send a text prompt to DeepSeek

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image`

Usage:
```bash
autocli llm deepseek image [options] <mediaPath>
```

Send an image plus optional caption or instruction to DeepSeek

Options:

- `--account <name>`: Optional saved session name to use
- `--caption <text>`: Optional instruction, caption, or edit prompt
- `--model <name>`: Optional provider model or mode hint

### `video`

Usage:
```bash
autocli llm deepseek video [options] <prompt...>
```

Send a video-generation prompt to DeepSeek

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `capabilities`

Usage:
```bash
autocli llm deepseek capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
