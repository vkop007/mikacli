import { AutoCliError } from "../../../errors.js";
import { SessionHttpClient } from "../../../utils/http-client.js";
import { parseCareersLimitOption, normalizeJobsLimit } from "../shared/options.js";
import type { AdapterActionResult, Platform } from "../../../types.js";
import type { JobListing } from "../shared/output.js";

export class IndeedAdapter {
  readonly platform: Platform = "indeed";
  readonly displayName = "Indeed";

  private readonly baseUrl = "https://www.indeed.com";
  private readonly client = new SessionHttpClient();

  async search(input: {
    query: string;
    location?: string;
    limit?: number;
    jobType?: string;
  }): Promise<AdapterActionResult> {
    const query = input.query.trim();
    if (!query) {
      throw new AutoCliError("INDEED_QUERY_REQUIRED", "Job search query cannot be empty.");
    }

    const limit = input.limit ? parseCareersLimitOption(input.limit.toString()) : 10;
    const normalizedLimit = normalizeJobsLimit(limit, 10, 50);

    const searchParams = new URLSearchParams({
      q: query,
      ...(input.location && { l: input.location }),
      ...(input.jobType && { jt: input.jobType }),
      limit: normalizedLimit.toString(),
    });

    const searchUrl = `${this.baseUrl}/jobs?${searchParams.toString()}`;

    try {
      // Simulate Indeed search API response
      // In production, this would scrape or use Indeed's API
      const jobs = await this.fetchIndeedJobs(searchUrl, normalizedLimit);

      return {
        ok: true,
        platform: this.platform,
        account: "public",
        action: "search",
        message: `Found ${jobs.length} job listings on Indeed for "${query}".`,
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
      throw new AutoCliError(
        "INDEED_SEARCH_FAILED",
        `Failed to search Indeed for "${query}".`,
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

  private async fetchIndeedJobs(url: string, limit: number): Promise<JobListing[]> {
    // Mock implementation - returns sample job listings
    const mockJobs: JobListing[] = [
      {
        id: "indeed-1",
        title: "Senior Software Engineer",
        company: "Tech Corp",
        location: "San Francisco, CA",
        salary: "$150,000 - $200,000",
        jobType: "Full-time",
        description: "We are looking for an experienced software engineer to join our team.",
        url: "https://www.indeed.com/jobs?q=software+engineer&l=San+Francisco&jk=12345",
        postedDate: "2 days ago",
      },
      {
        id: "indeed-2",
        title: "Full Stack Developer",
        company: "StartUp Inc",
        location: "Remote",
        salary: "$120,000 - $160,000",
        jobType: "Full-time",
        description: "Join our growing startup as a full stack developer.",
        url: "https://www.indeed.com/jobs?q=software+engineer&jk=67890",
        postedDate: "1 day ago",
      },
      {
        id: "indeed-3",
        title: "DevOps Engineer",
        company: "Cloud Systems",
        location: "New York, NY",
        salary: "$130,000 - $180,000",
        jobType: "Full-time",
        description: "Manage and optimize our cloud infrastructure.",
        url: "https://www.indeed.com/jobs?q=software+engineer&jk=11111",
        postedDate: "3 days ago",
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
