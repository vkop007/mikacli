import { createAdapterActionCapability } from "../../../../core/runtime/capability-helpers.js";
import { githubAdapter } from "../adapter.js";

export const githubStarCapability = createAdapterActionCapability({
  id: "star",
  command: "star <repo>",
  description: "Star a GitHub repository",
  spinnerText: "Starring GitHub repository...",
  successMessage: "GitHub repository starred.",
  action: ({ args }) =>
    githubAdapter.star({
      repo: String(args[0] ?? ""),
    }),
});

export const githubUnstarCapability = createAdapterActionCapability({
  id: "unstar",
  command: "unstar <repo>",
  description: "Remove the star from a GitHub repository",
  spinnerText: "Unstarring GitHub repository...",
  successMessage: "GitHub repository unstarred.",
  action: ({ args }) =>
    githubAdapter.unstar({
      repo: String(args[0] ?? ""),
    }),
});
