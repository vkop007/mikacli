# UptimeRobot

Generated from the real MikaCLI provider definition and command tree.

- Provider: `uptimerobot`
- Category: `devops`
- Command prefix: `mikacli devops uptimerobot`
- Aliases: none
- Auth: `apiKey`
- Stability: `stable`
- Discovery: `supported`
- Mutation: `supported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Manage UptimeRobot monitors, incidents, status pages, integrations, and related account resources with an API token

## Notes

- Uses UptimeRobot's official v3 API with bearer-token authentication.

## Fast Start

- `mikacli devops uptimerobot login --token $UPTIMEROBOT_API_KEY`
- `mikacli devops uptimerobot me`
- `mikacli devops uptimerobot monitors --status DOWN`
- `mikacli devops uptimerobot capabilities --json`

## Default Command

Usage:
```bash
mikacli devops uptimerobot [command]
```

No root-only options.


## Commands

### `login`

Usage:
```bash
mikacli devops uptimerobot login [options]
```

Save a UptimeRobot API token for future CLI use

Options:

- `--token <token>`: UptimeRobot API token
- `--account <name>`: Optional saved connection name

### `status`

Usage:
```bash
mikacli devops uptimerobot status [options]
```

Check the saved UptimeRobot token

Options:

- `--account <name>`: Optional saved connection name to use

### `me`

Usage:
```bash
mikacli devops uptimerobot me [options]
```

Aliases: `account`

Show the current UptimeRobot account summary

Options:

- `--account <name>`: Optional saved connection name to use

### `alert-contacts`

Usage:
```bash
mikacli devops uptimerobot alert-contacts [options]
```

List alert contacts configured for the account

Options:

- `--account <name>`: Optional saved connection name to use

### `all-alert-contacts`

Usage:
```bash
mikacli devops uptimerobot all-alert-contacts [options]
```

List alert contacts across the full UptimeRobot account

Options:

- `--account <name>`: Optional saved connection name to use

### `monitors`

Usage:
```bash
mikacli devops uptimerobot monitors [options]
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
mikacli devops uptimerobot monitor [options] <id>
```

Get full details for a monitor by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `create-monitor`

Usage:
```bash
mikacli devops uptimerobot create-monitor [options]
```

Create a monitor from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body, for example '{"friendlyName":"API","url":"https://example.com","type":"HTTP","interval":300,"timeout":30}'

### `update-monitor`

Usage:
```bash
mikacli devops uptimerobot update-monitor [options] <id>
```

Update a monitor from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body with the fields to patch, for example '{"friendlyName":"API (5m)","interval":300}'

### `delete-monitor`

Usage:
```bash
mikacli devops uptimerobot delete-monitor [options] <id>
```

Delete a monitor by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `reset-monitor`

Usage:
```bash
mikacli devops uptimerobot reset-monitor [options] <id>
```

Reset a monitor's stored stats

Options:

- `--account <name>`: Optional saved connection name to use

### `pause`

Usage:
```bash
mikacli devops uptimerobot pause [options] <id>
```

Aliases: `stop`

Pause a monitor by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `start`

Usage:
```bash
mikacli devops uptimerobot start [options] <id>
```

Aliases: `resume`

Start a paused monitor by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `uptime-stats`

Usage:
```bash
mikacli devops uptimerobot uptime-stats [options]
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
mikacli devops uptimerobot monitor-stats [options] <id>
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
mikacli devops uptimerobot response-times [options] <id>
```

Aliases: `response-time`

Get response time stats for a specific monitor

Options:

- `--account <name>`: Optional saved connection name to use
- `--from <iso>`: Start date in ISO 8601 format
- `--to <iso>`: End date in ISO 8601 format
- `--time-series`: Include time series points in the response

### `incidents`

Usage:
```bash
mikacli devops uptimerobot incidents [options]
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
mikacli devops uptimerobot incident [options] <id>
```

Get incident details by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `incident-comments`

Usage:
```bash
mikacli devops uptimerobot incident-comments [options] <incident-id>
```

List comments for an incident

Options:

- `--account <name>`: Optional saved connection name to use
- `--cursor <cursor>`: Pagination cursor
- `--limit <number>`: Maximum comments to return

### `create-incident-comment`

Usage:
```bash
mikacli devops uptimerobot create-incident-comment [options] <incident-id>
```

Create an incident comment from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body, for example '{"comment":"Investigating the outage."}'

### `update-incident-comment`

Usage:
```bash
mikacli devops uptimerobot update-incident-comment [options] <incident-id> <comment-id>
```

Update an incident comment from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body with the fields to patch, for example '{"comment":"Resolved and monitoring."}'

### `delete-incident-comment`

Usage:
```bash
mikacli devops uptimerobot delete-incident-comment [options] <incident-id> <comment-id>
```

Delete an incident comment by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `incident-activity-log`

Usage:
```bash
mikacli devops uptimerobot incident-activity-log [options] <id>
```

Get the activity log for an incident

Options:

- `--account <name>`: Optional saved connection name to use

### `incident-alerts`

Usage:
```bash
mikacli devops uptimerobot incident-alerts [options] <id>
```

List alerts sent for an incident

Options:

- `--account <name>`: Optional saved connection name to use

### `integrations`

Usage:
```bash
mikacli devops uptimerobot integrations [options]
```

List alert integrations

Options:

- `--account <name>`: Optional saved connection name to use
- `--cursor <cursor>`: Pagination cursor

### `integration`

Usage:
```bash
mikacli devops uptimerobot integration [options] <id>
```

Get integration details by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `create-integration`

Usage:
```bash
mikacli devops uptimerobot create-integration [options]
```

Create an integration from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body for the integration, for example '{"friendlyName":"Slack","type":"SLACK","value":"https://hooks.slack.com/..."}'

### `update-integration`

Usage:
```bash
mikacli devops uptimerobot update-integration [options] <id>
```

Update an integration from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body with the fields to patch, for example '{"friendlyName":"Slack Alerts"}'

### `delete-integration`

Usage:
```bash
mikacli devops uptimerobot delete-integration [options] <id>
```

Delete an integration by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `monitor-groups`

Usage:
```bash
mikacli devops uptimerobot monitor-groups [options]
```

List monitor groups

Options:

- `--account <name>`: Optional saved connection name to use
- `--cursor <cursor>`: Pagination cursor

### `monitor-group`

Usage:
```bash
mikacli devops uptimerobot monitor-group [options] <id>
```

Get monitor group details by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `create-monitor-group`

Usage:
```bash
mikacli devops uptimerobot create-monitor-group [options]
```

Create a monitor group from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body, for example '{"name":"Core Services","monitors":[801150533]}'

### `update-monitor-group`

Usage:
```bash
mikacli devops uptimerobot update-monitor-group [options] <id>
```

Update a monitor group from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body with the fields to patch, for example '{"name":"Critical Services"}'

### `delete-monitor-group`

Usage:
```bash
mikacli devops uptimerobot delete-monitor-group [options] <id>
```

Delete a monitor group by ID

Options:

- `--account <name>`: Optional saved connection name to use
- `--monitors-new-group-id <id>`: Optional fallback group for monitors being removed with the deleted group

### `maintenance-windows`

Usage:
```bash
mikacli devops uptimerobot maintenance-windows [options]
```

List maintenance windows

Options:

- `--account <name>`: Optional saved connection name to use
- `--cursor <cursor>`: Pagination cursor

### `maintenance-window`

Usage:
```bash
mikacli devops uptimerobot maintenance-window [options] <id>
```

Get maintenance window details by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `create-maintenance-window`

Usage:
```bash
mikacli devops uptimerobot create-maintenance-window [options]
```

Create a maintenance window from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body, for example '{"name":"DB upgrade","startsAt":"2026-04-07T18:00:00Z","endsAt":"2026-04-07T19:00:00Z"}'

### `update-maintenance-window`

Usage:
```bash
mikacli devops uptimerobot update-maintenance-window [options] <id>
```

Update a maintenance window from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body with the fields to patch, for example '{"name":"DB upgrade (rescheduled)"}'

### `delete-maintenance-window`

Usage:
```bash
mikacli devops uptimerobot delete-maintenance-window [options] <id>
```

Delete a maintenance window by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `psps`

Usage:
```bash
mikacli devops uptimerobot psps [options]
```

List public status pages

Options:

- `--account <name>`: Optional saved connection name to use
- `--cursor <cursor>`: Pagination cursor

### `psp`

Usage:
```bash
mikacli devops uptimerobot psp [options] <id>
```

Get public status page details by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `create-psp`

Usage:
```bash
mikacli devops uptimerobot create-psp [options]
```

Create a public status page from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body. File uploads can use descriptors like '{"logo":{"filePath":"./logo.png","contentType":"image/png"}}'

### `update-psp`

Usage:
```bash
mikacli devops uptimerobot update-psp [options] <id>
```

Update a public status page from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body with the fields to patch. File uploads can use descriptors like '{"logo":{"filePath":"./logo.png"}}'

### `delete-psp`

Usage:
```bash
mikacli devops uptimerobot delete-psp [options] <id>
```

Delete a public status page by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `announcements`

Usage:
```bash
mikacli devops uptimerobot announcements [options] <psp-id>
```

List announcements for a public status page

Options:

- `--account <name>`: Optional saved connection name to use
- `--status <status>`: Optional announcement status filter
- `--cursor <cursor>`: Pagination cursor

### `announcement`

Usage:
```bash
mikacli devops uptimerobot announcement [options] <psp-id> <id>
```

Get announcement details by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `create-announcement`

Usage:
```bash
mikacli devops uptimerobot create-announcement [options] <psp-id>
```

Create an announcement from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body, for example '{"title":"Maintenance","message":"Work starts at 18:00 UTC."}'

### `update-announcement`

Usage:
```bash
mikacli devops uptimerobot update-announcement [options] <psp-id> <id>
```

Update an announcement from a JSON request body

Options:

- `--account <name>`: Optional saved connection name to use
- `--body <json>`: JSON body with the fields to patch, for example '{"title":"Maintenance update"}'

### `pin-announcement`

Usage:
```bash
mikacli devops uptimerobot pin-announcement [options] <psp-id> <id>
```

Pin an announcement on a public status page

Options:

- `--account <name>`: Optional saved connection name to use

### `unpin-announcement`

Usage:
```bash
mikacli devops uptimerobot unpin-announcement [options] <psp-id> <id>
```

Unpin an announcement on a public status page

Options:

- `--account <name>`: Optional saved connection name to use

### `tags`

Usage:
```bash
mikacli devops uptimerobot tags [options]
```

List account tags

Options:

- `--account <name>`: Optional saved connection name to use
- `--cursor <cursor>`: Pagination cursor

### `delete-tag`

Usage:
```bash
mikacli devops uptimerobot delete-tag [options] <id>
```

Delete a tag by ID

Options:

- `--account <name>`: Optional saved connection name to use

### `capabilities`

Usage:
```bash
mikacli devops uptimerobot capabilities [options]
```

Aliases: `caps`

Show machine-readable capability metadata for this provider

No command-specific options.
