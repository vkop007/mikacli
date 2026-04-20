# Flipkart

Generated from the real MikaCLI provider definition and command tree.

- Provider: `flipkart`
- Category: `shopping`
- Command prefix: `mikacli shopping flipkart`
- Aliases: none
- Auth: `cookies`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `supported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search Flipkart, inspect products, and control account data like orders, wishlist, and cart using cookies

## Notes

- Uses the saved Flipkart session for cart actions. New adds use the authenticated cart endpoint; quantity updates and removals use the saved session in an invisible browser.

## Fast Start

- `mikacli shopping flipkart login`
- `mikacli shopping flipkart login --cookies ./flipkart.cookies.json`
- `mikacli shopping flipkart search "wireless mouse" --limit 5`
- `mikacli shopping flipkart capabilities --json`

## Default Command

Usage:
```bash
mikacli shopping flipkart [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli shopping flipkart login [options]
```

Save the Flipkart session for future CLI use. With no auth flags, MikaCLI opens browser login by default

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
mikacli shopping flipkart status [options]
```

Show the saved Flipkart session status

Options:

- `--account <name>`: Optional saved session name to inspect

### `search`

Usage:
```bash
mikacli shopping flipkart search [options] <query>
```

Search Flipkart products

Options:

- `--limit <number>`: Maximum number of results to return (1-25, default: 5)

### `product`

Usage:
```bash
mikacli shopping flipkart product [options] <target>
```

Aliases: `item`, `info`

Load exact Flipkart product details by URL or PID

No command-specific options.

### `orders`

Usage:
```bash
mikacli shopping flipkart orders [options]
```

List recent Flipkart orders using the latest saved session by default

Options:

- `--account <name>`: Optional saved session name to use
- `--limit <number>`: Maximum number of orders to return (1-25, default: 5)
- `--browser`: Run this action in an invisible browser session instead of browserless requests
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `account`

Usage:
```bash
mikacli shopping flipkart account [options]
```

Aliases: `me`, `profile`

Load the saved Flipkart account overview

Options:

- `--account <name>`: Optional saved session name to use

### `wishlist`

Usage:
```bash
mikacli shopping flipkart wishlist [options]
```

Aliases: `saved`

Load the saved Flipkart wishlist

Options:

- `--account <name>`: Optional saved session name to use
- `--limit <number>`: Maximum number of wishlist items to return (1-25, default: 5)

### `cart`

Usage:
```bash
mikacli shopping flipkart cart [options]
```

Load the saved Flipkart cart

Options:

- `--account <name>`: Optional saved session name to use
- `--browser`: Run this action in an invisible browser session instead of browserless requests
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `add-to-cart`

Usage:
```bash
mikacli shopping flipkart add-to-cart [options] <target>
```

Aliases: `add`, `cart-add`

Add an exact Flipkart product to the saved cart

Options:

- `--account <name>`: Optional saved session name to use
- `--qty <number>`: Quantity to add (1-10, default: 1)
- `--browser-timeout <seconds>`: Maximum seconds to allow the action to complete when the adapter uses browser-backed flows

### `remove-from-cart`

Usage:
```bash
mikacli shopping flipkart remove-from-cart [options] <target>
```

Aliases: `remove`, `cart-remove`

Remove an exact Flipkart product from the saved cart

Options:

- `--account <name>`: Optional saved session name to use
- `--browser-timeout <seconds>`: Maximum seconds to allow the action to complete when the adapter uses browser-backed flows

### `update-cart`

Usage:
```bash
mikacli shopping flipkart update-cart [options] <target>
```

Aliases: `cart-update`, `set-qty`

Update the saved Flipkart cart quantity for an exact product

Options:

- `--account <name>`: Optional saved session name to use
- `--qty <number>`: Target quantity to keep in cart (1-10)
- `--browser-timeout <seconds>`: Maximum seconds to allow the action to complete when the adapter uses browser-backed flows

### `order`

Usage:
```bash
mikacli shopping flipkart order [options] <target>
```

Aliases: `order-detail`

Load exact Flipkart order details by order ID

Options:

- `--account <name>`: Optional saved session name to use
- `--browser`: Run this action in an invisible browser session instead of browserless requests
- `--browser-timeout <seconds>`: Maximum seconds to allow the browser action to complete

### `capabilities`

Usage:
```bash
mikacli shopping flipkart capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
