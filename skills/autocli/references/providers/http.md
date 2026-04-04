# HTTP Toolkit

Generated from the real AutoCLI provider definition and command tree.

- Provider: `http`
- Category: `tools`
- Command prefix: `autocli tools http`
- Aliases: none
- Auth: `none`, `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Inspect sessions, capture logged-in browser traffic, and replay authenticated requests

## Notes

- Best used with saved sessions or the shared browser profile for authenticated request inspection and replay.

## Fast Start

- `autocli tools http github inspect`
- `autocli tools http github cookies`
- `autocli tools http github storage`
- `autocli tools http capabilities --json`

## Default Command

Usage:
```bash
autocli tools http [options] [command] <target> <operation> [args...]
```

Options:

- `--platform <provider>`: Force a provider when a domain matches multiple cookie-backed platforms
- `--account <name>`: Saved session account to use
- `--browser`: Borrow cookies from the shared AutoCLI browser profile instead of a saved session
- `--browser-timeout <seconds>`: Browser wait timeout in seconds
- `--limit <number>`: Capture result limit (default: 25)
- `--filter <text>`: Only include captured requests whose URL contains this text
- `--summary`: Summarize captured requests into likely useful endpoint groups
- `--group-by <mode>`: Capture summary grouping: endpoint, full-url, method, or status
- `--timeout <ms>`: Request timeout in milliseconds
- `--header <header>`: Request header in 'Name: value' form
- `--body <text>`: Raw request body for request
- `--json-body <json>`: JSON request body for request
- `--output <path>`: Output file path for download
- `--query <text>`: GraphQL query text
- `--variables <json>`: GraphQL variables JSON
- `--operation-name <name>`: GraphQL operation name
- `--path <path>`: Relative path or full URL for graphql/download request targets


## Commands

### `capabilities`

Usage:
```bash
autocli tools http capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
