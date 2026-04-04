# News

Generated from the real AutoCLI provider definition and command tree.

- Provider: `news`
- Category: `news`
- Command prefix: `autocli news`
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

- `autocli news sources`
- `autocli news top`
- `autocli news top "AI"`
- `autocli news capabilities --json`

## Default Command

Usage:
```bash
autocli news [command]
```

No root-only options.


## Commands

### `sources`

Usage:
```bash
autocli news sources [options]
```

List the supported no-auth news sources

No command-specific options.

### `top`

Usage:
```bash
autocli news top [options] [topic...]
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
autocli news search [options] <query...>
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
autocli news feed [options] <url>
```

Read any RSS or Atom feed URL

Options:

- `--limit <number>`: Maximum results to return (default: 10)
- `--summary`: Fetch page summaries for the first few results
- `--summary-limit <number>`: Maximum fetched summaries (default: 3)

### `capabilities`

Usage:
```bash
autocli news capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
