# Crypto

Generated from the real MikaCLI provider definition and command tree.

- Provider: `crypto`
- Category: `finance`
- Command prefix: `mikacli finance crypto`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Load crypto prices from CoinGecko without any account setup

## Notes

- none

## Fast Start

- `mikacli finance crypto bitcoin`
- `mikacli finance crypto btc --vs usd`
- `mikacli finance crypto ethereum --vs inr`
- `mikacli finance crypto capabilities --json`

## Default Command

Usage:
```bash
mikacli finance crypto [options] [command] <asset>
```

Options:

- `--vs <currency>`: Quote currency such as usd, inr, eur (default: usd)


## Commands

### `capabilities`

Usage:
```bash
mikacli finance crypto capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
