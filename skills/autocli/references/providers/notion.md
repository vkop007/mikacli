# Notion

Generated from the real AutoCLI provider definition and command tree.

- Provider: `notion`
- Category: `developer`
- Command prefix: `autocli developer notion`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Use a saved Notion web session to search, inspect, and edit pages and databases

## Notes

- none

## Fast Start

- `autocli developer notion login`
- `autocli developer notion login --cookies ./notion.cookies.json`
- `autocli developer notion me`
- `autocli developer notion capabilities --json`

## Default Command

Usage:
```bash
autocli developer notion [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli developer notion login [options]
```

Save the Notion web session for future CLI use. With no auth flags, AutoCLI opens browser login by default

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
autocli developer notion status [options]
```

Show the saved Notion session status

Options:

- `--account <name>`: Optional saved Notion session name to inspect

### `me`

Usage:
```bash
autocli developer notion me [options]
```

Aliases: `whoami`

Load the authenticated Notion web identity

No command-specific options.

### `search`

Usage:
```bash
autocli developer notion search [options] [query]
```

Search Notion pages and databases the saved web session can access

Options:

- `--limit <number>`: Maximum results to return (default: 20)

### `pages`

Usage:
```bash
autocli developer notion pages [options] [query]
```

List Notion pages the saved web session can access

Options:

- `--limit <number>`: Maximum pages to return (default: 20)

### `page`

Usage:
```bash
autocli developer notion page [options] <target>
```

Load a single Notion page by page ID or page URL

No command-specific options.

### `create-page`

Usage:
```bash
autocli developer notion create-page [options]
```

Create a new Notion page under a page or database the saved web session can edit

Options:

- `--parent <target>`: Parent Notion page or data source ID/URL
- `--title <text>`: Page title
- `--content <text>`: Optional initial paragraph content

### `update-page`

Usage:
```bash
autocli developer notion update-page [options] <target>
```

Update a Notion page title or archive the page

Options:

- `--title <text>`: New page title
- `--archive`: Archive the page instead of deleting it

### `append`

Usage:
```bash
autocli developer notion append [options] <target>
```

Append paragraph text to a Notion page

Options:

- `--text <text>`: Text to append as paragraph blocks

### `databases`

Usage:
```bash
autocli developer notion databases [options] [query]
```

Aliases: `data-sources`

List Notion databases the saved web session can access

Options:

- `--limit <number>`: Maximum data sources to return (default: 20)

### `database`

Usage:
```bash
autocli developer notion database [options] <target>
```

Aliases: `datasource`

Load a single Notion data source by ID or URL

No command-specific options.

### `query`

Usage:
```bash
autocli developer notion query [options] <target>
```

Query rows from a Notion data source

Options:

- `--limit <number>`: Maximum rows to load (default: 20)

### `comment`

Usage:
```bash
autocli developer notion comment [options] <target>
```

Add a comment to a Notion page

Options:

- `--text <text>`: Comment text

### `capabilities`

Usage:
```bash
autocli developer notion capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
