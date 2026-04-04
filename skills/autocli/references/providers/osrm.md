# OSRM

Generated from the real AutoCLI provider definition and command tree.

- Provider: `osrm`
- Category: `maps`
- Command prefix: `autocli maps osrm`
- Aliases: none
- Auth: `none`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Public route lookup through the Open Source Routing Machine demo service

## Notes

- none

## Fast Start

- `autocli maps osrm route "19.0760,72.8777" "28.6139,77.2090"`
- `autocli maps osrm route "19.0760,72.8777" "19.2183,72.9781" --profile driving`
- `autocli maps osrm table "19.0760,72.8777" "28.6139,77.2090" "19.2183,72.9781"`
- `autocli maps osrm capabilities --json`

## Default Command

Usage:
```bash
autocli maps osrm [command]
```

No root-only options.


## Commands

### `route`

Usage:
```bash
autocli maps osrm route [options] <from> <to>
```

Build a route between two coordinate pairs using "lat,lon" inputs

Options:

- `--profile <profile>`: Routing profile: driving, walking, or cycling
- `--steps`: Ask OSRM to include step metadata in the route calculation

### `table`

Usage:
```bash
autocli maps osrm table [options] <coordinates...>
```

Build a travel-time and distance matrix for multiple coordinates

Options:

- `--profile <profile>`: Routing profile: driving, walking, or cycling
- `--annotations <value>`: OSRM annotations, default distance,duration
- `--sources <value>`: Source indexes or "all"
- `--destinations <value>`: Destination indexes or "all"

### `nearest`

Usage:
```bash
autocli maps osrm nearest [options] <coordinate>
```

Snap a coordinate to the nearest routable road segment

Options:

- `--profile <profile>`: Routing profile: driving, walking, or cycling
- `--number <number>`: Maximum nearest waypoints to return (default: 1)

### `trip`

Usage:
```bash
autocli maps osrm trip [options] <coordinates...>
```

Optimize a trip across multiple coordinates using the OSRM demo service

Options:

- `--profile <profile>`: Routing profile: driving, walking, or cycling
- `--source <value>`: Trip source mode like "first", "any", or "all"
- `--destination <value>`: Trip destination mode like "last", "any", or "all"
- `--roundtrip`: Ask OSRM for a roundtrip route
- `--no-roundtrip`: Disable roundtrip optimization
- `--steps`: Ask OSRM to include step metadata in the route calculation

### `match`

Usage:
```bash
autocli maps osrm match [options] <coordinates...>
```

Match a GPS trace onto roads using the OSRM demo service

Options:

- `--profile <profile>`: Routing profile: driving, walking, or cycling
- `--timestamps <list>`: Semicolon- or comma-separated timestamps list
- `--radiuses <list>`: Semicolon- or comma-separated radiuses list
- `--steps`: Ask OSRM to include step metadata in the route calculation
- `--overview <value>`: Overview mode: false, simplified, or full

### `capabilities`

Usage:
```bash
autocli maps osrm capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
