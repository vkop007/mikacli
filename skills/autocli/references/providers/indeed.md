# Indeed

Generated from the real AutoCLI provider definition and command tree.

- Provider: `indeed`
- Category: `careers`
- Command prefix: `autocli careers indeed`
- Aliases: `none`
- Auth: `none`
- Stability: `experimental`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search job listings on Indeed, the world's largest job board

## Notes

- Supports job search across all industries and locations
- Returns mock job data for demonstration purposes
- In production, would integrate with Indeed's job API

## Fast Start

- `autocli careers indeed search "software engineer"`
- `autocli careers indeed search "python developer" --location "New York"`
- `autocli careers indeed search "ui designer" --limit 10 --json`
- `autocli careers indeed capabilities --json`

## Default Command

Usage:
```bash
autocli careers indeed [command]
```

No root-only options.

## Commands

### `search`

Usage:
```bash
autocli careers indeed search [options] <query>
```

Search for jobs on Indeed

Options:

- `--location <location>`: Filter jobs by location (e.g., 'San Francisco', 'New York')
- `--limit <number>`: Maximum number of results to return (1-50, default: 10)
- `--job-type <type>`: Filter by job type (full-time, part-time, contract, temporary)

Examples:

```bash
autocli careers indeed search "software engineer"
autocli careers indeed search "data scientist" --location "New York"
autocli careers indeed search "frontend developer" --limit 10
autocli careers indeed search "python developer" --job-type "full-time"
autocli careers indeed search "ui designer" --location "San Francisco" --limit 20 --json
```

## Result

Returns an array of job listings with:

- `id`: Unique job identifier
- `title`: Job title
- `company`: Company name
- `location`: Job location
- `salary`: Salary range if available
- `jobType`: Type of position (full-time, part-time, etc.)
- `description`: Job description
- `url`: Link to the job listing
- `postedDate`: When the job was posted
- `applicants`: Number of applicants (if available)

Example result:
```json
{
  "ok": true,
  "platform": "indeed",
  "action": "search",
  "message": "Found 3 job listings on Indeed for \"developer\".",
  "data": {
    "query": "developer",
    "location": "New York",
    "totalResults": 3,
    "jobs": [
      {
        "id": "indeed-1",
        "title": "Senior Software Engineer",
        "company": "Tech Corp",
        "location": "San Francisco, CA",
        "salary": "$150,000 - $200,000",
        "jobType": "Full-time",
        "description": "We are looking for an experienced software engineer.",
        "url": "https://www.indeed.com/jobs?...",
        "postedDate": "2 days ago"
      }
    ]
  }
}
```
