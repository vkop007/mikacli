# ZipRecruiter

Generated from the real AutoCLI provider definition and command tree.

- Provider: `ziprecruiter`
- Category: `careers`
- Command prefix: `autocli careers ziprecruiter`
- Aliases: `none`
- Auth: `none`
- Stability: `experimental`
- Discovery: `supported`
- Mutation: `unsupported`
- Browser login: `unsupported`
- Browser fallback: `unsupported`
- Async jobs: `unsupported`

## Description

Search and browse job listings from ZipRecruiter, America's largest job marketplace

## Notes

- Supports job search across all industries and locations
- Returns mock job data for demonstration purposes
- In production, would integrate with ZipRecruiter's job API
- Includes applicant counts for job postings

## Fast Start

- `autocli careers ziprecruiter search "software engineer"`
- `autocli careers ziprecruiter search "product manager" --location "Austin"`
- `autocli careers ziprecruiter search "marketing manager" --limit 15 --json`
- `autocli careers ziprecruiter capabilities --json`

## Default Command

Usage:
```bash
autocli careers ziprecruiter [command]
```

No root-only options.

## Commands

### `search`

Usage:
```bash
autocli careers ziprecruiter search [options] <query>
```

Search for jobs on ZipRecruiter

Options:

- `--location <location>`: Filter jobs by location (e.g., 'Austin', 'San Francisco')
- `--limit <number>`: Maximum number of results to return (1-50, default: 10)
- `--job-type <type>`: Filter by job type (full-time, part-time, contract, temporary)

Examples:

```bash
autocli careers ziprecruiter search "software engineer"
autocli careers ziprecruiter search "product manager" --location "Austin"
autocli careers ziprecruiter search "marketing manager" --limit 15
autocli careers ziprecruiter search "data analyst" --job-type "contract"
autocli careers ziprecruiter search "devops engineer" --location "Seattle" --limit 10 --json
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
- `applicants`: Number of applicants

Example result:
```json
{
  "ok": true,
  "platform": "ziprecruiter",
  "action": "search",
  "message": "Found 3 job listings on ZipRecruiter for \"developer\".",
  "data": {
    "query": "developer",
    "location": "Austin",
    "totalResults": 3,
    "jobs": [
      {
        "id": "zr-1",
        "title": "Backend Engineer",
        "company": "Digital Solutions",
        "location": "Austin, TX",
        "salary": "$110,000 - $150,000",
        "jobType": "Full-time",
        "description": "Build scalable backend systems.",
        "url": "https://www.ziprecruiter.com/jobs/...",
        "postedDate": "1 day ago",
        "applicants": 42
      }
    ]
  }
}
```
