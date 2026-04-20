# eBay

Generated from the real MikaCLI provider definition and command tree.

- Provider: `ebay`
- Category: `shopping`
- Command prefix: `mikacli shopping ebay`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search public eBay listings, inspect item details, browse seller profiles, and get eBay autocomplete suggestions

## Notes

- none

## Fast Start

- `mikacli shopping ebay search "wireless mouse" --limit 5`
- `mikacli shopping ebay product 147218374447`
- `mikacli shopping ebay seller avicii`
- `mikacli shopping ebay capabilities --json`

## Default Command

Usage:
```bash
mikacli shopping ebay [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
mikacli shopping ebay search [options] <query>
```

Search public eBay listings without cookies or an API key

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)

### `product`

Usage:
```bash
mikacli shopping ebay product [options] <target>
```

Aliases: `item`, `info`

Load an eBay item by URL, numeric item ID, or search query

No command-specific options.

### `seller`

Usage:
```bash
mikacli shopping ebay seller [options] <target>
```

Aliases: `store`, `user`

Load a public eBay seller by profile URL or seller username

No command-specific options.

### `suggest`

Usage:
```bash
mikacli shopping ebay suggest [options] <query>
```

Aliases: `autocomplete`

Load eBay query suggestions from the public autosuggest endpoint

Options:

- `--limit <number>`: Maximum number of suggestions to return (1-25, default: 5)

### `capabilities`

Usage:
```bash
mikacli shopping ebay capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
