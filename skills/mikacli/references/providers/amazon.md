# Amazon

Generated from the real MikaCLI provider definition and command tree.

- Provider: `amazon`
- Category: `shopping`
- Command prefix: `mikacli shopping amazon`
- Aliases: none
- Auth: `cookies`
- Stability: `partial`
- Discovery: `supported`
- Mutation: `partial`
- Browser login: `supported`
- Browser fallback: `supported`
- Async jobs: `unsupported`

## Description

Search Amazon, inspect product details, and validate imported shopping sessions across the correct marketplace domain

## Notes

- `add-to-cart`, `remove-from-cart`, `update-cart`, `orders`, `order`, and `cart` support browser-backed execution when the saved session alone is not enough.

## Fast Start

- `mikacli shopping amazon login`
- `mikacli shopping amazon login --cookies ./amazon.cookies.json`
- `mikacli shopping amazon search "wireless mouse" --limit 5`
- `mikacli shopping amazon capabilities --json`

## Default Command

Usage:
```bash
mikacli shopping amazon [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli shopping amazon login [options]
```

Save the Amazon session for future CLI use. With no auth flags, MikaCLI opens browser login by default

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
mikacli shopping amazon status [options]
```

Show the saved Amazon session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `search`

Usage:
```bash
mikacli shopping amazon search [options] <query>
```

Search Amazon products

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)

### `product`

Usage:
```bash
mikacli shopping amazon product [options] <target>
```

Aliases: `item`, `info`

Load exact Amazon product details by URL or ASIN

No command-specific options.

### `orders`

Usage:
```bash
mikacli shopping amazon orders [options]
```

List recent Amazon orders using the latest saved session by default

Options:

- `--account <name>`: Optional saved session name to use
- `--limit <number>`: Maximum number of orders to return (1-25, default: 5)
- `--browser`: Run this action in an invisible browser session instead of browserless requests
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `account`

Usage:
```bash
mikacli shopping amazon account [options]
```

Aliases: `me`, `profile`

Load the saved Amazon account overview

Options:

- `--account <name>`: Optional saved session name to use

### `wishlist`

Usage:
```bash
mikacli shopping amazon wishlist [options]
```

Aliases: `saved`

Load the saved Amazon wishlist

Options:

- `--account <name>`: Optional saved session name to use
- `--limit <number>`: Maximum number of wishlist items to return (1-25, default: 5)

### `cart`

Usage:
```bash
mikacli shopping amazon cart [options]
```

Load the saved Amazon cart

Options:

- `--account <name>`: Optional saved session name to use
- `--browser`: Run this action in an invisible browser session instead of browserless requests
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `add-to-cart`

Usage:
```bash
mikacli shopping amazon add-to-cart [options] <target>
```

Aliases: `add`, `cart-add`

Add an exact Amazon product to the saved cart

Options:

- `--account <name>`: Optional saved session name to use
- `--qty <number>`: Quantity to add (1-10, default: 1)
- `--browser-timeout <seconds>`: Maximum seconds to allow the action to complete when the adapter uses browser-backed flows

### `remove-from-cart`

Usage:
```bash
mikacli shopping amazon remove-from-cart [options] <target>
```

Aliases: `remove`, `cart-remove`

Remove an exact Amazon product from the saved cart

Options:

- `--account <name>`: Optional saved session name to use
- `--browser-timeout <seconds>`: Maximum seconds to allow the action to complete when the adapter uses browser-backed flows

### `update-cart`

Usage:
```bash
mikacli shopping amazon update-cart [options] <target>
```

Aliases: `cart-update`, `set-qty`

Update the saved Amazon cart quantity for an exact product

Options:

- `--account <name>`: Optional saved session name to use
- `--qty <number>`: Target quantity to keep in cart (1-10)
- `--browser-timeout <seconds>`: Maximum seconds to allow the action to complete when the adapter uses browser-backed flows

### `order`

Usage:
```bash
mikacli shopping amazon order [options] <target>
```

Aliases: `order-detail`

Load exact Amazon order details by order ID

Options:

- `--account <name>`: Optional saved session name to use
- `--browser`: Run this action in an invisible browser session instead of browserless requests
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `capabilities`

Usage:
```bash
mikacli shopping amazon capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
