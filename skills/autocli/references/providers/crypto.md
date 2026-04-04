# Crypto

Generated from the real AutoCLI provider definition and command tree.

- Provider: `crypto`
- Category: `finance`
- Command prefix: `autocli finance crypto`
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

- `autocli finance crypto bitcoin`
- `autocli finance crypto btc --vs usd`
- `autocli finance crypto ethereum --vs inr`
- `autocli finance crypto capabilities --json`

## Default Command

Usage:
```bash
autocli finance crypto [options] [command] <asset>
```

Options:

- `--vs <currency>`: Quote currency such as usd, inr, eur (default: usd)


## Commands

### `capabilities`

Usage:
```bash
autocli finance crypto capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
