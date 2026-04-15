# Output Filtering & Field Selection Examples

This documents the new `--select` and `--filter` global flags added to AutoCLI.

## Basic Usage

### Select specific fields
```bash
autocli developer github repos --json --select name,stargazers_count,language
```

Output:
```json
{
  "data": {
    "items": [
      {
        "name": "autocli",
        "stargazers_count": 1250,
        "language": "TypeScript"
      }
    ]
  }
}
```

### Filter by conditions
```bash
autocli developer github repos --json --filter 'stargazers_count > 100'
```

### Combine select and filter
```bash
autocli developer github repos --json \
  --filter 'stargazers_count > 100 AND language = "TypeScript"' \
  --select name,stargazers_count,url
```

## Filter Expression Syntax

Supported operators:
- Comparison: `>`, `<`, `>=`, `<=`, `=`, `!=`
- Text: `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`
- Logic: `AND`, `OR`
- Sets: `IN`, `BETWEEN`

### Examples

```bash
# Simple comparison
autocli social x posts --json --filter 'like_count > 1000'

# Text matching
autocli developer github repos --json --filter 'name CONTAINS "python"'

# Logical combinations  
autocli shopping flipkart search "laptop" --json \
  --filter 'price < 100000 AND rating >= 4.0'

# Temporal filters
autocli developer github repos --json --filter 'updated_at > "now-7d"'

# Nested field access
autocli social x posts --json --filter 'public_metrics.like_count > 5000'
```

## Real-world Workflows

### Daily digest of trending repos
```bash
autocli developer github repos --json \
  --filter 'updated_at > "now-24h" AND stargazers_count > 100' \
  --select name,description,stargazers_count,language,url \
  > trending-today.json
```

### Export filtered data to CSV
```bash
autocli developer github repos --json --output csv \
  --filter 'language = "Python"' \
  --select name,stars,url \
  > python-repos.csv
```

### Piping with data tools
```bash
autocli social x posts --output csv \
  | autocli data csv filter 'like_count > 1000' \
  | autocli data csv select text,author,like_count
```

## Implementation Details

### Files Added/Modified
- `src/core/output/filter-expression-parser.ts` - Filter expression parsing and evaluation
- `src/core/output/output-transform.ts` - Field selection and result transformation
- `src/types.ts` - Updated CommandContext with select/filter fields
- `src/utils/cli.ts` - Parse global flags and apply transforms
- `src/program.ts` - Added global --select and --filter options

### How It Works
1. Global `--select` and `--filter` options are parsed in `resolveCommandContext()`
2. Options are added to the CommandContext
3. When results are returned, `transformOutput()` is applied to:
   - Filter result items based on expression
   - Select only specified fields
4. Transformed results are printed as JSON

### Notes
- Filtering and selection only work with `--json` output
- For other formats, use Unix pipes with `autocli data` tools
- Field selection supports nested access: `public_metrics.like_count`
- Multiple conditions can be combined with `AND`/`OR`
