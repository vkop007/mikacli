# News

Generated from the real MikaCLI provider definition and command tree.

- Provider: `news`
- Category: `news`
- Command prefix: `mikacli news`
- Aliases: `headlines`
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Browse no-auth news sources from RSS, Google News, GDELT, Hacker News, and Reddit

## Notes

- none

## Fast Start

- `mikacli news sources`
- `mikacli news top`
- `mikacli news top "AI"`
- `mikacli news capabilities --json`

## Default Command

Usage:
```bash
mikacli news [command]
```

No root-only options.


## Commands

### `sources`

Usage:
```bash
mikacli news sources [options]
```

List the supported no-auth news sources

No command-specific options.

### `top`

Usage:
```bash
mikacli news top [options] [topic...]
```

Load top stories from the supported no-auth news sources

Options:

- `--source <source>`: Limit to one source: all, google, gdelt, hn, reddit
- `--language <code>`: Language hint used by Google News and GDELT
- `--region <code>`: Region hint used by Google News (for example US, IN, GB)
- `--subreddit <name>`: Reddit subreddit for hot listings (default: news)
- `--limit <number>`: Maximum results to return (default: 10)
- `--summary`: Fetch page summaries for the first few results
- `--summary-limit <number>`: Maximum fetched summaries (default: 3)

### `search`

Usage:
```bash
mikacli news search [options] <query...>
```

Search no-auth news sources by query

Options:

- `--source <source>`: Limit to one source: all, google, gdelt, reddit
- `--language <code>`: Language hint used by Google News and GDELT
- `--region <code>`: Region hint used by Google News (for example US, IN, GB)
- `--subreddit <name>`: Search within a Reddit subreddit
- `--limit <number>`: Maximum results to return (default: 10)
- `--summary`: Fetch page summaries for the first few results
- `--summary-limit <number>`: Maximum fetched summaries (default: 3)

### `feed`

Usage:
```bash
mikacli news feed [options] <url>
```

Read any RSS or Atom feed URL

Options:

- `--limit <number>`: Maximum results to return (default: 10)
- `--summary`: Fetch page summaries for the first few results
- `--summary-limit <number>`: Maximum fetched summaries (default: 3)

### `capabilities`

Usage:
```bash
mikacli news capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
