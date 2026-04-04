# OpenStreetMap

Generated from the real AutoCLI provider definition and command tree.

- Provider: `openstreetmap`
- Category: `maps`
- Command prefix: `autocli maps openstreetmap`
- Aliases: `nominatim`
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Public place search, geocoding, reverse geocoding, bounding-box lookup, and nearby search through OpenStreetMap

## Notes

- none

## Fast Start

- `autocli maps openstreetmap search "Mumbai"`
- `autocli maps openstreetmap search "Bandra West Mumbai" --limit 3`
- `autocli maps openstreetmap reverse 19.0760 72.8777`
- `autocli maps openstreetmap capabilities --json`

## Default Command

Usage:
```bash
autocli maps openstreetmap [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
autocli maps openstreetmap search [options] <query>
```

Aliases: `geocode`

Search for places or geocode a free-form query with OpenStreetMap

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `reverse`

Usage:
```bash
autocli maps openstreetmap reverse [options] <lat> <lon>
```

Reverse geocode latitude and longitude into an address-like place record

Options:

- `--zoom <number>`: Nominatim zoom level from 0 to 18 (default: 16)

### `details`

Usage:
```bash
autocli maps openstreetmap details [options] <target>
```

Aliases: `lookup`, `info`

Load OpenStreetMap details for a node, way, relation, or OpenStreetMap URL

No command-specific options.

### `bbox`

Usage:
```bash
autocli maps openstreetmap bbox [options] <bbox> [query...]
```

Aliases: `bounds`

Search for places inside a bounding box using minLon,minLat,maxLon,maxLat

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `nearby`

Usage:
```bash
autocli maps openstreetmap nearby [options] <lat> <lon> [query...]
```

Find nearby OpenStreetMap places around coordinates, with optional query text

Options:

- `--radius <meters>`: Search radius in meters (default: 1000)
- `--limit <number>`: Maximum results to return (default: 8)

### `capabilities`

Usage:
```bash
autocli maps openstreetmap capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
