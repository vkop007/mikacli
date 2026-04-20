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
    "mikacli devops uptimerobot login --token $UPTIMEROBOT_API_KEY",
    "mikacli devops uptimerobot me",
    "mikacli devops uptimerobot monitors --status DOWN",
    "mikacli devops uptimerobot monitor 801150533",
    "mikacli devops uptimerobot monitor-stats 801150533 --from 2026-04-01T00:00:00Z --to 2026-04-07T00:00:00Z",
    "mikacli devops uptimerobot response-times 801150533 --time-series",
    "mikacli devops uptimerobot incidents --monitor-id 801150533",
    "mikacli devops uptimerobot integrations",
    "mikacli devops uptimerobot psps",
    "mikacli devops uptimerobot create-monitor --body '{\"friendlyName\":\"API\",\"url\":\"https://api.example.com/health\",\"type\":\"HTTP\",\"interval\":300,\"timeout\":30}'",
  ],
};
