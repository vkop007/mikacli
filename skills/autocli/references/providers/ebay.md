# eBay

Generated from the real AutoCLI provider definition and command tree.

- Provider: `ebay`
- Category: `shopping`
- Command prefix: `autocli shopping ebay`
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

- `autocli shopping ebay search "wireless mouse" --limit 5`
- `autocli shopping ebay product 147218374447`
- `autocli shopping ebay seller avicii`
- `autocli shopping ebay capabilities --json`

## Default Command

Usage:
```bash
autocli shopping ebay [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli shopping ebay search [options] <query>
```

Search public eBay listings without cookies or an API key

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)

### `product`

Usage:
```bash
autocli shopping ebay product [options] <target>
```

Aliases: `item`, `info`

Load an eBay item by URL, numeric item ID, or search query

No command-specific options.

### `seller`

Usage:
```bash
autocli shopping ebay seller [options] <target>
```

Aliases: `store`, `user`

Load a public eBay seller by profile URL or seller username

No command-specific options.

### `suggest`

Usage:
```bash
autocli shopping ebay suggest [options] <query>
```

Aliases: `autocomplete`

Load eBay query suggestions from the public autosuggest endpoint

Options:

- `--limit <number>`: Maximum number of suggestions to return (1-25, default: 5)

### `capabilities`

Usage:
```bash
autocli shopping ebay capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
