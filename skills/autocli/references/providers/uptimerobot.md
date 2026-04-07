# UptimeRobot

Generated from the real AutoCLI provider definition and command tree.

- Provider: `uptimerobot`
- Category: `devops`
- Command prefix: `autocli devops uptimerobot`
- Aliases: none
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Manage UptimeRobot monitors, incidents, integrations, and uptime stats with an API token

## Notes

- Uses UptimeRobot's official v3 API with bearer-token authentication.

## Fast Start

- `autocli devops uptimerobot login --token $UPTIMEROBOT_API_KEY`
- `autocli devops uptimerobot me`
- `autocli devops uptimerobot monitors --status DOWN`
- `autocli devops uptimerobot capabilities --json`

## Default Command

Usage:
```bash
autocli devops uptimerobot [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
autocli devops uptimerobot login [options]
```

Save a UptimeRobot API token for future CLI use

Options:

- `--token <token>`: UptimeRobot API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
autocli devops uptimerobot status [options]
```

Check the saved UptimeRobot token

Options:

- `--account <name>`: Optional saved connection name to inspect

### `me`

Usage:
```bash
autocli devops uptimerobot me [options]
```

Aliases: `account`

Show the current UptimeRobot account summary

Options:

- `--account <name>`: Optional saved connection name to use

### `monitors`

Usage:
```bash
autocli devops uptimerobot monitors [options]
```

List monitors with optional filtering

Options:

- `--account <name>`: Optional saved connection name to use
- `--limit <number>`: Maximum monitors to return
- `--group-id <id>`: Filter by monitor group ID
- `--status <statuses>`: Comma-separated statuses such as UP,DOWN,PAUSED
- `--name <text>`: Case-insensitive partial monitor name match
- `--url <text>`: Case-insensitive partial monitor URL match
- `--tags <tags>`: Comma-separated tag names to match
- `--cursor <cursor>`: Pagination cursor

### `monitor`

Usage:
```bash
autocli devops uptimerobot monitor [options] <id>
```

Get full details for a monitor by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `uptime-stats`

Usage:
```bash
autocli devops uptimerobot uptime-stats [options]
```

Get aggregated uptime stats across all monitors

Options:

- `--account <name>`: Optional saved connection name to use
- `--time-frame <frame>`: DAY, WEEK, MONTH, DAYS_30, YEAR, ALL, or CUSTOM
- `--start <unix>`: Custom range start timestamp in Unix seconds
- `--end <unix>`: Custom range end timestamp in Unix seconds
- `--log-limit <number>`: Maximum log entries to return

### `monitor-stats`

Usage:
```bash
autocli devops uptimerobot monitor-stats [options] <id>
```

Aliases: `monitor-uptime`

Get uptime stats for a specific monitor

Options:

- `--account <name>`: Optional saved connection name to use
- `--from <iso>`: Start date in ISO 8601 format
- `--to <iso>`: End date in ISO 8601 format

### `response-times`

Usage:
```bash
autocli devops uptimerobot response-times [options] <id>
```

Aliases: `response-time`

Get response time stats for a specific monitor

Options:

- `--account <name>`: Optional saved connection name to use
- `--from <iso>`: Start date in ISO 8601 format
- `--to <iso>`: End date in ISO 8601 format
- `--time-series`: Include time series points in the response

### `pause`

Usage:
```bash
autocli devops uptimerobot pause [options] <id>
```

Aliases: `stop`

Pause a monitor by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `start`

Usage:
```bash
autocli devops uptimerobot start [options] <id>
```

Aliases: `resume`

Start a paused monitor by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `create-monitor`

Usage:
```bash
autocli devops uptimerobot create-monitor [options]
```

Create a monitor from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body, for example '{"friendlyName":"API","url":"https://example.com","type":"HTTP","interval":300}'

### `update-monitor`

Usage:
```bash
autocli devops uptimerobot update-monitor [options] <id>
```

Update a monitor from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body with the fields to patch, for example '{"friendlyName":"API (5m)","interval":300}'

### `incidents`

Usage:
```bash
autocli devops uptimerobot incidents [options]
```

List incidents with optional filtering

Options:

- `--account <name>`: Optional saved connection name to use
- `--cursor <cursor>`: Pagination cursor
- `--monitor-id <id>`: Filter by monitor ID
- `--monitor-name <text>`: Filter by partial monitor name
- `--started-after <iso>`: Filter incidents that started after this ISO 8601 timestamp
- `--started-before <iso>`: Filter incidents that started before this ISO 8601 timestamp

### `incident`

Usage:
```bash
autocli devops uptimerobot incident [options] <id>
```

Get incident details by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `integrations`

Usage:
```bash
autocli devops uptimerobot integrations [options]
```

List alert integrations

Options:

- `--account <name>`: Optional saved connection name to use
- `--cursor <cursor>`: Pagination cursor

### `integration`

Usage:
```bash
autocli devops uptimerobot integration [options] <id>
```

Get integration details by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `capabilities`

Usage:
```bash
autocli devops uptimerobot capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
