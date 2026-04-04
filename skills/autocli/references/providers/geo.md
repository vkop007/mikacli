# Geo

Generated from the real AutoCLI provider definition and command tree.

- Provider: `geo`
- Category: `maps`
- Command prefix: `autocli maps geo`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Local no-key coordinate utilities like distance, midpoint, and plus code conversion

## Notes

- none

## Fast Start

- `autocli maps geo distance "19.0760,72.8777" "28.6139,77.2090"`
- `autocli maps geo midpoint "19.0760,72.8777" "28.6139,77.2090"`
- `autocli maps geo pluscode-encode 19.0760 72.8777 --length 10`
- `autocli maps geo capabilities --json`

## Default Command

Usage:
```bash
autocli maps geo [command]
```

No root-only options.


## Commands

### `distance`

Usage:
```bash
autocli maps geo distance [options] <from> <to>
```

Calculate a haversine distance between two "lat,lon" points

Options:

- `--unit <unit>`: Distance unit: km, miles, or meters

### `midpoint`

Usage:
```bash
autocli maps geo midpoint [options] <from> <to>
```

Calculate the geographic midpoint between two "lat,lon" points

No command-specific options.

### `pluscode-encode`

Usage:
```bash
autocli maps geo pluscode-encode [options] <lat> <lon>
```

Aliases: `pluscode`, `encode`

Encode latitude and longitude into a plus code

Options:

- `--length <number>`: Code length between 6 and 15

### `pluscode-decode`

Usage:
```bash
autocli maps geo pluscode-decode [options] <code>
```

Aliases: `decode`

Decode a plus code into its center coordinates and bounds

No command-specific options.

### `elevation`

Usage:
```bash
autocli maps geo elevation [options] <lat> <lon>
```

Aliases: `height`, `altitude`

Look up public elevation data for latitude and longitude

Options:

- `--dataset <name>`: Open Topo Data dataset name (default: mapzen)

### `capabilities`

Usage:
```bash
autocli maps geo capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
