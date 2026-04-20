import { evaluateFilter } from "./filter-expression-parser.js";
import { MikaCliError } from "../../errors.js";

export interface OutputTransformOptions {
  select?: string[];
  filter?: string;
}

/**
 * Apply output transformations (field selection and filtering) to results
 */
export function transformOutput(
  data: unknown,
  options: OutputTransformOptions,
): unknown {
  if (!options.select && !options.filter) {
    return data;
  }

  // Handle list results (data.items array)
  if (
    typeof data === "object" &&
    data !== null &&
    "items" in data &&
    Array.isArray((data as Record<string, unknown>).items)
  ) {
    const items = (data as Record<string, unknown>).items as Record<string, unknown>[];
    let filtered = items;

    // Apply filter
    if (options.filter) {
      filtered = filtered.filter((item) => {
        try {
          return evaluateFilter(options.filter!, item);
        } catch (error) {
          throw new MikaCliError("FILTER_EVALUATION_ERROR", `Failed to evaluate filter for item`, {
            details: {
              filter: options.filter,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      });
    }

    // Apply select
    if (options.select && options.select.length > 0) {
      filtered = filtered.map((item) => selectFields(item, options.select!));
    }

    // Return structure with transformed items
    return {
      ...data,
      items: filtered,
    };
  }

  // Handle single entity results (data.entity)
  if (
    typeof data === "object" &&
    data !== null &&
    "entity" in data &&
    typeof (data as Record<string, unknown>).entity === "object"
  ) {
    const entity = (data as Record<string, unknown>).entity as Record<string, unknown>;

    // Apply filter to single entity
    if (options.filter) {
      try {
        const passes = evaluateFilter(options.filter, entity);
        if (!passes) {
          return {
            ...data,
            entity: null,
          };
        }
      } catch (error) {
        throw new MikaCliError("FILTER_EVALUATION_ERROR", `Failed to evaluate filter for entity`, {
          details: {
            filter: options.filter,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    // Apply select to single entity
    if (options.select && options.select.length > 0) {
      return {
        ...data,
        entity: selectFields(entity, options.select),
      };
    }

    return data;
  }

  // Fallback: if data is an object, try to apply select/filter directly
  if (typeof data === "object" && data !== null) {
    if (options.filter) {
      try {
        const passes = evaluateFilter(options.filter, data as Record<string, unknown>);
        if (!passes) {
          return null;
        }
      } catch (error) {
        throw new MikaCliError("FILTER_EVALUATION_ERROR", `Failed to evaluate filter`, {
          details: {
            filter: options.filter,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    if (options.select && options.select.length > 0) {
      return selectFields(data as Record<string, unknown>, options.select);
    }

    return data;
  }

  return data;
}

/**
 * Select specific fields from an object, supporting nested access (e.g., "author.name")
 */
function selectFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const value = getNestedValue(obj, field);
    if (value !== undefined) {
      setNestedValue(result, field, value);
    }
  }

  return result;
}

/**
 * Get value from nested path (e.g., "author.profile.name")
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set value at nested path, creating intermediate objects as needed
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) continue;
    
    if (!(part in current) || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    current[lastPart] = value;
  }
}

/**
 * Validate that all selected fields exist in at least one sample item
 */
export function validateSelectFields(
  data: unknown,
  selectFields: string[],
): { valid: boolean; missingFields?: string[] } {
  if (!selectFields || selectFields.length === 0) {
    return { valid: true };
  }

  // Extract sample object
  let sampleObj: Record<string, unknown> | undefined;

  if (
    typeof data === "object" &&
    data !== null &&
    "items" in data &&
    Array.isArray((data as Record<string, unknown>).items) &&
    ((data as Record<string, unknown>).items as unknown[]).length > 0
  ) {
    sampleObj = ((data as Record<string, unknown>).items as Record<string, unknown>[])[0];
  } else if (
    typeof data === "object" &&
    data !== null &&
    "entity" in data &&
    typeof (data as Record<string, unknown>).entity === "object"
  ) {
    sampleObj = (data as Record<string, unknown>).entity as Record<string, unknown>;
  }

  if (!sampleObj) {
    return { valid: true }; // Can't validate, assume fine
  }

  const missing: string[] = [];
  for (const field of selectFields) {
    if (getNestedValue(sampleObj, field) === undefined) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    const availableFields = Object.keys(sampleObj).sort();
    return {
      valid: false,
      missingFields: missing,
    };
  }

  return { valid: true };
}
