import { uptimeRobotAdapter } from "./adapter.js";
import { uptimeRobotCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const uptimeRobotPlatformDefinition: PlatformDefinition = {
  id: "uptimerobot",
  category: "devops",
  displayName: "UptimeRobot",
  description: "Manage UptimeRobot monitors, incidents, status pages, integrations, and related account resources with an API token",
  authStrategies: ["apiKey"],
  capabilityMetadata: {
    mutation: "supported",
    stability: "stable",
    notes: ["Uses UptimeRobot's official v3 API with bearer-token authentication."],
  },
  adapter: uptimeRobotAdapter,
  capabilities: uptimeRobotCapabilities,
  examples: [
    "autocli devops uptimerobot login --token $UPTIMEROBOT_API_KEY",
    "autocli devops uptimerobot me",
    "autocli devops uptimerobot monitors --status DOWN",
    "autocli devops uptimerobot monitor 801150533",
    "autocli devops uptimerobot monitor-stats 801150533 --from 2026-04-01T00:00:00Z --to 2026-04-07T00:00:00Z",
    "autocli devops uptimerobot response-times 801150533 --time-series",
    "autocli devops uptimerobot incidents --monitor-id 801150533",
    "autocli devops uptimerobot integrations",
    "autocli devops uptimerobot psps",
    "autocli devops uptimerobot create-monitor --body '{\"friendlyName\":\"API\",\"url\":\"https://api.example.com/health\",\"type\":\"HTTP\",\"interval\":300,\"timeout\":30}'",
  ],
};
