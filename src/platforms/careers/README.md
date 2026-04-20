# Careers Category

Job search and recruitment providers for MikaCLI.

## Providers

This category includes job search integrations with popular job boards and recruitment platforms:

- **indeed** - Search and filter jobs from Indeed job board
- **ziprecruiter** - Access ZipRecruiter job listings and search

## Usage

```bash
# Search for jobs on Indeed
mikacli careers indeed search "software engineer" --location "San Francisco" --limit 10

# Search on ZipRecruiter  
mikacli careers ziprecruiter search "data scientist" --limit 5
```

## Common Options

- `--limit` - Maximum number of results to return (default varies by provider)
- `--location` - Filter by job location
- `--salary-min` - Minimum salary range
- `--salary-max` - Maximum salary range
- `--job-type` - Filter by job type (full-time, part-time, contract, etc.)

## Output Formats

Results can be formatted using the `--format` option:

```bash
mikacli careers indeed search "developer" --format json
mikacli careers indeed search "developer" --format csv
```
