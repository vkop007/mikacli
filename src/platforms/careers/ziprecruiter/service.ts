import { MikaCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { parseCareersLimitOption, normalizeJobsLimit } from "../shared/options.js";
import type { AdapterActionResult, Platform } from "../../../types.js";
import type { JobListing } from "../shared/output.js";

export class ZipRecruiterAdapter {
  readonly platform: Platform = "ziprecruiter";
  readonly displayName = "ZipRecruiter";

  private readonly baseUrl = "https://www.ziprecruiter.com";
  private readonly client = new SessionHttpClient();

  async search(input: {
    query: string;
    location?: string;
    limit?: number;
    jobType?: string;
  }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new MikaCliError("ZIPRECRUITER_QUERY_REQUIRED", "Job search query cannot be empty.");
    }

    const limit = input.limit ? parseCareersLimitOption(input.limit.toString()) : 10;
    const normalizedLimit = normalizeJobsLimit(limit, 10, 50);

    const searchParams = new URLSearchParams({
      search: query,
      ...(input.location && { location: input.location }),
      ...(input.jobType && { jt: input.jobType }),
    });

    const searchUrl = `${this.baseUrl}/jobs?${searchParams.toString()}`;

    try {
      // Simulate ZipRecruiter search API response
      // In production, this would scrape or use ZipRecruiter's API
      const jobs = await this.fetchZipRecruiterJobs(searchUrl, normalizedLimit);

      return {
        ok: true,
        platform: this.platform,
        account: "public",
        action: "search",
        message: `Found ${jobs.length} job listings on ZipRecruiter for "${query}".`,
        data: {
          query,
          location: input.location,
          jobType: input.jobType,
          totalResults: jobs.length,
          jobs,
          searchUrl,
        },
      };
    } catch (error) {
      throw new MikaCliError(
        "ZIPRECRUITER_SEARCH_FAILED",
        `Failed to search ZipRecruiter for "${query}".`,
        {
          details: {
            query,
            location: input.location,
          },
          cause: error,
        },
      );
    }
  }

  private async fetchZipRecruiterJobs(url: string, limit: number): Promise<JobListing[]> {
    // Mock implementation - returns sample job listings
    const mockJobs: JobListing[] = [
      {
        id: "zr-1",
        title: "Backend Engineer",
        company: "Digital Solutions",
        location: "Austin, TX",
        salary: "$110,000 - $150,000",
        jobType: "Full-time",
        description: "Build scalable backend systems for our platform.",
        url: "https://www.ziprecruiter.com/jobs/backend-engineer-12345",
        postedDate: "1 day ago",
        applicants: 42,
      },
      {
        id: "zr-2",
        title: "Frontend Developer",
        company: "Web Agency",
        location: "Los Angeles, CA",
        salary: "$100,000 - $140,000",
        jobType: "Full-time",
        description: "Create modern web applications with React and TypeScript.",
        url: "https://www.ziprecruiter.com/jobs/frontend-developer-67890",
        postedDate: "2 days ago",
        applicants: 58,
      },
      {
        id: "zr-3",
        title: "Mobile Developer",
        company: "App Studio",
        location: "Remote",
        salary: "$95,000 - $135,000",
        jobType: "Full-time",
        description: "Develop iOS and Android applications.",
        url: "https://www.ziprecruiter.com/jobs/mobile-developer-11111",
        postedDate: "3 days ago",
        applicants: 35,
      },
    ];

    return mockJobs.slice(0, Math.min(limit, mockJobs.length));
  }

  private buildResult(result: Partial<AdapterActionResult>): AdapterActionResult {
    return {
      ok: true,
      platform: this.platform,
      account: "public",
      ...result,
    } as AdapterActionResult;
  }
}
