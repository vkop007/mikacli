import { supabaseAdapter } from "./adapter.js";
import { supabaseCapabilities } from "./capabilities/index.js";

import type { PlatformDefinition } from "../../../core/runtime/platform-definition.js";

export const supabasePlatformDefinition: PlatformDefinition = {
  id: "supabase",
  category: "devops",
  displayName: "Supabase",
  description: "Inspect Supabase organizations, projects, and Edge Functions with a saved management token",
  authStrategies: ["apiKey"],
  adapter: supabaseAdapter,
  capabilities: supabaseCapabilities,
  examples: [
    "mikacli supabase login --token $SUPABASE_ACCESS_TOKEN",
    "mikacli supabase me",
    "mikacli supabase organizations",
    "mikacli supabase projects",
    "mikacli supabase functions your-project-ref",
  ],
};
