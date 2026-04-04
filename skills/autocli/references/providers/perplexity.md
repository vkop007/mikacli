# Perplexity

Generated from the real AutoCLI provider definition and command tree.

- Provider: `perplexity`
- Category: `llm`
- Command prefix: `autocli llm perplexity`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `partial`

## Description

Interact with Perplexity using imported browser cookies, with text/search flows strongest today

## Notes

- none

## Fast Start

- `autocli llm perplexity login`
- `autocli llm perplexity login --cookies ./perplexity.cookies.json`
- `autocli llm perplexity text "Summarize the latest AI browser trends"`
- `autocli llm perplexity capabilities --json`

## Default Command

Usage:
```bash
autocli llm perplexity [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli llm perplexity login [options]
```

Save the Perplexity session for future CLI use. With no auth flags, AutoCLI opens browser login by default

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
autocli llm perplexity status [options]
```

Show the saved Perplexity cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
autocli llm perplexity text [options] <prompt...>
```

Send a text prompt to Perplexity

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `image`

Usage:
```bash
autocli llm perplexity image [options] <mediaPath>
```

Send an image plus optional caption or instruction to Perplexity

Options:

- `--account <name>`: Optional saved session name to use
- `--caption <text>`: Optional instruction, caption, or edit prompt
- `--model <name>`: Optional provider model or mode hint

### `video`

Usage:
```bash
autocli llm perplexity video [options] <prompt...>
```

Send a video-generation prompt to Perplexity

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint

### `capabilities`

Usage:
```bash
autocli llm perplexity capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
