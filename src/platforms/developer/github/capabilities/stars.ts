import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter, type GitHubAdapter } from "../adapter.js";

export function createGitHubStarCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "star",
    command: "star <repo>",
    description: `Star a ${adapter.displayName} repository`,
    spinnerText: `Starring ${adapter.displayName} repository...`,
    successMessage: `${adapter.displayName} repository starred.`,
    action: ({ args }) =>
      adapter.star({
        repo: String(args[0] ?? ""),
      }),
  });
}

export function createGitHubUnstarCapability(adapter: GitHubAdapter) {
  return createAdapterActionCapability({
    id: "unstar",
    command: "unstar <repo>",
    description: `Remove the star from a ${adapter.displayName} repository`,
    spinnerText: `Unstarring ${adapter.displayName} repository...`,
    successMessage: `${adapter.displayName} repository unstarred.`,
    action: ({ args }) =>
      adapter.unstar({
        repo: String(args[0] ?? ""),
      }),
  });
}

export const githubStarCapability = createGitHubStarCapability(githubAdapter);
export const githubUnstarCapability = createGitHubUnstarCapability(githubAdapter);
