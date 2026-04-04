# Etsy

Generated from the real AutoCLI provider definition and command tree.

- Provider: `etsy`
- Category: `shopping`
- Command prefix: `autocli shopping etsy`
- Aliases: none
- Auth: `none`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Discover public Etsy listings and shops without cookies, using public search discovery when direct Etsy pages are protected

## Notes

- none

## Fast Start

- `autocli shopping etsy search "wireless mouse" --limit 5`
- `autocli shopping etsy product https://www.etsy.com/listing/4383876994/wisp-16g-ultralight-wireless-gaming`
- `autocli shopping etsy shop plannerkate1`
- `autocli shopping etsy capabilities --json`

## Default Command

Usage:
```bash
autocli shopping etsy [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli shopping etsy search [options] <query>
```

Search public Etsy listings via public site-search discovery

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)

### `product`

Usage:
```bash
autocli shopping etsy product [options] <target>
```

Aliases: `listing`, `info`

Load an Etsy listing by URL, numeric listing ID, or search query

No command-specific options.

### `shop`

Usage:
```bash
autocli shopping etsy shop [options] <target>
```

Aliases: `seller`, `store`

Load an Etsy shop by shop URL or shop name via public discovery

No command-specific options.

### `capabilities`

Usage:
```bash
autocli shopping etsy capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
