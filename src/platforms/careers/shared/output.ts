import { printActionResult } from "../../../utils/cli.js";
import { printJson } from "../../../utils/output.js";

import type { AdapterActionResult } from "../../../types.js";

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  jobType?: string;
  description?: string;
  url: string;
  postedDate?: string;
  applicants?: number;
}

export interface JobSearchResult {
  totalResults: number;
  jobs: JobListing[];
}

export function printCareersSearchResult(result: AdapterActionResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }

  printActionResult(result, false);
  const jobs = Array.isArray(result.data?.jobs) ? result.data.jobs : [];
  const query = result.data?.query ?? "jobs";

  if (jobs.length === 0) {
    console.log(`No job listings found for "${query}".`);
    return;
  }

  console.log(`\nResults for: "${query}"\n`);

  for (const [index, rawJob] of jobs.entries()) {
    if (!rawJob || typeof rawJob !== "object") {
      continue;
    }

    const job = rawJob as Record<string, unknown>;
    const title = asString(job.title) ?? "Unknown position";
    const company = asString(job.company) ?? "Unknown company";
    const location = asString(job.location) ?? "Location not specified";
    const url = asString(job.url);
    const meta = [
      asString(job.salary),
      asString(job.jobType),
      asString(job.postedDate),
      typeof job.applicants === "number" ? `${job.applicants} applicants` : undefined,
    ].filter((value): value is string => typeof value === "string" && value.length > 0);
    const description = asString(job.description);

    console.log(`${index + 1}. ${title}`);
    console.log(`   ${company} • ${location}`);
    if (meta.length > 0) {
      console.log(`   ${meta.join(" • ")}`);
    }
    if (url) {
      console.log(`   ${url}`);
    }
    if (description) {
      console.log(`   ${description}`);
    }
    console.log();
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
}
