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
    "autocli supabase login --token $SUPABASE_ACCESS_TOKEN",
    "autocli supabase me",
    "autocli supabase organizations",
    "autocli supabase projects",
    "autocli supabase functions your-project-ref",
  ],
};
