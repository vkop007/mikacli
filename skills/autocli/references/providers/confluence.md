# Confluence

Generated from the real AutoCLI provider definition and command tree.

- Provider: `confluence`
- Category: `developer`
- Command prefix: `autocli developer confluence`
- Aliases: none
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Use a saved Confluence web session to search, inspect, and edit your workspace pages

## Notes

- none

## Fast Start

- `autocli developer confluence login --site https://your-workspace.atlassian.net/wiki`
- `autocli developer confluence login --cookies ./confluence.cookies.json --site https://your-workspace.atlassian.net/wiki`
- `autocli developer confluence me`
- `autocli developer confluence capabilities --json`

## Default Command

Usage:
```bash
autocli developer confluence [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli developer confluence login [options]
```

Save the Confluence web session for future CLI use. With no auth flags, AutoCLI opens browser login by default

Options:

- `--cookies <path>`: Path to cookies.txt or a JSON cookie export
- `--account <name>`: Optional saved alias instead of the default session name
- `--cookie-string <value>`: Raw cookie string instead of a file
- `--cookie-json <json>`: Inline JSON cookie array or jar export
- `--browser`: Open a real browser, wait for manual login, then save the extracted session (default when no cookie flags are provided)
- `--browser-timeout <seconds>`: Maximum seconds to wait for manual browser login (default: 600)
- `--site <url>`: Confluence site URL, like https://your-workspace.atlassian.net/wiki

### `me`

Usage:
```bash
autocli developer confluence me [options]
```

Load the current Confluence account identity

No command-specific options.

### `spaces`

Usage:
```bash
autocli developer confluence spaces [options] [query]
```

List Confluence spaces available to the saved account

Options:

- `--limit <number>`: Maximum spaces to load (default: 20)

### `search`

Usage:
```bash
autocli developer confluence search [options] <query>
```

Search Confluence pages the saved web session can read

Options:

- `--space <key>`: Optional Confluence space key filter
- `--limit <number>`: Maximum pages to load (default: 20)

### `page`

Usage:
```bash
autocli developer confluence page [options] <target>
```

Load a Confluence page by page ID, page URL, or fallback search text

No command-specific options.

### `children`

Usage:
```bash
autocli developer confluence children [options] <target>
```

List direct child pages for a Confluence page

Options:

- `--limit <number>`: Maximum child pages to load (default: 20)

### `create-page`

Usage:
```bash
autocli developer confluence create-page [options]
```

Create a new Confluence page in a space, with an optional parent and body

Options:

- `--space <key>`: Confluence space key
- `--title <text>`: Page title
- `--parent <target>`: Optional parent page ID or URL
- `--body <text>`: Optional initial page body as plain text paragraphs

### `update-page`

Usage:
```bash
autocli developer confluence update-page [options] <target>
```

Update a Confluence page title or body

Options:

- `--title <text>`: New page title
- `--body <text>`: Replacement page body as plain text paragraphs
- `--minor`: Mark the edit as a minor update

### `comment`

Usage:
```bash
autocli developer confluence comment [options] <target>
```

Add a plain-text comment to a Confluence page

Options:

- `--text <text>`: Comment text

### `capabilities`

Usage:
```bash
autocli developer confluence capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
