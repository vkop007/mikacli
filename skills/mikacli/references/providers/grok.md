# Grok

Generated from the real MikaCLI provider definition and command tree.

- Provider: `grok`
- Category: `llm`
- Command prefix: `mikacli llm grok`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `supported`

## Description

Interact with Grok using imported browser cookies

## Notes

- MikaCLI can fall back to an in-browser Grok request path when the browserless endpoint is blocked.

## Fast Start

- `mikacli llm grok login`
- `mikacli llm grok login --cookies ./grok.cookies.json`
- `mikacli llm grok text "Summarize this sprint"`
- `mikacli llm grok capabilities --json`

## Default Command

Usage:
```bash
mikacli llm grok [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli llm grok login [options]
```

Save the Grok session for future CLI use. With no auth flags, MikaCLI opens browser login by default

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
mikacli llm grok status [options]
```

Show the saved Grok cookie-session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `text`

Usage:
```bash
mikacli llm grok text [options] <prompt...>
```

Send a text prompt to Grok

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint
- `--browser`: Force Grok to run the prompt through the real web app in a browser context
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser-backed Grok flow to complete

### `image`

Usage:
```bash
mikacli llm grok image [options] <prompt...>
```

Generate Grok images from a text prompt

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint
- `--browser`: Force Grok to run image generation through the real web app in a browser context
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser-backed Grok flow to complete

### `image-download`

Usage:
```bash
mikacli llm grok image-download [options] <target>
```

Download or reopen a saved Grok image job by job ID, conversation ID, or response ID

Options:

- `--account <name>`: Optional saved session name to use
- `--output-dir <path>`: Directory to write the downloaded image files into

### `video`

Usage:
```bash
mikacli llm grok video [options] <prompt...>
```

Generate a Grok video from a text prompt

Options:

- `--account <name>`: Optional saved session name to use
- `--model <name>`: Optional provider model or mode hint
- `--browser`: Force Grok to run video generation through the real web app in a browser context
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser-backed Grok flow to complete

### `video-status`

Usage:
```bash
mikacli llm grok video-status [options] <target>
```

Load the current status for a saved Grok video job by job ID, conversation ID, or provider video ID

Options:

- `--account <name>`: Optional saved session name to use

### `video-wait`

Usage:
```bash
mikacli llm grok video-wait [options] <target>
```

Wait for a Grok video job to finish and expose its downloadable asset URL

Options:

- `--account <name>`: Optional saved session name to use
- `--timeout <seconds>`: Maximum seconds to wait before returning
- `--interval <seconds>`: Polling interval in seconds

### `video-download`

Usage:
```bash
mikacli llm grok video-download [options] <target>
```

Download a completed Grok video job by job ID, conversation ID, or provider video ID

Options:

- `--account <name>`: Optional saved session name to use
- `--output-dir <path>`: Directory to write the downloaded video into

### `video-cancel`

Usage:
```bash
mikacli llm grok video-cancel [options] <target>
```

Request cancellation for a currently inflight Grok video job

Options:

- `--account <name>`: Optional saved session name to use

### `capabilities`

Usage:
```bash
mikacli llm grok capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
