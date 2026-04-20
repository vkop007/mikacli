# OpenStreetMap

Generated from the real MikaCLI provider definition and command tree.

- Provider: `openstreetmap`
- Category: `maps`
- Command prefix: `mikacli maps openstreetmap`
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

- `mikacli maps openstreetmap search "Mumbai"`
- `mikacli maps openstreetmap search "Bandra West Mumbai" --limit 3`
- `mikacli maps openstreetmap reverse 19.0760 72.8777`
- `mikacli maps openstreetmap capabilities --json`

## Default Command

Usage:
```bash
mikacli maps openstreetmap [command]
```

No root-only options.


## Commands

### `search`

Usage:
```bash
mikacli maps openstreetmap search [options] <query>
```

Aliases: `geocode`

Search for places or geocode a free-form query with OpenStreetMap

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `reverse`

Usage:
```bash
mikacli maps openstreetmap reverse [options] <lat> <lon>
```

Reverse geocode latitude and longitude into an address-like place record

Options:

- `--zoom <number>`: Nominatim zoom level from 0 to 18 (default: 16)

### `details`

Usage:
```bash
mikacli maps openstreetmap details [options] <target>
```

Aliases: `lookup`, `info`

Load OpenStreetMap details for a node, way, relation, or OpenStreetMap URL

No command-specific options.

### `bbox`

Usage:
```bash
mikacli maps openstreetmap bbox [options] <bbox> [query...]
```

Aliases: `bounds`

Search for places inside a bounding box using minLon,minLat,maxLon,maxLat

Options:

- `--limit <number>`: Maximum results to return (default: 5)

### `nearby`

Usage:
```bash
mikacli maps openstreetmap nearby [options] <lat> <lon> [query...]
```

Find nearby OpenStreetMap places around coordinates, with optional query text

Options:

- `--radius <meters>`: Search radius in meters (default: 1000)
- `--limit <number>`: Maximum results to return (default: 8)

### `capabilities`

Usage:
```bash
mikacli maps openstreetmap capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
